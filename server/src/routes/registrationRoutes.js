// server/src/routes/registrationRoutes.js
import express from "express";
import multer from "multer";
import Registration from "../models/Registration.js";
import Letter from "../models/Letter.js";
import Sanction from "../models/Sanction.js";
import OffSiteInspection from "../models/OffSiteInspection.js";
import OnSiteInspection from "../models/OnSiteInspection.js"; // ✅ new
import Training from "../models/Training.js";                 // ✅ new
import Violation from "../models/Violation.js";
import { requireAuth, requireSuperadmin } from "../middleware/auth.js";
import { escapeRegex, omitProtectedFields } from "../utils/sanitizeHelpers.js";
import { scanBuffer } from "../utils/malwareScan.js";
import { uploadBufferToCloudinary } from "../utils/cloudinaryUpload.js";
import { recordAuditEvent } from "../utils/auditLogger.js";

const router = express.Router();

// 🔹 Optional photo gallery — buffered in memory (not streamed straight to
// Cloudinary) so each file can be malware-scanned before it's stored.
const uploadPhotos = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB per photo — prevents unbounded upload abuse
  fileFilter: (req, file, cb) => {
    cb(null, ["image/jpeg", "image/png"].includes(file.mimetype));
  },
});

// 🔹 Create new registration (require auth so we can set createdBy)
router.post("/", requireAuth, async (req, res) => {
  try {
    const username = req.session?.user?.username;
    if (!username) return res.status(401).json({ error: "Unauthorized" });

    const registration = new Registration({
      ...req.body,
      createdBy: username,
    });

    await registration.save();
    res.status(201).json(registration);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: "A company with this name is already registered." });
    }
    res.status(400).json({ error: "Invalid request" });
  }
});

// 🔹 Upload an optional photo gallery for a registration (general, not role-gated)
router.post("/:id/photos", requireAuth, uploadPhotos.array("photos", 15), async (req, res) => {
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
        uploadBufferToCloudinary(file.buffer, { folder: "scuml-registration-photos" })
      )
    );
    const urls = uploaded.map((r) => r.secure_url).filter(Boolean);

    const registration = await Registration.findByIdAndUpdate(
      req.params.id,
      { $push: { photos: { $each: urls } } },
      { new: true }
    );

    if (!registration) return res.status(404).json({ error: "Not found" });

    res.json({ message: "Photos uploaded", photos: registration.photos });
  } catch (err) {
    console.error("❌ Error uploading photos:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// 🔹 Get all registrations (with related data)
router.get("/", requireAuth, async (req, res) => {
  try {
    const regs = await Registration.find()
      .populate("letters")
      .populate("sanctions")
      .populate("offSiteInspections")
      .populate("onSiteInspections") // ✅ new
      .populate("trainings")         // ✅ new
      .populate("violations")
      .sort({ createdAt: -1 });

    res.json(regs);
  } catch (err) {
    console.error("❌ Error fetching registrations:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// 🔹 Search registrations by company name
router.get("/search", requireAuth, async (req, res) => {
  try {
    const query = req.query.query || "";
    if (!query) return res.json([]);

    const results = await Registration.find({
      companyName: { $regex: `^${escapeRegex(query)}`, $options: "i" },
    }).select("companyName _id natureOfBusiness");

    res.json(results);
  } catch (err) {
    console.error("❌ Error in search route:", err.message);
    res.status(500).json({ error: "Search failed" });
  }
});

// 🔹 Get single registration by id (with related data)
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const reg = await Registration.findById(req.params.id)
      .populate("letters")
      .populate("sanctions")
      .populate("offSiteInspections")
      .populate("onSiteInspections") // ✅ new
      .populate("trainings")         // ✅ new
      .populate("violations");

    if (!reg) return res.status(404).json({ error: "Not found" });
    res.json(reg);
  } catch (err) {
    console.error("❌ Error fetching registration:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// 🔹 Update a single registration
router.put("/:id", requireAuth, async (req, res) => {
  try {
    const updated = await Registration.findByIdAndUpdate(
      req.params.id,
      omitProtectedFields(req.body),
      { new: true, runValidators: true }
    );

    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json(updated);
  } catch (err) {
    console.error("❌ Error updating registration:", err.message);
    res.status(400).json({ error: "Invalid request" });
  }
});

// 🔹 Delete a single registration (and its linked records)
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const reg = await Registration.findByIdAndDelete(req.params.id);
    if (!reg) return res.status(404).json({ error: "Not found" });

    await Promise.all([
      Letter.deleteMany({ _id: { $in: reg.letters } }),
      Sanction.deleteMany({ _id: { $in: reg.sanctions } }),
      OffSiteInspection.deleteMany({ _id: { $in: reg.offSiteInspections } }),
      OnSiteInspection.deleteMany({ _id: { $in: reg.onSiteInspections } }),
      Training.deleteMany({ _id: { $in: reg.trainings } }),
      Violation.deleteMany({ _id: { $in: reg.violations } }),
    ]);

    res.json({ message: "Registration and its records deleted" });
  } catch (err) {
    console.error("❌ Error deleting registration:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// 🔹 Clear all registrations, letters, sanctions, and inspections — destructive
// + collection-wide, superadmin only
router.delete("/clear-all", requireSuperadmin, async (req, res) => {
  try {
    await Registration.deleteMany({});
    await Letter.deleteMany({});
    await Sanction.deleteMany({});
    await OffSiteInspection.deleteMany({});
    await OnSiteInspection.deleteMany({}); // ✅ clear on-site
    await Training.deleteMany({});         // ✅ clear trainings
    await Violation.deleteMany({});        // ✅ clear violations

    res.json({
      message:
        "All registrations, letters, sanctions, off-site inspections, on-site inspections, trainings, and violations cleared",
    });
  } catch (err) {
    console.error("❌ Error clearing all:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
