// server/src/routes/libraryRoutes.js
import express from "express";
import multer from "multer";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { nanoid } from "nanoid";
import LibraryDocument from "../models/LibraryDocument.js";
import { requireSuperadmin } from "../middleware/auth.js";
import { scanBuffer } from "../utils/malwareScan.js";
import { recordAuditEvent } from "../utils/auditLogger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Local disk storage, per explicit request — not Cloudinary. Lives outside
// src/ so it survives independently of the source tree.
const UPLOAD_DIR = path.join(__dirname, "..", "..", "uploads", "library");

async function ensureUploadDir() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
}

const router = express.Router();

// Library is superadmin-only.
router.use(requireSuperadmin);

// Buffered in memory so it can be malware-scanned before ever touching disk.
const uploadPdf = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    cb(null, file.mimetype === "application/pdf");
  },
});

// 🔹 Upload a document
router.post("/", uploadPdf.single("pdf"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No PDF file uploaded" });

    const username = req.session?.user?.username || "";
    const { library, title } = req.body;

    const result = await scanBuffer(req.file.buffer, req.file.originalname);
    if (result.infected) {
      recordAuditEvent(req, "malware_blocked", username);
      return res.status(400).json({
        error: `Upload rejected: malware detected (${result.viruses.join(", ") || "unknown"})`,
      });
    }

    await ensureUploadDir();
    const storedFilename = `${nanoid()}.pdf`;
    await fs.writeFile(path.join(UPLOAD_DIR, storedFilename), req.file.buffer);

    const doc = await LibraryDocument.create({
      library: library || "",
      title: title || "",
      filename: storedFilename,
      originalName: req.file.originalname,
      fileSize: req.file.size,
      createdBy: username,
    });

    res.status(201).json(doc);
  } catch (err) {
    console.error("❌ Error uploading library document:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// 🔹 List every document, newest first
router.get("/", async (req, res) => {
  try {
    const docs = await LibraryDocument.find().sort({ createdAt: -1 });
    res.json(docs);
  } catch (err) {
    console.error("❌ Error fetching library documents:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// 🔹 Stream the actual PDF — inline (view/print) by default, or as a
// download when ?download=1 is passed. Gated by requireSuperadmin above
// rather than a public static route, since this is confidential content.
router.get("/:id/file", async (req, res) => {
  try {
    const doc = await LibraryDocument.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: "Not found" });

    const filePath = path.join(UPLOAD_DIR, doc.filename);
    const disposition = req.query.download ? "attachment" : "inline";
    const safeName = (doc.originalName || doc.filename).replace(/[^\w.\- ]/g, "_");

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `${disposition}; filename="${safeName}"`);
    res.sendFile(filePath, (err) => {
      if (err && !res.headersSent) {
        console.error("❌ Error sending library file:", err);
        res.status(404).json({ error: "File not found on disk" });
      }
    });
  } catch (err) {
    console.error("❌ Error serving library document:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// 🔹 Delete a document — removes the DB record and the file on disk.
router.delete("/:id", async (req, res) => {
  try {
    const doc = await LibraryDocument.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ error: "Not found" });

    try {
      await fs.unlink(path.join(UPLOAD_DIR, doc.filename));
    } catch (err) {
      // File already missing on disk shouldn't block the DB delete.
      console.warn("⚠️ Could not remove library file from disk:", err.message);
    }

    res.json({ message: "Document deleted" });
  } catch (err) {
    console.error("❌ Error deleting library document:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
