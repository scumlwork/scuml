// server/src/routes/memoRoutes.js
import express from "express";
import Memo from "../models/Memo.js";
import { requireStaffOrAbove, requireSuperadmin } from "../middleware/auth.js";
import { recordRecentActivity, clearRecentActivityFor } from "../utils/recentActivity.js";

const router = express.Router();

// "My Memo" is available to staff and superadmin (not guest).
router.use(requireStaffOrAbove);

// 🔹 Record a newly-generated memo
router.post("/", async (req, res) => {
  try {
    const username = req.session?.user?.username || "";
    const { to, through, from, date, refNo, subject, message } = req.body;

    const record = await Memo.create({
      to,
      through,
      from,
      date,
      refNo,
      subject,
      message,
      createdBy: username,
    });

    await recordRecentActivity({
      type: "memo",
      refId: record._id,
      summary: `Memo${subject ? `: ${subject}` : ""} by ${username}`,
      createdBy: username,
    });

    res.status(201).json(record);
  } catch (err) {
    console.error("❌ Error recording memo:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// 🔹 List every memo, newest first — powers the home page and Admin's
// Memos list.
router.get("/", async (req, res) => {
  try {
    const memos = await Memo.find().sort({ createdAt: -1 });
    res.json(memos);
  } catch (err) {
    console.error("❌ Error fetching memos:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// 🔹 Get single memo
router.get("/:id", async (req, res) => {
  try {
    const record = await Memo.findById(req.params.id);
    if (!record) return res.status(404).json({ error: "Not found" });
    res.json(record);
  } catch (err) {
    console.error("❌ Error fetching memo:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// 🔹 Edit a memo — whoever edits it becomes its new "Entered by", same
// convention as every other editable record.
router.put("/:id", async (req, res) => {
  try {
    const { to, through, from, date, refNo, subject, message } = req.body;
    const updated = await Memo.findByIdAndUpdate(
      req.params.id,
      { to, through, from, date, refNo, subject, message, createdBy: req.session.user.username },
      { new: true, runValidators: true }
    );
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json(updated);
  } catch (err) {
    console.error("❌ Error updating memo:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// 🔹 Clear every memo at once — collection-wide, superadmin only (same as
// every other "clear all" route in the app).
router.delete("/clear-all", requireSuperadmin, async (req, res) => {
  try {
    const memos = await Memo.find({}, "_id");
    await Memo.deleteMany({});
    await Promise.all(memos.map((m) => clearRecentActivityFor(m._id)));
    res.json({ message: "All memos cleared" });
  } catch (err) {
    console.error("❌ Error clearing memos:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// 🔹 Delete a memo
router.delete("/:id", async (req, res) => {
  try {
    const record = await Memo.findByIdAndDelete(req.params.id);
    if (!record) return res.status(404).json({ error: "Not found" });

    await clearRecentActivityFor(record._id);

    res.json({ message: "Memo deleted" });
  } catch (err) {
    console.error("❌ Error deleting memo:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
