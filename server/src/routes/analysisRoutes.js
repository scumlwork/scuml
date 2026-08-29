// server/src/routes/analysisRoutes.js
// Work-rate analytics — how many entries came in per section and per user,
// tallied for today / this week / this month / this year / all time.
// Built on top of the RecentActivity feed, since it already logs every
// submission type (identification, action, sanction, violation, training,
// onsite, offsite, generatedLetter, spotcheck, memo) with who made it and
// when — the same source of truth the Recent Activity page itself reads.
import express from "express";
import RecentActivity from "../models/RecentActivity.js";
import User from "../models/User.js";
import { requireSuperadmin } from "../middleware/auth.js";

const router = express.Router();

router.use(requireSuperadmin);

const SECTION_TYPES = [
  "identification", "action", "sanction", "violation", "training",
  "onsite", "offsite", "generatedLetter", "spotcheck", "memo",
];

function emptySectionTally() {
  const tally = {};
  for (const t of SECTION_TYPES) tally[t] = 0;
  return tally;
}

// 🔹 Calendar boundaries for "today" / "this week" (Monday-start) /
// "this month" / "this year", in the server's local time zone.
function getBoundaries() {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const dow = startOfDay.getDay(); // 0 = Sunday
  const diffToMonday = dow === 0 ? 6 : dow - 1;
  const startOfWeek = new Date(startOfDay);
  startOfWeek.setDate(startOfWeek.getDate() - diffToMonday);

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);

  return { startOfDay, startOfWeek, startOfMonth, startOfYear };
}

router.get("/", async (req, res) => {
  try {
    const { startOfDay, startOfWeek, startOfMonth, startOfYear } = getBoundaries();

    const activities = await RecentActivity.find({}, "type createdBy createdAt").lean();

    const sectionTotals = {
      day: emptySectionTally(),
      week: emptySectionTally(),
      month: emptySectionTally(),
      year: emptySectionTally(),
      allTime: emptySectionTally(),
    };

    const userCounts = new Map(); // username -> { day, week, month, year, allTime }

    for (const a of activities) {
      const createdAt = new Date(a.createdAt);
      const username = a.createdBy || "Unknown";

      if (!userCounts.has(username)) {
        userCounts.set(username, { day: 0, week: 0, month: 0, year: 0, allTime: 0 });
      }
      const u = userCounts.get(username);

      const bump = (period) => {
        if (SECTION_TYPES.includes(a.type)) sectionTotals[period][a.type] += 1;
        u[period] += 1;
      };

      bump("allTime");
      if (createdAt >= startOfYear) bump("year");
      if (createdAt >= startOfMonth) bump("month");
      if (createdAt >= startOfWeek) bump("week");
      if (createdAt >= startOfDay) bump("day");
    }

    // Every user appears, even with zero entries — "all the users will be
    // listed and rated according to their input", not just the active ones.
    // The owner account is excluded from this ranking entirely.
    const users = await User.find().select("username role isOwner").lean();
    const visibleUsers = users.filter((u) => !u.isOwner);

    const userTotals = visibleUsers.map((u) => {
      const counts = userCounts.get(u.username) || { day: 0, week: 0, month: 0, year: 0, allTime: 0 };
      return { username: u.username, role: u.role, ...counts };
    });

    // Highest-ranked first (by all-time total); ties broken by month, then week.
    userTotals.sort((a, b) => b.allTime - a.allTime || b.month - a.month || b.week - a.week);

    // Whoever leads each individual period — surfaced separately since the
    // all-time leader isn't necessarily this week's or today's top performer.
    const topOf = (period) =>
      userTotals.length === 0
        ? null
        : userTotals.reduce((best, u) => (u[period] > (best?.[period] ?? -1) ? u : best), null)?.username || null;

    const leaders = {
      day: topOf("day"),
      week: topOf("week"),
      month: topOf("month"),
      year: topOf("year"),
      allTime: topOf("allTime"),
    };

    res.json({ sectionTotals, userTotals, leaders, generatedAt: new Date() });
  } catch (err) {
    console.error("❌ Error building analysis:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
