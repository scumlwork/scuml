import express from "express";
import Training from "../models/Training.js";
import Registration from "../models/Registration.js";
import { requireAuth, requireStaffOrAbove } from "../middleware/auth.js";
import { omitProtectedFields } from "../utils/sanitizeHelpers.js";
import { recordRecentActivity, clearRecentActivityFor } from "../utils/recentActivity.js";

const router = express.Router();

// Guest accounts may only act on the Identification section.
router.use(requireStaffOrAbove);

// 🔹 Create new Training
router.post("/", requireAuth, async (req, res) => {
  try {
    const username = req.session?.user?.username;
    if (!username) return res.status(401).json({ error: "Unauthorized" });

    const { company, ...trainingData } = req.body;

    // Ensure company exists
    const existingCompany = await Registration.findById(company);
    if (!existingCompany) {
      return res.status(400).json({ error: "Company not found" });
    }

    // Create training record
    const training = new Training({
      company,
      ...trainingData,
      createdBy: username,
    });

    await training.save();

    // Link training to Registration
    await Registration.findByIdAndUpdate(company, {
      $push: { trainings: training._id },
    });

    await recordRecentActivity({
      type: "training",
      refId: training._id,
      companyId: existingCompany._id,
      companyName: existingCompany.companyName,
      summary: `Training recorded for ${existingCompany.companyName}`,
      createdBy: username,
    });

    res.status(201).json(training);
  } catch (err) {
    console.error("❌ Error creating training:", err);
    res.status(400).json({ error: "Invalid request" });
  }
});

// 🔹 Get all trainings
router.get("/", requireAuth, async (req, res) => {
  try {
    const trainings = await Training.find()
      .populate("company", "companyName natureOfBusiness")
      .sort({ createdAt: -1 });

    res.json(trainings);
  } catch (err) {
    console.error("❌ Error fetching trainings:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// 🔹 Get single training
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const training = await Training.findById(req.params.id)
      .populate("company", "companyName natureOfBusiness");

    if (!training) return res.status(404).json({ error: "Training not found" });

    res.json(training);
  } catch (err) {
    console.error("❌ Error fetching training:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// 🔹 Update training
router.put("/:id", requireAuth, async (req, res) => {
  try {
    const updatedTraining = await Training.findByIdAndUpdate(
      req.params.id,
      // Whoever edits a record becomes its new "Entered by" — multiple
      // people can touch the same entry over time, so it should always
      // reflect who most recently entered its current content.
      { ...omitProtectedFields(req.body), createdBy: req.session.user.username },
      { new: true, runValidators: true }
    );

    if (!updatedTraining) {
      return res.status(404).json({ error: "Training not found" });
    }

    res.json(updatedTraining);
  } catch (err) {
    console.error("❌ Error updating training:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// 🔹 Delete training
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const training = await Training.findByIdAndDelete(req.params.id);

    if (!training) {
      return res.status(404).json({ error: "Training not found" });
    }

    // Remove reference from Registration
    await Registration.findByIdAndUpdate(training.company, {
      $pull: { trainings: training._id },
    });
    await clearRecentActivityFor(training._id);

    res.json({ message: "Training deleted successfully" });
  } catch (err) {
    console.error("❌ Error deleting training:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
