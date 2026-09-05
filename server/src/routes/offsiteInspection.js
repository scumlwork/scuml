import express from "express";
import multer from "multer";
import { nanoid } from "nanoid";
import OffSiteInspection from "../models/OffSiteInspection.js";
import Registration from "../models/Registration.js";
import { requireAuth, requireStaffOrAbove } from "../middleware/auth.js";
import { omitProtectedFields } from "../utils/sanitizeHelpers.js";
import { recordRecentActivity, clearRecentActivityFor } from "../utils/recentActivity.js";
import { scanBuffer } from "../utils/malwareScan.js";
import { uploadBufferToCloudinary } from "../utils/cloudinaryUpload.js";
import { recordAuditEvent } from "../utils/auditLogger.js";
import cloudinary from "../config/cloudinary.js";

const router = express.Router();

// Guest accounts may only act on the Identification section.
router.use(requireStaffOrAbove);

// 🔹 Accepted formats for the "upload a document instead of the form"
// path — Word, Excel, or PDF. Checked by extension rather than the
// browser-reported MIME type: browsers (especially on Windows) frequently
// send generic types like application/octet-stream for .docx/.xlsx, which
// made a strict MIME allowlist reject perfectly valid files.
const DOCUMENT_EXTENSIONS = ["pdf", "doc", "docx", "xls", "xlsx"];

function documentExtension(originalname = "") {
  const match = /\.([a-zA-Z0-9]+)$/.exec(originalname);
  return match ? match[1].toLowerCase() : "";
}

// Cloudinary can only rasterize PDFs as "image" resource type (the trick
// used elsewhere in this app to get public delivery on a raw-restricted
// account) — it flatly rejects that for Word/Excel, which need the actual
// "raw" resource type instead.
function cloudinaryResourceType(ext) {
  return ext === "pdf" ? "image" : "raw";
}

const uploadDocument = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
  fileFilter: (req, file, cb) => {
    cb(null, DOCUMENT_EXTENSIONS.includes(documentExtension(file.originalname)));
  },
});

// 🔹 Create new Off-Site Inspection
router.post("/", requireAuth, async (req, res) => {
  try {
    const username = req.session?.user?.username;
    if (!username) return res.status(401).json({ error: "Unauthorized" });

    const { company, ...inspectionData } = req.body;

    // Ensure company exists
    const existingCompany = await Registration.findById(company);
    if (!existingCompany) {
      return res.status(400).json({ error: "Company not found" });
    }

    // Create inspection record
    const inspection = new OffSiteInspection({
      company,
      ...inspectionData,
      createdBy: username,
    });

    await inspection.save();

    // 🔹 Link inspection to Registration
    await Registration.findByIdAndUpdate(company, {
      $push: { offSiteInspections: inspection._id },
    });

    await recordRecentActivity({
      type: "offsite",
      refId: inspection._id,
      companyId: existingCompany._id,
      companyName: existingCompany.companyName,
      summary: `Off-Site Inspection for ${existingCompany.companyName}`,
      createdBy: username,
    });

    res.status(201).json(inspection);
  } catch (err) {
    console.error("❌ Error creating inspection:", err);
    res.status(400).json({ error: "Invalid request" });
  }
});

// 🔹 Create a new Off-Site Inspection by uploading a Word/Excel/PDF document
// instead of filling the form — mutually exclusive with the JSON route above.
router.post("/upload", requireAuth, uploadDocument.single("document"), async (req, res) => {
  try {
    const username = req.session?.user?.username;
    if (!username) return res.status(401).json({ error: "Unauthorized" });

    if (!req.file) return res.status(400).json({ error: "No document uploaded" });

    const { company } = req.body;
    const existingCompany = await Registration.findById(company);
    if (!existingCompany) {
      return res.status(400).json({ error: "Company not found" });
    }

    const result = await scanBuffer(req.file.buffer, req.file.originalname);
    if (result.infected) {
      recordAuditEvent(req, "malware_blocked", username);
      return res.status(400).json({
        error: `Upload rejected: malware detected (${result.viruses.join(", ") || "unknown"})`,
      });
    }

    const ext = documentExtension(req.file.originalname);
    const uploaded = await uploadBufferToCloudinary(req.file.buffer, {
      folder: "scuml-offsite-documents",
      resource_type: cloudinaryResourceType(ext),
      public_id: nanoid(),
      format: ext,
    });

    const inspection = new OffSiteInspection({
      company,
      mode: "document",
      documentUrl: uploaded.secure_url,
      documentPublicId: uploaded.public_id,
      documentOriginalName: req.file.originalname,
      documentFileSize: req.file.size,
      createdBy: username,
    });

    await inspection.save();

    await Registration.findByIdAndUpdate(company, {
      $push: { offSiteInspections: inspection._id },
    });

    await recordRecentActivity({
      type: "offsite",
      refId: inspection._id,
      companyId: existingCompany._id,
      companyName: existingCompany.companyName,
      summary: `Off-Site Inspection for ${existingCompany.companyName}`,
      createdBy: username,
    });

    res.status(201).json(inspection);
  } catch (err) {
    console.error("❌ Error uploading inspection document:", err);
    res.status(400).json({ error: "Invalid request" });
  }
});

