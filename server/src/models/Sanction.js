// server/src/models/Sanction.js
import mongoose from "mongoose";

const SanctionSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Registration", required: true },
    natureOfBusiness: { type: String, required: true },
    amount: { type: Number, required: true },
    modeOfPayment: { type: String, enum: ["Cash", "Bank Transfer", "Bank Draft"], required: true },
    receiptUrl: { type: String, default: "" }, // admin-only: uploaded payment receipt
    createdBy: { type: String, default: "" }, // store username who created this entry
  },
  { timestamps: true }
);

export default mongoose.models.Sanction || mongoose.model("Sanction", SanctionSchema);
