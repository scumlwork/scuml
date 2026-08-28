// server/src/routes/messageRoutes.js
import express from "express";
import { body, validationResult } from "express-validator";
import Message from "../models/Message.js";
import User from "../models/User.js";
import ConversationVisibility from "../models/ConversationVisibility.js";
import ConversationPin from "../models/ConversationPin.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

// The owner account (isOwner: true — durable regardless of username
// changes) is invisible in chat by default; a non-superadmin viewer only
// sees them once the owner has opened a chat, and loses sight of them
// again once the owner closes it. Returns which owner usernames are
// currently hidden from `viewerUsername` — empty for a superadmin viewer,
// who always sees everyone.
async function getInvisibleOwnersFor(viewerUsername, viewerRole) {
  if (viewerRole === "superadmin") return [];
  const owners = await User.find({ isOwner: true }).select("username");
  if (owners.length === 0) return [];
  const ownerUsernames = owners.map((o) => o.username);
  const visRecords = await ConversationVisibility.find({
    ownerUsername: { $in: ownerUsernames },
    otherUsername: viewerUsername,
    visible: true,
  }).select("ownerUsername");
  const visibleSet = new Set(visRecords.map((v) => v.ownerUsername));
  return ownerUsernames.filter((u) => !visibleSet.has(u));
}

