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
import { uploadBufferToCloudinary } from "../utils/cloudinaryUpload.js";
import cloudinary from "../config/cloudinary.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Legacy local-disk location — only ever read from now, for documents
// uploaded before the Cloudinary migration. Every new upload goes straight
// to Cloudinary instead (see the POST route below).
const UPLOAD_DIR = path.join(__dirname, "..", "..", "uploads", "library");

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

    // Cloudinary blocks public delivery of "raw" PDFs by default (security
    // setting, returns 401) — uploading as "image" instead is the standard
    // workaround and still serves a real, downloadable PDF at the URL.
    const uploaded = await uploadBufferToCloudinary(req.file.buffer, {
      folder: "scuml-library-documents",
      resource_type: "image",
      public_id: nanoid(),
      format: "pdf",
    });

    const doc = await LibraryDocument.create({
      library: library || "",
      title: title || "",
      url: uploaded.secure_url,
      publicId: uploaded.public_id,
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

    const disposition = req.query.download ? "attachment" : "inline";
    const safeName = (doc.originalName || doc.filename || "document").replace(/[^\w.\- ]/g, "_");

    // Cloudinary-backed document (every upload since the migration) — fetch
    // the bytes server-side and re-serve them under our own domain, so the
    // frontend's existing same-origin fetch (and its Content-Disposition
    // handling) keeps working unchanged.
    if (doc.url) {
      const cloudRes = await fetch(doc.url);
      if (!cloudRes.ok) {
        return res.status(502).json({ error: "Failed to fetch document" });
      }
      const buffer = Buffer.from(await cloudRes.arrayBuffer());
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `${disposition}; filename="${safeName}"`);
      return res.send(buffer);
    }

    // Legacy document uploaded before the Cloudinary migration — still on disk.
    const filePath = path.join(UPLOAD_DIR, doc.filename);
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

// 🔹 Delete a document — removes the DB record and the underlying file
// (Cloudinary for anything uploaded since the migration, disk for legacy docs).
router.delete("/:id", async (req, res) => {
  try {
    const doc = await LibraryDocument.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ error: "Not found" });

    if (doc.publicId) {
      try {
        await cloudinary.uploader.destroy(doc.publicId, { resource_type: "image" });
      } catch (err) {
        console.warn("⚠️ Could not remove library file from Cloudinary:", err.message);
      }
    } else if (doc.filename) {
      try {
        await fs.unlink(path.join(UPLOAD_DIR, doc.filename));
      } catch (err) {
        // File already missing on disk shouldn't block the DB delete.
        console.warn("⚠️ Could not remove library file from disk:", err.message);
      }
    }

    res.json({ message: "Document deleted" });
  } catch (err) {
    console.error("❌ Error deleting library document:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
