import mongoose from "mongoose";

const TrainingSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Registration", required: true },

    // Training Details
    topic: { type: String, required: true },          // What the training was about
    date: { type: String, required: true },           // Date of training
    facilitator: { type: String, required: true },    // Who delivered the training
    participants: { type: Number, required: true },   // Number of attendees
    createdBy: { type: String, required: true },      // Officer entering the record
  },
  { timestamps: true }
);

export default mongoose.model("Training", TrainingSchema);