// 🔹 Replace the attached document on an existing document-mode inspection —
// this is what makes an uploaded document "editable" after the fact.
router.put("/:id/document", requireAuth, uploadDocument.single("document"), async (req, res) => {
  try {
    const username = req.session?.user?.username;
    if (!username) return res.status(401).json({ error: "Unauthorized" });
    if (!req.file) return res.status(400).json({ error: "No document uploaded" });

    const inspection = await OffSiteInspection.findById(req.params.id);
    if (!inspection) return res.status(404).json({ error: "Inspection not found" });

    const result = await scanBuffer(req.file.buffer, req.file.originalname);
    if (result.infected) {
      recordAuditEvent(req, "malware_blocked", username);
      return res.status(400).json({
        error: `Upload rejected: malware detected (${result.viruses.join(", ") || "unknown"})`,
      });
    }

    const ext = documentExtension(req.file.originalname);
    const uploaded = await uploadBufferToCloudinary(req.file.buffer, {
      folder: "scuml-offsite-documents",
      resource_type: cloudinaryResourceType(ext),
      public_id: nanoid(),
      format: ext,
    });

    const oldPublicId = inspection.documentPublicId;
    const oldResourceType = cloudinaryResourceType(documentExtension(inspection.documentOriginalName));

    inspection.mode = "document";
    inspection.documentUrl = uploaded.secure_url;
    inspection.documentPublicId = uploaded.public_id;
    inspection.documentOriginalName = req.file.originalname;
    inspection.documentFileSize = req.file.size;
    inspection.createdBy = username;
    await inspection.save();

    if (oldPublicId) {
      try {
        await cloudinary.uploader.destroy(oldPublicId, { resource_type: oldResourceType });
      } catch (err) {
        console.warn("⚠️ Could not remove previous inspection document from Cloudinary:", err.message);
      }
    }

    res.json(inspection);
  } catch (err) {
    console.error("❌ Error replacing inspection document:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// 🔹 Get all inspections
router.get("/", requireAuth, async (req, res) => {
  try {
    const inspections = await OffSiteInspection.find()
      .populate("company", "companyName natureOfBusiness")
      .sort({ createdAt: -1 });

    res.json(inspections);
  } catch (err) {
    console.error("❌ Error fetching inspections:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// 🔹 Get single inspection
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const inspection = await OffSiteInspection.findById(req.params.id).populate(
      "company",
      "companyName natureOfBusiness"
    );

    if (!inspection) return res.status(404).json({ error: "Inspection not found" });

    res.json(inspection);
  } catch (err) {
    console.error("❌ Error fetching inspection:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// 🔹 Update inspection
router.put("/:id", requireAuth, async (req, res) => {
  try {
    const updatedInspection = await OffSiteInspection.findByIdAndUpdate(
      req.params.id,
      // Whoever edits a record becomes its new "Entered by" — multiple
      // people can touch the same entry over time, so it should always
      // reflect who most recently entered its current content.
      { ...omitProtectedFields(req.body), createdBy: req.session.user.username },
      { new: true, runValidators: true }
    );

    if (!updatedInspection) {
      return res.status(404).json({ error: "Inspection not found" });
    }

    res.json(updatedInspection);
  } catch (err) {
    console.error("❌ Error updating inspection:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// 🔹 Delete inspection
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const inspection = await OffSiteInspection.findByIdAndDelete(req.params.id);

    if (!inspection) {
      return res.status(404).json({ error: "Inspection not found" });
    }

    // 🔹 Remove reference from Registration
    await Registration.findByIdAndUpdate(inspection.company, {
      $pull: { offSiteInspections: inspection._id },
    });
    await clearRecentActivityFor(inspection._id);

    if (inspection.documentPublicId) {
      try {
        const resourceType = cloudinaryResourceType(documentExtension(inspection.documentOriginalName));
        await cloudinary.uploader.destroy(inspection.documentPublicId, { resource_type: resourceType });
      } catch (err) {
        console.warn("⚠️ Could not remove inspection document from Cloudinary:", err.message);
      }
    }

    res.json({ message: "Inspection deleted successfully" });
  } catch (err) {
    console.error("❌ Error deleting inspection:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
