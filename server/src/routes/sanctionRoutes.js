// server/src/routes/sanctionRoutes.js
import express from "express";
import multer from "multer";
import Sanction from "../models/Sanction.js";
import Registration from "../models/Registration.js";
import { requireAuth, requireSuperadmin } from "../middleware/auth.js";
import { omitProtectedFields } from "../utils/sanitizeHelpers.js";
import { scanBuffer } from "../utils/malwareScan.js";
import { uploadBufferToCloudinary } from "../utils/cloudinaryUpload.js";
import { recordAuditEvent } from "../utils/auditLogger.js";

const router = express.Router();

// 🔹 Receipt upload (images or PDF) — buffered in memory so it can be
// malware-scanned before it's forwarded to Cloudinary.
const uploadReceipt = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB — prevents unbounded upload abuse
  fileFilter: (req, file, cb) => {
    cb(null, ["image/jpeg", "image/png", "application/pdf"].includes(file.mimetype));
  },
});

// 🔹 Create new sanction
router.post("/", requireAuth, async (req, res) => {
  try {
    const username = req.session?.user?.username;
    if (!username) return res.status(401).json({ error: "Unauthorized" });

    const { company, natureOfBusiness, amount, modeOfPayment } = req.body;

    // Ensure company exists
    const existingCompany = await Registration.findById(company);
    if (!existingCompany) {
      return res.status(400).json({ error: "Company not found" });
    }

    // Create sanction
    const sanction = new Sanction({
      company,
      natureOfBusiness,
      amount,
      modeOfPayment,
      createdBy: username,
    });

    await sanction.save();

    // 🔹 Add sanction reference to the registration (atomic update)
    await Registration.findByIdAndUpdate(company, {
      $push: { sanctions: sanction._id },
    });

    res.status(201).json(sanction);
  } catch (err) {
    console.error("❌ Error creating sanction:", err);
    res.status(400).json({ error: "Invalid sanction data" });
  }
});

// 🔹 Upload/replace a sanction's payment receipt (admin-only visibility, but any
// authenticated user can attach the receipt right after creating the sanction)
router.post("/:id/receipt", requireAuth, uploadReceipt.single("receipt"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const scan = await scanBuffer(req.file.buffer, req.file.originalname);
    if (scan.infected) {
      recordAuditEvent(req, "malware_blocked", req.session.user.username);
      return res.status(400).json({
        error: `Upload rejected: malware detected (${scan.viruses.join(", ") || "unknown"})`,
      });
    }

    const uploaded = await uploadBufferToCloudinary(req.file.buffer, {
      folder: "scuml-receipts",
      resource_type: "auto",
    });
    const receiptUrl = uploaded.secure_url;

    const sanction = await Sanction.findByIdAndUpdate(
      req.params.id,
      { receiptUrl },
      { new: true }
    );

    if (!sanction) return res.status(404).json({ error: "Sanction not found" });

    res.json({ message: "Receipt uploaded", receiptUrl: sanction.receiptUrl });
  } catch (err) {
    console.error("❌ Error uploading receipt:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// 🔹 Get all sanctions
router.get("/", requireAuth, async (req, res) => {
  try {
    const sanctions = await Sanction.find()
      .populate("company", "companyName natureOfBusiness")
      .sort({ createdAt: -1 });

    res.json(sanctions);
  } catch (err) {
    console.error("❌ Error fetching sanctions:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// 🔹 Get single sanction
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const sanction = await Sanction.findById(req.params.id).populate(
      "company",
      "companyName natureOfBusiness"
    );

    if (!sanction) return res.status(404).json({ error: "Sanction not found" });

    res.json(sanction);
  } catch (err) {
    console.error("❌ Error fetching sanction:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// 🔹 Edit sanction by ID
router.put("/:id", requireAuth, async (req, res) => {
  try {
    const updatedSanction = await Sanction.findByIdAndUpdate(
      req.params.id,
      // Whoever edits a record becomes its new "Entered by" — multiple
      // people can touch the same entry over time, so it should always
      // reflect who most recently entered its current content.
      { ...omitProtectedFields(req.body), createdBy: req.session.user.username },
      { new: true, runValidators: true }
    );

    if (!updatedSanction) {
      return res.status(404).json({ error: "Sanction not found" });
    }

    res.json(updatedSanction);
  } catch (err) {
    console.error("❌ Error updating sanction:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// 🔹 Delete sanction by ID
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const sanction = await Sanction.findByIdAndDelete(req.params.id);

    if (!sanction) {
      return res.status(404).json({ error: "Sanction not found" });
    }

    // 🔹 Remove sanction reference from Registration
    await Registration.findByIdAndUpdate(sanction.company, {
      $pull: { sanctions: sanction._id },
    });

    res.json({ message: "Sanction deleted successfully" });
  } catch (err) {
    console.error("❌ Error deleting sanction:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// 🔹 Clear all sanctions — destructive + collection-wide, superadmin only
router.delete("/clear-all", requireSuperadmin, async (req, res) => {
  try {
    await Sanction.deleteMany({});
    // Remove all sanction references from registrations
    await Registration.updateMany({}, { $set: { sanctions: [] } });

    res.json({ message: "All sanctions cleared successfully" });
  } catch (err) {
    console.error("❌ Error clearing sanctions:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
