// server/src/routes/generatedLetterRoutes.js
// Records the metadata of every letter actually generated through
// "Initiate Letters" — separate from letterRoutes.js, which covers the
// "Actions" feed (a different, older meaning of "letter" in this codebase).
// No PDF is stored here; the document itself is generated client-side and
// shared/downloaded straight from the browser.
import express from "express";
import GeneratedLetter from "../models/GeneratedLetter.js";
import Registration from "../models/Registration.js";
import { requireSuperadmin } from "../middleware/auth.js";
import { recordRecentActivity, clearRecentActivityFor } from "../utils/recentActivity.js";

const router = express.Router();

// Initiate Letters is superadmin-only, so every route here is too.
router.use(requireSuperadmin);

// 🔹 Record a newly-generated letter
router.post("/", async (req, res) => {
  try {
    const username = req.session?.user?.username || "";
    const { companyId, letterType, title, reportingDate, refNumber } = req.body;

    const company = await Registration.findById(companyId).select("companyName").lean();
    if (!company) return res.status(404).json({ error: "Company not found" });

    const record = await GeneratedLetter.create({
      company: company._id,
      letterType,
      title,
      reportingDate,
      refNumber,
      generatedBy: username,
    });

    await Registration.findByIdAndUpdate(company._id, {
      $push: { generatedLetters: record._id },
    });

    await recordRecentActivity({
      type: "generatedLetter",
      refId: record._id,
      companyId: company._id,
      companyName: company.companyName,
      summary: `${letterType} generated for ${company.companyName}`,
      createdBy: username,
    });

    res.status(201).json(record);
  } catch (err) {
    console.error("❌ Error recording generated letter:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// 🔹 Get single generated-letter record
router.get("/:id", async (req, res) => {
  try {
    const record = await GeneratedLetter.findById(req.params.id).populate(
      "company",
      "companyName natureOfBusiness"
    );
    if (!record) return res.status(404).json({ error: "Not found" });
    res.json(record);
  } catch (err) {
    console.error("❌ Error fetching generated letter:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// 🔹 Delete a generated-letter record
router.delete("/:id", async (req, res) => {
  try {
    const record = await GeneratedLetter.findByIdAndDelete(req.params.id);
    if (!record) return res.status(404).json({ error: "Not found" });

    await Registration.findByIdAndUpdate(record.company, {
      $pull: { generatedLetters: record._id },
    });
    await clearRecentActivityFor(record._id);

    res.json({ message: "Generated letter record deleted" });
  } catch (err) {
    console.error("❌ Error deleting generated letter:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
