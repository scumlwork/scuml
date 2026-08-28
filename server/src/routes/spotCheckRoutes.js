import express from "express";
import SpotCheck from "../models/SpotCheck.js";
import Registration from "../models/Registration.js";
import { requireAuth, requireStaffOrAbove } from "../middleware/auth.js";
import { omitProtectedFields } from "../utils/sanitizeHelpers.js";
import { recordRecentActivity, clearRecentActivityFor } from "../utils/recentActivity.js";

const router = express.Router();

// Guest accounts may only act on the Identification section.
router.use(requireStaffOrAbove);

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
