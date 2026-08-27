// server/src/models/GeneratedLetter.js
// A record of every "Initiate Letters" document actually generated for a
// company (Letter of Invitation / Warning Letter) — this is metadata only
// (no PDF is stored server-side; the document itself is generated on the
// fly in the browser and shared/downloaded from there), kept so the event
// shows up on the company's Compliance Record and in Recent Activity, the
// same as every other record type.
import mongoose from "mongoose";

const GeneratedLetterSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Registration", required: true },
    letterType: { type: String, required: true }, // "Letter of Invitation" | "Warning Letter"
    title: { type: String, default: "" },
    reportingDate: { type: String, default: "" },
    refNumber: { type: String, default: "" },
    generatedBy: { type: String, default: "" }, // username who generated it
  },
  { timestamps: true }
);

export default mongoose.models.GeneratedLetter ||
  mongoose.model("GeneratedLetter", GeneratedLetterSchema);
