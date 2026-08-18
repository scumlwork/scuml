// server/src/models/Letter.js
import mongoose from "mongoose";

const LetterSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Registration", required: true },
    tag: { type: String }, // e.g. "Letter 1"
    typeOfLetter: { type: String, required: true },
    receiverName: String,
    phone: String,
    email: String,
    dateOfReporting: String,
    createdBy: { type: String, default: "" }, // store username who created this entry
  },
  { timestamps: true }
);

export default mongoose.models.Letter || mongoose.model("Letter", LetterSchema);
