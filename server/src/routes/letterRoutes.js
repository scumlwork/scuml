// server/src/routes/letterRoutes.js
import express from "express";
import Registration from "../models/Registration.js";
import Letter from "../models/Letter.js";
import { requireAuth, requireSuperadmin } from "../middleware/auth.js";
import { escapeRegex, omitProtectedFields } from "../utils/sanitizeHelpers.js";

const router = express.Router();

// 🔹 Add a new letter to a company
router.post("/", requireAuth, async (req, res) => {
  try {
    // ensure session user exists
    const username = req.session?.user?.username;
    if (!username) return res.status(401).json({ error: "Unauthorized" });

    const {
      companyName,
      typeOfLetter,
      receiverName,
      phone,
      email,
      dateOfReporting,
    } = req.body;

    // Find company by name
    const company = await Registration.findOne({ companyName }).lean();
    if (!company) {
      return res.status(404).json({ error: "Company not found" });
    }

    // Count how many letters already exist for this company (use length from lean doc)
    const letterNumber = (company.letters?.length || 0) + 1;

    // Create and save the new letter
    const newLetter = new Letter({
      company: company._id,
      typeOfLetter,
      receiverName,
      phone,
      email,
      dateOfReporting,
      tag: `Letter ${letterNumber}`,
      createdBy: username,
    });

    await newLetter.save();

    // Push only the ObjectId into company.letters using atomic update (avoids re-validating whole doc)
    await Registration.findByIdAndUpdate(company._id, {
      $push: { letters: newLetter._id },
    });

    res.status(201).json(newLetter);
  } catch (err) {
    console.error("Error saving letter:", err);
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

// 🔹 Edit letter by ID
router.put("/:id", requireAuth, async (req, res) => {
  try {
    const updatedLetter = await Letter.findByIdAndUpdate(
      req.params.id,
      // Whoever edits a record becomes its new "Entered by" — multiple
      // people can touch the same entry over time, so it should always
      // reflect who most recently entered its current content.
      { ...omitProtectedFields(req.body), createdBy: req.session.user.username },
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
