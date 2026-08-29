// server/src/models/Memo.js
// "My Memo" — an internal EFCC/SCUML memorandum, independent of any
// company. No PDF is stored server-side (generated client-side); this is
// just the metadata + message content, shown on the home page, the Admin
// page, and Recent Activity.
import mongoose from "mongoose";

const MemoSchema = new mongoose.Schema(
  {
    to: { type: String, default: "" },
    through: { type: String, default: "" },
    from: { type: String, default: "" },
    date: { type: String, default: "" },
    refNo: { type: String, default: "" },
    subject: { type: String, default: "" },
    message: { type: String, default: "" },
    createdBy: { type: String, default: "" },
  },
  { timestamps: true }
);

export default mongoose.models.Memo || mongoose.model("Memo", MemoSchema);
