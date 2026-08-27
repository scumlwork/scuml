// server/src/routes/auditLogRoutes.js
import express from "express";
import { body } from "express-validator";
import AuditLog from "../models/AuditLog.js";
import { requireOwner } from "../middleware/auth.js";
import { deviceTypeFor } from "../utils/auditLogger.js";

const router = express.Router();

// 🔹 List all audit log entries, newest first — owner only
router.get("/", requireOwner, async (req, res) => {
  try {
    const logs = await AuditLog.find().sort({ createdAt: -1 });
    // Entries written before deviceType existed have "" stored — derive it
    // from their already-stored userAgent instead of leaving them blank.
    const withDevice = logs.map((log) =>
      log.deviceType ? log : { ...log.toObject(), deviceType: deviceTypeFor(log.userAgent) }
    );
    res.json(withDevice);
  } catch (err) {
    console.error("❌ Error fetching audit log:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// 🔹 Permanently delete selected entries — owner only
router.delete(
  "/",
  requireOwner,
  [body("ids").isArray({ min: 1 })],
  async (req, res) => {
    try {
      const { ids } = req.body;
      const result = await AuditLog.deleteMany({ _id: { $in: ids } });
      res.json({ message: "Log entries deleted", deletedCount: result.deletedCount });
    } catch (err) {
      console.error("❌ Error deleting audit log entries:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

// 🔹 Permanently wipe the entire audit log — owner only
router.delete("/clear-all", requireOwner, async (req, res) => {
  try {
    const result = await AuditLog.deleteMany({});
    res.json({ message: "Audit log cleared", deletedCount: result.deletedCount });
  } catch (err) {
    console.error("❌ Error clearing audit log:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
