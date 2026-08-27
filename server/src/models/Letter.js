// server/src/models/Letter.js
import mongoose from "mongoose";

const LetterSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Registration", required: true },
    tag: { type: String }, // e.g. "Letter 1"
    typeOfLetter: { type: String, default: "" },
    // Legacy single-contact fields — kept for old records and simple
    // consumers, mirrored from contacts[0] on every save.
    receiverName: String,
    phone: String,
    email: String,
    // Support recording more than one contact person per action.
    contacts: {
      type: [
        {
          name: { type: String, required: true },
          position: { type: String, default: "" },
          phone: { type: String, required: true },
          email: { type: String, default: "" },
        },
      ],
      default: [],
    },
    remark: { type: String, default: "" },
    photos: { type: [String], default: [] },
    dateOfReporting: String,
    createdBy: { type: String, default: "" }, // store username who created this entry
  },
  { timestamps: true }
);

export default mongoose.models.Letter || mongoose.model("Letter", LetterSchema);
