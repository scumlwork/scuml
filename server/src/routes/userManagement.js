// server/src/routes/userManagement.js
import express from "express";
import mongoose from "mongoose";
import { body, validationResult } from "express-validator";
import User from "../models/User.js";
import { validatePasswordStrength } from "../utils/passwordRules.js";
import { requireSuperadmin } from "../middleware/auth.js";

const router = express.Router();

// 🔹 Which user IDs currently have a live (unexpired) session
async function getOnlineUserIds() {
  const sessions = mongoose.connection.collection("sessions");
  const docs = await sessions.find({ expires: { $gt: new Date() } }).toArray();
  const ids = new Set();
  for (const doc of docs) {
    try {
      const parsed = JSON.parse(doc.session);
      if (parsed?.user?.id) ids.add(parsed.user.id);
    } catch {
      // ignore malformed session docs
    }
  }
  return ids;
}

// 🔹 Forcibly end all live sessions belonging to a user (e.g. on deactivate/delete)
async function killSessionsForUser(userId) {
  const sessions = mongoose.connection.collection("sessions");
  const docs = await sessions.find({}).toArray();
  const idsToDelete = [];
  for (const doc of docs) {
    try {
      const parsed = JSON.parse(doc.session);
      if (parsed?.user?.id === userId) idsToDelete.push(doc._id);
    } catch {
      // ignore malformed session docs
    }
  }
  if (idsToDelete.length > 0) {
    await sessions.deleteMany({ _id: { $in: idsToDelete } });
  }
}

// 🔹 List all users with online/offline status. The owner (dion) is invisible
// to everyone else — other superadmins see each other and every staff
// account, but never the owner's row. The owner sees everyone, including
// themselves.
router.get("/", requireSuperadmin, async (req, res) => {
  try {
    const [users, onlineIds] = await Promise.all([
      User.find().select("username role isActive isOwner createdAt").sort({ createdAt: 1 }),
      getOnlineUserIds(),
    ]);

    const visibleUsers = req.session.user.isOwner
      ? users
      : users.filter((u) => !u.isOwner);

    const result = visibleUsers.map((u) => ({
      id: u._id.toString(),
      username: u.username,
      role: u.role,
      isActive: u.isActive,
      createdAt: u.createdAt,
      online: onlineIds.has(u._id.toString()),
    }));

    res.json(result);
  } catch (err) {
    console.error("❌ Error listing users:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// 🔹 Deactivate / reactivate a user
router.put("/:id/toggle-active", requireSuperadmin, async (req, res) => {
  try {
    if (req.params.id === req.session.user.id) {
      return res.status(400).json({ error: "You cannot deactivate your own account" });
    }

    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ error: "User not found" });
    if (target.isOwner && !req.session.user.isOwner) {
      return res.status(403).json({ error: "Not authorized to modify this account" });
    }

    if (target.isActive && target.role === "superadmin") {
      const activeSuperadmins = await User.countDocuments({ role: "superadmin", isActive: true });
      if (activeSuperadmins <= 1) {
        return res.status(400).json({ error: "Cannot deactivate the last active super admin" });
      }
    }

    target.isActive = !target.isActive;
    await target.save();

    if (!target.isActive) {
      await killSessionsForUser(target._id.toString());
    }

    res.json({ message: `User ${target.isActive ? "activated" : "deactivated"}`, isActive: target.isActive });
  } catch (err) {
    console.error("❌ Error toggling user active state:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// 🔹 Keep every live session for this user in sync with a new username, so
// the change is reflected immediately without forcing a re-login anywhere.
async function syncUsernameAcrossSessions(userId, newUsername) {
  const sessions = mongoose.connection.collection("sessions");
  const docs = await sessions.find({}).toArray();
  for (const doc of docs) {
    try {
      const parsed = JSON.parse(doc.session);
      if (parsed?.user?.id === userId) {
        parsed.user.username = newUsername;
        await sessions.updateOne({ _id: doc._id }, { $set: { session: JSON.stringify(parsed) } });
      }
    } catch {
      // ignore malformed session docs
    }
  }
}

// 🔹 Change a user's username (independent of their password)
router.put(
  "/:id/username",
  requireSuperadmin,
  [
    body("newUsername")
      .isString()
      .isLength({ min: 3, max: 64 })
      .withMessage("Username must be 3-64 characters")
      .trim(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const target = await User.findById(req.params.id);
      if (!target) return res.status(404).json({ error: "User not found" });
      if (target.isOwner && !req.session.user.isOwner) {
        return res.status(403).json({ error: "Not authorized to modify this account" });
      }

      const newUsername = req.body.newUsername.trim();

      const exists = await User.findOne({ username: newUsername, _id: { $ne: target._id } }).lean();
      if (exists) return res.status(409).json({ error: "Username already taken" });

      target.username = newUsername;
      await target.save();

      await syncUsernameAcrossSessions(target._id.toString(), newUsername);

      res.json({ message: "Username updated", username: target.username });
    } catch (err) {
      console.error("❌ Error updating username:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

// 🔹 Delete a user
router.delete("/:id", requireSuperadmin, async (req, res) => {
  try {
    if (req.params.id === req.session.user.id) {
      return res.status(400).json({ error: "You cannot delete your own account" });
    }

    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ error: "User not found" });
    if (target.isOwner && !req.session.user.isOwner) {
      return res.status(403).json({ error: "Not authorized to modify this account" });
    }

    if (target.role === "superadmin") {
      const superadminCount = await User.countDocuments({ role: "superadmin" });
      if (superadminCount <= 1) {
        return res.status(400).json({ error: "Cannot delete the last super admin" });
      }
    }

    await User.findByIdAndDelete(req.params.id);
    await killSessionsForUser(req.params.id);

    res.json({ message: "User deleted" });
  } catch (err) {
    console.error("❌ Error deleting user:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// 🔹 Super admin resets another user's password (no current password needed)
router.put(
  "/:id/reset-password",
  requireSuperadmin,
  [body("newPassword").isString()],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const passwordErrors = validatePasswordStrength(req.body.newPassword);
      if (passwordErrors.length > 0) {
        return res.status(400).json({ error: passwordErrors[0], passwordErrors });
      }

      const target = await User.findById(req.params.id);
      if (!target) return res.status(404).json({ error: "User not found" });
      if (target.isOwner && !req.session.user.isOwner) {
        return res.status(403).json({ error: "Not authorized to modify this account" });
      }

      await target.setPassword(req.body.newPassword);
      target.failedLogin = { count: 0, lastAttempt: null, lockUntil: null };
      await target.save();

      res.json({ message: "Password reset" });
    } catch (err) {
      console.error("❌ Error resetting password:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

export default router;
