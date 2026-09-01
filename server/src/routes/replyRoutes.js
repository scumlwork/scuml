// server/src/routes/replyRoutes.js
import express from "express";
import multer from "multer";
import Reply from "../models/Reply.js";
import { requireStaffOrAbove, requireSuperadmin } from "../middleware/auth.js";
import { recordRecentActivity, clearRecentActivityFor } from "../utils/recentActivity.js";
import { scanBuffer } from "../utils/malwareScan.js";
import { recordAuditEvent } from "../utils/auditLogger.js";
import { sendMail } from "../config/mailer.js";

const router = express.Router();

// "Reply" is available to staff and superadmin (not guest) — entirely
// separate feature from "My Memo".
router.use(requireStaffOrAbove);

// 🔹 Record a newly-generated reply
router.post("/", async (req, res) => {
  try {
    const username = req.session?.user?.username || "";
    const { title, refNo, date, address, to, subject, message } = req.body;

    const record = await Reply.create({
      title,
      refNo,
      date,
      address,
      to,
      subject,
      message,
      createdBy: username,
    });

    await recordRecentActivity({
      type: "reply",
      refId: record._id,
      summary: `Reply${subject ? `: ${subject}` : ""} by ${username}`,
      createdBy: username,
    });

    res.status(201).json(record);
  } catch (err) {
    console.error("❌ Error recording reply:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// 🔹 List every reply, newest first
router.get("/", async (req, res) => {
  try {
    const replies = await Reply.find().sort({ createdAt: -1 });
    res.json(replies);
  } catch (err) {
    console.error("❌ Error fetching replies:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// 🔹 Get single reply
router.get("/:id", async (req, res) => {
  try {
    const record = await Reply.findById(req.params.id);
    if (!record) return res.status(404).json({ error: "Not found" });
    res.json(record);
  } catch (err) {
    console.error("❌ Error fetching reply:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// 🔹 Edit a reply — whoever edits it becomes its new "Entered by", same
// convention as every other editable record.
router.put("/:id", async (req, res) => {
  try {
    const { title, refNo, date, address, to, subject, message } = req.body;
    const updated = await Reply.findByIdAndUpdate(
      req.params.id,
      { title, refNo, date, address, to, subject, message, createdBy: req.session.user.username },
      { new: true, runValidators: true }
    );
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json(updated);
  } catch (err) {
    console.error("❌ Error updating reply:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// 🔹 A generated reply PDF, on its way to being emailed — buffered so it
// can be malware-scanned before it's sent.
const uploadReplyPdf = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    cb(null, file.mimetype === "application/pdf");
  },
});

// 🔹 Send a generated reply directly by email, PDF attached for real. The
// recipient address is the "To" field typed directly into the form when
// composing this reply (there's no company record to look it up from).
router.post("/send-email", uploadReplyPdf.single("pdf"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const { to, subject, text } = req.body;
    if (!to) return res.status(400).json({ error: "'to' is required" });

    const result = await scanBuffer(req.file.buffer, req.file.originalname);
    if (result.infected) {
      recordAuditEvent(req, "malware_blocked", req.session.user.username);
      return res.status(400).json({
        error: `Upload rejected: malware detected (${result.viruses.join(", ") || "unknown"})`,
      });
    }

    await sendMail({
      to,
      subject: subject || "SCUML Correspondence",
      text: text || "Please find attached.",
      attachments: [
        {
          filename: req.file.originalname,
          content: req.file.buffer,
          contentType: "application/pdf",
        },
      ],
    });

    res.json({ success: true, sentTo: to });
  } catch (err) {
    console.error("❌ Error sending reply email:", err);
    res.status(500).json({ error: "Failed to send email" });
  }
});

// 🔹 Clear every reply at once — collection-wide, superadmin only.
router.delete("/clear-all", requireSuperadmin, async (req, res) => {
  try {
    const replies = await Reply.find({}, "_id");
    await Reply.deleteMany({});
    await Promise.all(replies.map((r) => clearRecentActivityFor(r._id)));
    res.json({ message: "All replies cleared" });
  } catch (err) {
    console.error("❌ Error clearing replies:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// 🔹 Delete a reply
router.delete("/:id", async (req, res) => {
  try {
    const record = await Reply.findByIdAndDelete(req.params.id);
    if (!record) return res.status(404).json({ error: "Not found" });

    await clearRecentActivityFor(record._id);

    res.json({ message: "Reply deleted" });
  } catch (err) {
    console.error("❌ Error deleting reply:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
