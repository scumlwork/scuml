// server/src/routes/letterRoutes.js
import express from "express";
import multer from "multer";
import Registration from "../models/Registration.js";
import Letter from "../models/Letter.js";
import { requireAuth, requireSuperadmin } from "../middleware/auth.js";
import { escapeRegex, omitProtectedFields } from "../utils/sanitizeHelpers.js";
import { scanBuffer } from "../utils/malwareScan.js";
import { uploadBufferToCloudinary } from "../utils/cloudinaryUpload.js";
import { recordAuditEvent } from "../utils/auditLogger.js";
import { recordRecentActivity, clearRecentActivityFor } from "../utils/recentActivity.js";
import { sendMail } from "../config/mailer.js";

const router = express.Router();

// Actions (Letters) is superadmin-only — not visible or usable by staff or
// guest accounts.
router.use(requireSuperadmin);

// 🔹 Optional photo gallery — buffered in memory so each file can be
// malware-scanned before it's stored.
const uploadPhotos = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB per photo
  fileFilter: (req, file, cb) => {
    cb(null, ["image/jpeg", "image/png"].includes(file.mimetype));
  },
});

// 🔹 A generated letter PDF, on its way to being shared — buffered so it can
// be scanned before it's hosted.
const uploadLetterPdf = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    cb(null, file.mimetype === "application/pdf");
  },
});

