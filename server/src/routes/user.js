// src/routes/user.js
import express from "express";
import multer from "multer";
import User from "../models/User.js";
import { requireAuth } from "../middleware/auth.js";
import { scanBuffer } from "../utils/malwareScan.js";
import { uploadBufferToCloudinary } from "../utils/cloudinaryUpload.js";
import { recordAuditEvent } from "../utils/auditLogger.js";

const router = express.Router();

// 🔹 Profile photo — buffered in memory so it can be malware-scanned before
// it's forwarded to Cloudinary.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB — prevents unbounded upload abuse
  fileFilter: (req, file, cb) => {
    cb(null, ["image/jpeg", "image/png"].includes(file.mimetype));
  },
});

// 🔹 Upload or Update Profile Photo
// requireAuth runs before multer so an unauthenticated request is rejected
// before any file is streamed to Cloudinary, not after.
router.post("/profile/photo", requireAuth, upload.single("photo"), async (req, res) => {
  try {
    // Use correct ID from session
    const userId = req.session.user._id || req.session.user.id;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const scan = await scanBuffer(req.file.buffer, req.file.originalname);
    if (scan.infected) {
      recordAuditEvent(req, "malware_blocked", user.username);
      return res.status(400).json({
        error: `Upload rejected: malware detected (${scan.viruses.join(", ") || "unknown"})`,
      });
    }

    const uploaded = await uploadBufferToCloudinary(req.file.buffer, {
      folder: "scuml-users",
      transformation: [{ width: 300, height: 300, crop: "fill" }],
    });
    const photoUrl = uploaded.secure_url;

    // Save photo URL in MongoDB
    user.photoUrl = photoUrl;
    await user.save();

    // Sync session with new photo
    req.session.user.photoUrl = user.photoUrl;

    res.json({ message: "Photo updated", photoUrl: user.photoUrl });
  } catch (err) {
    console.error("Upload error details:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// 🔹 Provide Default Avatar if user has no photo
router.get("/profile/photo", async (req, res) => {
  try {
    if (!req.session?.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const userId = req.session.user._id || req.session.user.id;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const photoUrl =
      user.photoUrl ||
      "https://res.cloudinary.com/dtseei2ze/image/upload/v1756982016/default-avatar_w9umu2.jpg";

    res.json({ photoUrl });
  } catch (err) {
    console.error("Get photo error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