// 🔹 Send a message — a superadmin may message any user; a staff/guest user
// may only message a superadmin (never another staff/guest), so every
// conversation always has exactly one superadmin participant.
router.post(
  "/",
  requireAuth,
  [
    body("to").isString().trim().notEmpty(),
    body("text").isString().trim().isLength({ min: 1, max: 4000 }),
    body("referencedEntry").optional().isObject(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: "Invalid message" });
      }

      const fromUsername = req.session.user.username;
      const fromRole = req.session.user.role;
      const { to, text, referencedEntry } = req.body;

      if (to === fromUsername) {
        return res.status(400).json({ error: "Cannot message yourself" });
      }

      const target = await User.findOne({ username: to }).select("role isActive");
      if (!target || !target.isActive) {
        return res.status(404).json({ error: "User not found" });
      }

      if (fromRole !== "superadmin" && target.role !== "superadmin") {
        return res.status(403).json({ error: "You can only message a superadmin" });
      }

      const cleanEntry =
        referencedEntry && referencedEntry.type
          ? {
              type: referencedEntry.type,
              refId: referencedEntry.refId || undefined,
              companyId: referencedEntry.companyId || undefined,
              companyName: referencedEntry.companyName || "",
              summary: referencedEntry.summary || "",
            }
          : undefined;

      const message = await Message.create({
        from: fromUsername,
        to,
        text: text.trim(),
        referencedEntry: cleanEntry,
      });

      // A message existing between two people is what makes the
      // conversation show up in each of their lists — pinned for both
      // sides so a later "Clear" (which only deletes messages) still
      // leaves it listed for both.
      await Promise.all([
        ConversationPin.updateOne(
          { ownerUsername: fromUsername, otherUsername: to },
          { $setOnInsert: { ownerUsername: fromUsername, otherUsername: to } },
          { upsert: true }
        ),
        ConversationPin.updateOne(
          { ownerUsername: to, otherUsername: fromUsername },
          { $setOnInsert: { ownerUsername: to, otherUsername: fromUsername } },
          { upsert: true }
        ),
      ]);

      // The owner sending a message is what "opens the chat" — make them
      // visible to this recipient again if they'd previously closed it.
      if (req.session.user.isOwner) {
        await ConversationVisibility.updateOne(
          { ownerUsername: fromUsername, otherUsername: to },
          { $set: { visible: true } },
          { upsert: true }
        );
      }

      res.status(201).json(message);
    } catch (err) {
      console.error("❌ Error sending message:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

// 🔹 List every conversation for the logged-in user, newest first, each
// with its own unread count — powers the Messages page for every role
// (always self-scoped by session, so there's nothing here a non-superadmin
// shouldn't see about their own conversations).
router.get("/conversations", requireAuth, async (req, res) => {
  try {
    const me = req.session.user.username;
    const invisibleOwners = await getInvisibleOwnersFor(me, req.session.user.role);

    const pins = await ConversationPin.find({ ownerUsername: me }).select("otherUsername");
    const otherUsernames = pins
      .map((p) => p.otherUsername)
      .filter((u) => !invisibleOwners.includes(u));

    if (otherUsernames.length === 0) return res.json([]);

    // Seed every pinned conversation first — a cleared one (pin still
    // exists, but its messages were deleted) shows with no preview instead
    // of silently vanishing from the list.
    const byUser = new Map();
    for (const other of otherUsernames) {
      byUser.set(other, {
        username: other,
        lastMessage: "",
        lastMessageAt: null,
        lastMessageFromMe: false,
        unreadCount: 0,
      });
    }

    const messages = await Message.find({
      $or: [
        { from: me, to: { $in: otherUsernames } },
        { to: me, from: { $in: otherUsernames } },
      ],
    }).sort({ createdAt: -1 });

    for (const m of messages) {
      const other = m.from === me ? m.to : m.from;
      const entry = byUser.get(other);
      if (!entry.lastMessageAt) {
        // messages are sorted newest-first, so the first one seen per user
        // is that conversation's most recent
        entry.lastMessage = m.text;
        entry.lastMessageAt = m.createdAt;
        entry.lastMessageFromMe = m.from === me;
      }
      if (m.to === me && !m.read) entry.unreadCount += 1;
    }

    const conversations = Array.from(byUser.values()).sort((a, b) => {
      if (!a.lastMessageAt && !b.lastMessageAt) return 0;
      if (!a.lastMessageAt) return 1;
      if (!b.lastMessageAt) return -1;
      return new Date(b.lastMessageAt) - new Date(a.lastMessageAt);
    });

    const users = await User.find({
      username: { $in: conversations.map((c) => c.username) },
    }).select("username role");
    const roleByUsername = Object.fromEntries(users.map((u) => [u.username, u.role]));
    conversations.forEach((c) => {
      c.role = roleByUsername[c.username] || "unknown";
    });

    res.json(conversations);
  } catch (err) {
    console.error("❌ Error fetching conversations:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// 🔹 Every account the logged-in user could start a fresh conversation
// with — a superadmin can message anyone; a staff/guest user can only
// message a superadmin, so their contact list is filtered to that (and
// never includes an owner who hasn't opened a chat with them — see
// getInvisibleOwnersFor). Active accounts only, excluding themselves.
router.get("/contacts", requireAuth, async (req, res) => {
  try {
    const me = req.session.user.username;
    const invisibleOwners = await getInvisibleOwnersFor(me, req.session.user.role);
    const filter =
      req.session.user.role === "superadmin"
        ? { username: { $ne: me }, isActive: true }
        : { username: { $ne: me }, isActive: true, role: "superadmin" };
    if (invisibleOwners.length > 0) {
      filter.username = { ...filter.username, $nin: invisibleOwners };
    }
    const users = await User.find(filter).select("username role").sort({ username: 1 });
    res.json(users);
  } catch (err) {
    console.error("❌ Error fetching contacts:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// 🔹 Full thread between the logged-in user and :username, oldest first.
router.get("/thread/:username", requireAuth, async (req, res) => {
  try {
    const me = req.session.user.username;
    const other = req.params.username;

    if (req.session.user.role !== "superadmin") {
      // A non-superadmin may only view a thread where the other party is a
      // superadmin — never another staff/guest's conversation.
      const target = await User.findOne({ username: other }).select("role");
      if (!target || target.role !== "superadmin") {
        return res.status(403).json({ error: "Not authorized to view this thread" });
      }
      const invisibleOwners = await getInvisibleOwnersFor(me, req.session.user.role);
      if (invisibleOwners.includes(other)) {
        return res.status(403).json({ error: "Not authorized to view this thread" });
      }
    }

    const messages = await Message.find({
      $or: [
        { from: me, to: other },
        { from: other, to: me },
      ],
    }).sort({ createdAt: 1 });

    res.json(messages);
  } catch (err) {
    console.error("❌ Error fetching thread:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// 🔹 Mark every message *from* :username *to* the logged-in user as read —
// called when that thread is opened.
router.put("/thread/:username/read", requireAuth, async (req, res) => {
  try {
    const me = req.session.user.username;
    const other = req.params.username;
    await Message.updateMany({ from: other, to: me, read: false }, { $set: { read: true } });
    res.json({ message: "Marked as read" });
  } catch (err) {
    console.error("❌ Error marking thread read:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// 🔹 The owner closes a chat — hides the owner from that user's
// conversations/contacts again until the owner messages them again.
// Owner-only; directional (doesn't touch the owner's own view).
router.put("/thread/:username/close", requireAuth, async (req, res) => {
  try {
    if (!req.session.user.isOwner) {
      return res.status(403).json({ error: "Only the owner account can close a chat" });
    }
    const me = req.session.user.username;
    const other = req.params.username;
    await ConversationVisibility.updateOne(
      { ownerUsername: me, otherUsername: other },
      { $set: { visible: false } },
      { upsert: true }
    );
    res.json({ message: "Chat closed" });
  } catch (err) {
    console.error("❌ Error closing chat:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// 🔹 Clear a chat — deletes every message between the logged-in superadmin
// and :username, but leaves the conversation pinned so it still shows
// (empty) in the Conversations list instead of disappearing.
router.delete("/thread/:username/clear", requireAuth, async (req, res) => {
  try {
    if (req.session.user.role !== "superadmin") {
      return res.status(403).json({ error: "Superadmin only" });
    }
    const me = req.session.user.username;
    const other = req.params.username;
    await Message.deleteMany({
      $or: [
        { from: me, to: other },
        { from: other, to: me },
      ],
    });
    res.json({ message: "Chat cleared" });
  } catch (err) {
    console.error("❌ Error clearing chat:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// 🔹 Delete a chat — deletes every message *and* unpins the conversation
// from both participants' lists, so it disappears entirely until a fresh
// message starts it again.
router.delete("/thread/:username", requireAuth, async (req, res) => {
  try {
    if (req.session.user.role !== "superadmin") {
      return res.status(403).json({ error: "Superadmin only" });
    }
    const me = req.session.user.username;
    const other = req.params.username;
    await Promise.all([
      Message.deleteMany({
        $or: [
          { from: me, to: other },
          { from: other, to: me },
        ],
      }),
      ConversationPin.deleteMany({
        $or: [
          { ownerUsername: me, otherUsername: other },
          { ownerUsername: other, otherUsername: me },
        ],
      }),
    ]);
    res.json({ message: "Chat deleted" });
  } catch (err) {
    console.error("❌ Error deleting chat:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// 🔹 Unread count for the logged-in user — polled by the "Messages" sidebar
// badge.
router.get("/unread-count", requireAuth, async (req, res) => {
  try {
    const me = req.session.user.username;
    const invisibleOwners = await getInvisibleOwnersFor(me, req.session.user.role);
    const filter = { to: me, read: false };
    if (invisibleOwners.length > 0) {
      filter.from = { $nin: invisibleOwners };
    }
    const count = await Message.countDocuments(filter);
    res.json({ count });
  } catch (err) {
    console.error("❌ Error fetching unread count:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
