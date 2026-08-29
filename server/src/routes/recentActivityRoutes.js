// server/src/routes/recentActivityRoutes.js
import express from "express";
import RecentActivity from "../models/RecentActivity.js";
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
