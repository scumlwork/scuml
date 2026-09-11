// server/src/routes/recentActivityRoutes.js
import express from "express";
import RecentActivity from "../models/RecentActivity.js";
import Registration from "../models/Registration.js";
import { requireSuperadmin } from "../middleware/auth.js";

const router = express.Router();

router.use(requireSuperadmin);

// 🔹 Active (not-yet-closed) activity feed, oldest first — the first entry
// that came in stays at the top, each new one appends below it.
router.get("/", async (req, res) => {
  try {
    const activities = await RecentActivity.find({ dismissed: false }).sort({ createdAt: 1 });
    res.json(activities);
  } catch (err) {
    console.error("❌ Error fetching recent activity:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// 🔹 Every logged action for one company, oldest first — the "Diary of
// Action" table on the Actions page. Includes dismissed entries too:
// closing something from the Recent Activity feed shouldn't erase it from
// the company's permanent action log.
router.get("/company/:companyId", async (req, res) => {
  try {
    const activities = await RecentActivity.find({ companyId: req.params.companyId }).sort({ createdAt: 1 });
    res.json(activities);
  } catch (err) {
    console.error("❌ Error fetching company action diary:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// 🔹 Manually add a "Diary of Action" entry for one company — a free-text
// Description of Activity typed straight into the diary. Saves exactly like
// an auto-logged action: shows in this company's Diary of Action and in the
// superadmin Recent Activity feed.
router.post("/company/:companyId", async (req, res) => {
  try {
    const description = (req.body.description || "").trim();
    if (!description) {
      return res.status(400).json({ error: "Enter a description of activity" });
    }
    const company = await Registration.findById(req.params.companyId).select("companyName").lean();
    if (!company) return res.status(404).json({ error: "Company not found" });

    const activity = await RecentActivity.create({
      type: "manualEntry",
      refId: company._id,
      companyId: company._id,
      companyName: company.companyName,
      summary: description,
      createdBy: req.session?.user?.username || "",
    });
    res.status(201).json(activity);
  } catch (err) {
    console.error("❌ Error adding manual diary entry:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// 🔹 "Clear All" — dismisses every currently active entry in one go,
// same as clicking "Close" on each, without touching the underlying records.
router.put("/dismiss-all", async (req, res) => {
  try {
    await RecentActivity.updateMany({ dismissed: false }, { dismissed: true });
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Error clearing recent activity:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// 🔹 "Close" an entry — removes it from the feed without touching the
// underlying record.
router.put("/:id/dismiss", async (req, res) => {
  try {
    const activity = await RecentActivity.findByIdAndUpdate(
      req.params.id,
      { dismissed: true },
      { new: true }
    );
    if (!activity) return res.status(404).json({ error: "Not found" });
    res.json(activity);
  } catch (err) {
    console.error("❌ Error dismissing recent activity:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
