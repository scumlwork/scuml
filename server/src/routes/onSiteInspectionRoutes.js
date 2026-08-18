import express from "express";
import OnSiteInspection from "../models/OnSiteInspection.js";
import Registration from "../models/Registration.js";
import { requireAuth } from "../middleware/auth.js";
import { omitProtectedFields } from "../utils/sanitizeHelpers.js";

const router = express.Router();

// 🔹 Create new On-Site Inspection
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
    const inspection = new OnSiteInspection({
      company,
      ...inspectionData,
      createdBy: username,
    });

    await inspection.save();

    // Link inspection to Registration
    await Registration.findByIdAndUpdate(company, {
      $push: { onSiteInspections: inspection._id },
    });

    res.status(201).json(inspection);
  } catch (err) {
    console.error("❌ Error creating On-Site inspection:", err);
    res.status(400).json({ error: "Invalid request" });
  }
});

// 🔹 Get all inspections
router.get("/", requireAuth, async (req, res) => {
  try {
    const inspections = await OnSiteInspection.find()
      .populate("company", "companyName natureOfBusiness")
      .sort({ createdAt: -1 });

    res.json(inspections);
  } catch (err) {
    console.error("❌ Error fetching On-Site inspections:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// 🔹 Get single inspection
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const inspection = await OnSiteInspection.findById(req.params.id)
      .populate("company", "companyName natureOfBusiness");

    if (!inspection) return res.status(404).json({ error: "Inspection not found" });

    res.json(inspection);
  } catch (err) {
    console.error("❌ Error fetching On-Site inspection:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// 🔹 Update inspection
router.put("/:id", requireAuth, async (req, res) => {
  try {
    const updatedInspection = await OnSiteInspection.findByIdAndUpdate(
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
    console.error("❌ Error updating On-Site inspection:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// 🔹 Delete inspection
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const inspection = await OnSiteInspection.findByIdAndDelete(req.params.id);

    if (!inspection) {
      return res.status(404).json({ error: "Inspection not found" });
    }

    // Remove reference from Registration
    await Registration.findByIdAndUpdate(inspection.company, {
      $pull: { onSiteInspections: inspection._id },
    });

    res.json({ message: "Inspection deleted successfully" });
  } catch (err) {
    console.error("❌ Error deleting On-Site inspection:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
