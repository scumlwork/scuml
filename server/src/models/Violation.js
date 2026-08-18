// server/src/models/Violation.js
import mongoose from "mongoose";

const PaymentSchema = new mongoose.Schema(
  {
    amount: { type: Number, required: true },
    date: { type: Date, default: Date.now },
    enteredBy: { type: String, default: "" }, // username who recorded this specific payment
  },
  { _id: false }
);

const ViolationSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Registration", required: true },
    amountSanctioned: { type: Number, required: true },
    amountPaid: { type: Number, required: true, default: 0 },
    // Individual payment history — amountPaid is kept as the running total for
    // balance math, payments is kept so each part-payment can be displayed
    // and dated as its own entry.
    payments: { type: [PaymentSchema], default: [] },
    createdBy: { type: String, default: "" }, // store username who created this entry
  },
  { timestamps: true }
);

export default mongoose.models.Violation || mongoose.model("Violation", ViolationSchema);
