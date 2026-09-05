import express from "express";
import multer from "multer";
import SpotCheck from "../models/SpotCheck.js";
import Registration from "../models/Registration.js";
import { requireAuth, requireStaffOrAbove } from "../middleware/auth.js";
import { omitProtectedFields } from "../utils/sanitizeHelpers.js";
import { scanBuffer } from "../utils/malwareScan.js";
import { uploadBufferToCloudinary } from "../utils/cloudinaryUpload.js";
import { recordAuditEvent } from "../utils/auditLogger.js";
import { recordRecentActivity, clearRecentActivityFor } from "../utils/recentActivity.js";

const router = express.Router();

// Guest accounts may only act on the Identification section.
router.use(requireStaffOrAbove);

// 🔹 Optional photo gallery — moved here from Registration. Buffered in
// memory so each file can be malware-scanned before it's stored.
const uploadPhotos = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB per photo
  fileFilter: (req, file, cb) => {
    cb(null, ["image/jpeg", "image/png"].includes(file.mimetype));
  },
});

// 🔹 Create new Spot Check
router.post("/", requireAuth, async (req, res) => {
  try {
    const username = req.session?.user?.username;
    if (!username) return res.status(401).json({ error: "Unauthorized" });

    const { company, ...spotCheckData } = req.body;

    const existingCompany = await Registration.findById(company);
    if (!existingCompany) {
      return res.status(400).json({ error: "Company not found" });
    }

    const spotCheck = new SpotCheck({
      company,
      ...spotCheckData,
      createdBy: username,
    });

    await spotCheck.save();

    await Registration.findByIdAndUpdate(company, {
      $push: { spotChecks: spotCheck._id },
    });

    await recordRecentActivity({
      type: "spotcheck",
      refId: spotCheck._id,
      companyId: existingCompany._id,
      companyName: existingCompany.companyName,
      summary: `Spot Check for ${existingCompany.companyName}`,
      createdBy: username,
    });

    res.status(201).json(spotCheck);
  } catch (err) {
    console.error("❌ Error creating spot check:", err);
    res.status(400).json({ error: "Invalid request" });
  }
});

// 🔹 Upload a photo gallery for a spot check
router.post("/:id/photos", uploadPhotos.array("photos", 15), async (req, res) => {
  try {
    const files = req.files || [];
    if (files.length === 0) {
      return res.status(400).json({ error: "No files uploaded" });
    }

    // Scan every file before any of them reach Cloudinary — reject the whole
    // batch if even one is infected.
    for (const file of files) {
      const result = await scanBuffer(file.buffer, file.originalname);
      if (result.infected) {
        recordAuditEvent(req, "malware_blocked", req.session.user.username);
        return res.status(400).json({
          error: `Upload rejected: malware detected (${result.viruses.join(", ") || "unknown"})`,
        });
      }
    }

    const uploaded = await Promise.all(
      files.map((file) =>
        uploadBufferToCloudinary(file.buffer, { folder: "scuml-spotcheck-photos" })
      )
    );
    const urls = uploaded.map((r) => r.secure_url).filter(Boolean);

    const spotCheck = await SpotCheck.findByIdAndUpdate(
      req.params.id,
      { $push: { photos: { $each: urls } } },
      { new: true }
    );

    if (!spotCheck) return res.status(404).json({ error: "Not found" });

    res.json({ message: "Photos uploaded", photos: spotCheck.photos });
  } catch (err) {
    console.error("❌ Error uploading spot check photos:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// 🔹 Get all spot checks
router.get("/", requireAuth, async (req, res) => {
  try {
    const spotChecks = await SpotCheck.find()
      .populate("company", "companyName natureOfBusiness")
      .sort({ createdAt: -1 });

    res.json(spotChecks);
  } catch (err) {
    console.error("❌ Error fetching spot checks:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// 🔹 Get single spot check
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const spotCheck = await SpotCheck.findById(req.params.id).populate(
      "company",
      "companyName natureOfBusiness"
    );

    if (!spotCheck) return res.status(404).json({ error: "Spot check not found" });

    res.json(spotCheck);
  } catch (err) {
    console.error("❌ Error fetching spot check:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// 🔹 Update spot check
router.put("/:id", requireAuth, async (req, res) => {
  try {
    const updated = await SpotCheck.findByIdAndUpdate(
      req.params.id,
      { ...omitProtectedFields(req.body), createdBy: req.session.user.username },
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res.status(404).json({ error: "Spot check not found" });
    }

    res.json(updated);
  } catch (err) {
    console.error("❌ Error updating spot check:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// 🔹 Delete spot check
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const spotCheck = await SpotCheck.findByIdAndDelete(req.params.id);

    if (!spotCheck) {
      return res.status(404).json({ error: "Spot check not found" });
    }

    await Registration.findByIdAndUpdate(spotCheck.company, {
      $pull: { spotChecks: spotCheck._id },
    });
    await clearRecentActivityFor(spotCheck._id);

    res.json({ message: "Spot check deleted successfully" });
  } catch (err) {
    console.error("❌ Error deleting spot check:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