// 🔹 Host a generated letter PDF on Cloudinary so it can be shared as a real
// document link (via WhatsApp/Gmail) instead of just plain text.
router.post("/upload-letter-pdf", requireAuth, uploadLetterPdf.single("pdf"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const result = await scanBuffer(req.file.buffer, req.file.originalname);
    if (result.infected) {
      recordAuditEvent(req, "malware_blocked", req.session.user.username);
      return res.status(400).json({
        error: `Upload rejected: malware detected (${result.viruses.join(", ") || "unknown"})`,
      });
    }

    // Cloudinary blocks public delivery of "raw" PDFs by default (security
    // setting, returns 401) — uploading as "image" instead is the standard
    // workaround and still serves a real, downloadable PDF at the URL.
    const uploaded = await uploadBufferToCloudinary(req.file.buffer, {
      folder: "scuml-generated-letters",
      resource_type: "image",
      public_id: req.file.originalname.replace(/\.pdf$/i, ""),
      format: "pdf",
    });

    res.json({ url: uploaded.secure_url });
  } catch (err) {
    console.error("❌ Error uploading letter PDF:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// 🔹 Send a generated letter directly by email, PDF attached for real —
// unlike the Gmail compose deep link, this actually sends the mail, so the
// recipient's address is taken from the company's own registration record
// (never trusted from the client) to avoid this becoming an open relay.
router.post("/send-letter-email", requireAuth, uploadLetterPdf.single("pdf"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const { companyId, subject, text } = req.body;
    if (!companyId) return res.status(400).json({ error: "companyId is required" });

    const company = await Registration.findById(companyId).select("companyName email").lean();
    if (!company) return res.status(404).json({ error: "Company not found" });
    if (!company.email) {
      return res.status(400).json({ error: "No email on file for this company" });
    }

    const result = await scanBuffer(req.file.buffer, req.file.originalname);
    if (result.infected) {
      recordAuditEvent(req, "malware_blocked", req.session.user.username);
      return res.status(400).json({
        error: `Upload rejected: malware detected (${result.viruses.join(", ") || "unknown"})`,
      });
    }

    await sendMail({
      to: company.email,
      subject: subject || `Letter for ${company.companyName}`,
      text: text || `Please find attached the letter for ${company.companyName}.`,
      attachments: [
        {
          filename: req.file.originalname,
          content: req.file.buffer,
          contentType: "application/pdf",
        },
      ],
    });

    res.json({ success: true, sentTo: company.email });
  } catch (err) {
    console.error("❌ Error sending letter email:", err);
    res.status(500).json({ error: "Failed to send email" });
  }
});

// 🔹 Add a new letter to a company
router.post("/", requireAuth, async (req, res) => {
  try {
    // ensure session user exists
    const username = req.session?.user?.username;
    if (!username) return res.status(401).json({ error: "Unauthorized" });

    const {
      companyName,
      typeOfLetter,
      contacts,
      remark,
      dateOfReporting,
    } = req.body;

    const cleanContacts = Array.isArray(contacts)
      ? contacts
          .map((c) => ({
            name: c?.name || "",
            position: c?.position || "",
            phone: c?.phone || "",
            email: c?.email || "",
          }))
          .filter((c) => c.name && c.phone)
      : [];

    // Find company by name
    const company = await Registration.findOne({ companyName }).lean();
    if (!company) {
      return res.status(404).json({ error: "Company not found" });
    }

    // Count how many letters already exist for this company (use length from lean doc)
    const letterNumber = (company.letters?.length || 0) + 1;

    // Create and save the new letter — legacy single-contact fields mirror
    // the first contact so old display code / data consumers keep working.
    const newLetter = new Letter({
      company: company._id,
      typeOfLetter,
      contacts: cleanContacts,
      receiverName: cleanContacts[0]?.name || "",
      phone: cleanContacts[0]?.phone || "",
      email: cleanContacts[0]?.email || "",
      remark,
      dateOfReporting,
      tag: `Letter ${letterNumber}`,
      createdBy: username,
    });

    await newLetter.save();

    // Push only the ObjectId into company.letters using atomic update (avoids re-validating whole doc)
    await Registration.findByIdAndUpdate(company._id, {
      $push: { letters: newLetter._id },
    });

    await recordRecentActivity({
      type: "action",
      refId: newLetter._id,
      companyId: company._id,
      companyName: company.companyName,
      summary: `${typeOfLetter || "Action"} for ${company.companyName}`,
      createdBy: username,
    });

    res.status(201).json(newLetter);
  } catch (err) {
    console.error("Error saving letter:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// 🔹 Upload an optional photo gallery for a letter/action
router.post("/:id/photos", requireAuth, uploadPhotos.array("photos", 15), async (req, res) => {
  try {
    const files = req.files || [];
    if (files.length === 0) {
      return res.status(400).json({ error: "No files uploaded" });
    }

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
        uploadBufferToCloudinary(file.buffer, { folder: "scuml-action-photos" })
      )
    );
    const urls = uploaded.map((r) => r.secure_url).filter(Boolean);

    const letter = await Letter.findByIdAndUpdate(
      req.params.id,
      { $push: { photos: { $each: urls } } },
      { new: true }
    );

    if (!letter) return res.status(404).json({ error: "Not found" });

    res.json({ message: "Photos uploaded", photos: letter.photos });
  } catch (err) {
    console.error("❌ Error uploading photos:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// 🔎 Search companies by prefix
router.get("/search", requireAuth, async (req, res) => {
  try {
    const query = req.query.query || "";
    if (!query) return res.json([]);

    const companies = await Registration.find({
      companyName: { $regex: `^${escapeRegex(query)}`, $options: "i" },
    }).select("companyName _id natureOfBusiness");

    res.json(companies);
  } catch (err) {
    console.error("❌ Error in company search:", err);
    res.status(500).json({ error: "Search failed" });
  }
});

// 🔹 Get single letter
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const letter = await Letter.findById(req.params.id).populate(
      "company",
      "companyName natureOfBusiness"
    );

    if (!letter) return res.status(404).json({ error: "Letter not found" });

    res.json(letter);
  } catch (err) {
    console.error("❌ Error fetching letter:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// 🔹 Edit letter by ID
router.put("/:id", requireAuth, async (req, res) => {
  try {
    const update = omitProtectedFields(req.body);

    // Keep the legacy single-contact fields mirroring contacts[0] whenever
    // the contacts array is part of this update.
    if (Array.isArray(update.contacts) && update.contacts.length > 0) {
      update.receiverName = update.contacts[0].name;
      update.phone = update.contacts[0].phone;
      update.email = update.contacts[0].email;
    }

    const updatedLetter = await Letter.findByIdAndUpdate(
      req.params.id,
      // Whoever edits a record becomes its new "Entered by" — multiple
      // people can touch the same entry over time, so it should always
      // reflect who most recently entered its current content.
      { ...update, createdBy: req.session.user.username },
      { new: true, runValidators: true }
    );

    if (!updatedLetter) {
      return res.status(404).json({ error: "Letter not found" });
    }

    res.json(updatedLetter);
  } catch (err) {
    console.error("❌ Error updating letter:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// 🔹 Delete letter by ID
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const letter = await Letter.findByIdAndDelete(req.params.id);

    if (!letter) {
      return res.status(404).json({ error: "Letter not found" });
    }

    // 🔹 Remove letter reference from its Registration
    await Registration.findByIdAndUpdate(letter.company, {
      $pull: { letters: letter._id },
    });
    await clearRecentActivityFor(letter._id);

    res.json({ message: "Letter deleted successfully" });
  } catch (err) {
    console.error("❌ Error deleting letter:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// 🔹 Clear all letters — destructive + collection-wide, superadmin only
router.delete("/clear-all", requireSuperadmin, async (req, res) => {
  try {
    await Letter.deleteMany({});
    // Remove all letter references from registrations
    await Registration.updateMany({}, { $set: { letters: [] } });

    res.json({ message: "All letters cleared successfully" });
  } catch (err) {
    console.error("❌ Error clearing letters:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
