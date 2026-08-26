// server/src/models/RecentActivity.js
// A feed of newly-created records across every section, for the superadmin
// "Recent Activity" page — separate from the underlying record itself, so
// dismissing ("closing") an entry here doesn't touch the real data.
import mongoose from "mongoose";

const RecentActivitySchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["identification", "action", "sanction", "violation", "training", "onsite", "offsite"],
      required: true,
    },
    refId: { type: mongoose.Schema.Types.ObjectId, required: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Registration" },
    companyName: { type: String, default: "" },
    summary: { type: String, default: "" },
    createdBy: { type: String, default: "" },
    dismissed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.models.RecentActivity ||
  mongoose.model("RecentActivity", RecentActivitySchema);
