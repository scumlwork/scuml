// server/src/models/Target.js
// A work-rate goal a superadmin sets for a user over a given period, scoped
// to whichever record types (sections) they choose — e.g. "SERAH: 20 Spot
// Checks + Off-Site Inspections this month". Progress against it is
// computed live in analysisRoutes.js from the same Recent Activity feed
// the KPI table already reads, rather than stored here.
import mongoose from "mongoose";

const SECTION_TYPES = [
  "identification", "action", "sanction", "violation", "training",
  "onsite", "offsite", "generatedLetter", "spotcheck", "memo", "reply",
];

const TargetSchema = new mongoose.Schema(
  {
    username: { type: String, required: true },
    period: { type: String, enum: ["day", "week", "month", "year"], required: true },
    goal: { type: Number, required: true, min: 1 },
    // Which record types count toward this target — one, several, or all
    // of them. Never empty: a target with no sections couldn't ever
    // accumulate any progress.
    sections: {
      type: [{ type: String, enum: SECTION_TYPES }],
      required: true,
      validate: {
        validator: (v) => Array.isArray(v) && v.length > 0,
        message: "Select at least one section",
      },
    },
    createdBy: { type: String, default: "" },
  },
  { timestamps: true }
);

// Multiple targets can exist for the same user + period as long as they
// cover different sections (e.g. one for Spot Checks, another for
// Off-Site Inspections) — no uniqueness constraint needed beyond that.

export default mongoose.models.Target || mongoose.model("Target", TargetSchema);
