// server/src/routes/analysisRoutes.js
// Work-rate analytics — how many entries came in per section and per user,
// tallied for today / this week / this month / this year / all time.
// Built on top of the RecentActivity feed, since it already logs every
// submission type (identification, action, sanction, violation, training,
// onsite, offsite, generatedLetter, spotcheck, memo) with who made it and
// when — the same source of truth the Recent Activity page itself reads.
import express from "express";
import RecentActivity from "../models/RecentActivity.js";
import Registration from "../models/Registration.js";
import User from "../models/User.js";
import Target from "../models/Target.js";
import { requireSuperadmin } from "../middleware/auth.js";
import { sendSystemMessage } from "../utils/sendSystemMessage.js";

const router = express.Router();

router.use(requireSuperadmin);

const SECTION_TYPES = [
  "identification", "action", "sanction", "violation", "training",
  "onsite", "offsite", "generatedLetter", "spotcheck", "memo", "reply",
];

const SECTION_LABELS = {
  identification: "Identification",
  action: "Action",
  sanction: "Sanction",
  violation: "Violation",
  training: "Training",
  onsite: "On-Site Inspection",
  offsite: "Off-Site Inspection",
  generatedLetter: "Initiated Letter",
  spotcheck: "Spot Check",
  memo: "Memo",
};

const PERIOD_PHRASES = {
  day: "today",
  week: "this week",
  month: "this month",
  year: "this year",
};

function emptySectionTally() {
  const tally = {};
  for (const t of SECTION_TYPES) tally[t] = 0;
  return tally;
}

function emptyPeriodCounts() {
  return { day: 0, week: 0, month: 0, year: 0, allTime: 0 };
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
    // username -> { [sectionType]: { day, week, month, year, allTime } } —
    // kept separately so a target scoped to specific sections (e.g. only
    // Spot Checks + Off-Site Inspections) can be tallied against just those,
    // instead of the user's total across every type.
    const userTypeCounts = new Map();

    for (const a of activities) {
      const createdAt = new Date(a.createdAt);
      const username = a.createdBy || "Unknown";

      if (!userCounts.has(username)) {
        userCounts.set(username, emptyPeriodCounts());
      }
      const u = userCounts.get(username);

      if (!userTypeCounts.has(username)) userTypeCounts.set(username, {});
      const typeMap = userTypeCounts.get(username);
      if (SECTION_TYPES.includes(a.type) && !typeMap[a.type]) {
        typeMap[a.type] = emptyPeriodCounts();
      }

      const bump = (period) => {
        if (SECTION_TYPES.includes(a.type)) {
          sectionTotals[period][a.type] += 1;
          typeMap[a.type][period] += 1;
        }
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
      const counts = userCounts.get(u.username) || emptyPeriodCounts();
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

    // 🔹 How many companies were registered under each Nature of Business,
    // tallied the same way as the section totals above. Grouped by whatever
    // string is actually on file (not a fixed list) since real records don't
    // always match the dropdown's canonical options exactly.
    const registrations = await Registration.find({}, "natureOfBusiness createdAt").lean();
    const natureCounts = new Map(); // nature -> { day, week, month, year, allTime }

    for (const r of registrations) {
      const createdAt = new Date(r.createdAt);
      const nature = (r.natureOfBusiness || "").trim() || "Unspecified";

      if (!natureCounts.has(nature)) {
        natureCounts.set(nature, emptyPeriodCounts());
      }
      const n = natureCounts.get(nature);

      const bump = (period) => {
        n[period] += 1;
      };

      bump("allTime");
      if (createdAt >= startOfYear) bump("year");
      if (createdAt >= startOfMonth) bump("month");
      if (createdAt >= startOfWeek) bump("week");
      if (createdAt >= startOfDay) bump("day");
    }

    const natureTotals = Array.from(natureCounts.entries())
      .map(([nature, counts]) => ({ nature, ...counts }))
      .sort((a, b) => b.allTime - a.allTime);

    // 🔹 Targets — a goal a superadmin set for a user over a period, scoped
    // to whichever sections they chose. Progress only counts entries of
    // those specific types, not the user's total across everything.
    const targets = await Target.find().sort({ createdAt: -1 }).lean();
    const targetsWithProgress = targets.map((t) => {
      const typeMap = userTypeCounts.get(t.username) || {};
      const sections = Array.isArray(t.sections) && t.sections.length > 0 ? t.sections : SECTION_TYPES;
      const actual = sections.reduce((sum, type) => sum + ((typeMap[type] || emptyPeriodCounts())[t.period] || 0), 0);
      const progress = t.goal > 0 ? Math.round((actual / t.goal) * 100) : 0;
      return {
        _id: t._id,
        username: t.username,
        period: t.period,
        goal: t.goal,
        sections,
        actual,
        progress,
        completed: actual >= t.goal,
        createdBy: t.createdBy,
        createdAt: t.createdAt,
      };
    });

    res.json({ sectionTotals, userTotals, leaders, natureTotals, targets: targetsWithProgress, generatedAt: new Date() });
  } catch (err) {
    console.error("❌ Error building analysis:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// 🔹 Create a new target for a user + period, scoped to one or more
// sections (e.g. only Spot Checks, or Off-Site + On-Site Inspections
// together). Multiple targets can coexist for the same user + period as
// long as their section scopes differ.
router.put("/targets", async (req, res) => {
  try {
    const { username, period, goal, sections } = req.body;
    const validSections = Array.isArray(sections) && sections.length > 0 && sections.every((s) => SECTION_TYPES.includes(s));
    if (!username || !["day", "week", "month", "year"].includes(period) || !(Number(goal) > 0) || !validSections) {
      return res.status(400).json({ error: "username, period, a positive goal, and at least one section are required" });
    }

    const target = await Target.create({
      username,
      period,
      goal: Number(goal),
      sections,
      createdBy: req.session.user.username,
    });

    // Let the user know via Minutes — best-effort, a messaging hiccup
    // shouldn't fail the target-setting request itself.
    try {
      const sectionsText = sections.map((s) => SECTION_LABELS[s] || s).join(", ");
      await sendSystemMessage({
        from: req.session.user.username,
        to: username,
        text: `🎯 New target set for you: ${goal} ${sectionsText} entr${Number(goal) === 1 ? "y" : "ies"} ${PERIOD_PHRASES[period]}.`,
        fromIsOwner: !!req.session.user.isOwner,
      });
    } catch (msgErr) {
      console.error("❌ Failed to send target notification:", msgErr);
    }

    res.status(201).json(target);
  } catch (err) {
    console.error("❌ Error setting target:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// 🔹 Remove a target.
router.delete("/targets/:id", async (req, res) => {
  try {
    const target = await Target.findByIdAndDelete(req.params.id);
    if (!target) return res.status(404).json({ error: "Target not found" });
    res.json({ message: "Target deleted" });
  } catch (err) {
    console.error("❌ Error deleting target:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
