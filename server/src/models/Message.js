// server/src/models/Message.js
// Internal chat between a superadmin and any other user account. A
// superadmin can message anyone; a staff/guest user can only message a
// superadmin (never each other) — enforced in messageRoutes.js, not here.
// Optionally carries a reference to the record (Identification, Action,
// Sanction, Violation, Training, or Inspection) the chat was opened from,
// so the conversation stays tied to the context it started in.
import mongoose from "mongoose";

const MessageSchema = new mongoose.Schema(
  {
    from: { type: String, required: true }, // username
    to: { type: String, required: true }, // username
    text: { type: String, required: true, trim: true, maxlength: 4000 },
    read: { type: Boolean, default: false },
    referencedEntry: {
      type: {
        type: String,
        enum: [
          "identification",
          "action",
          "sanction",
          "violation",
          "training",
          "onsite",
          "offsite",
          "generatedLetter",
          "spotcheck",
          "memo",
        ],
      },
      refId: { type: mongoose.Schema.Types.ObjectId },
      companyId: { type: mongoose.Schema.Types.ObjectId },
      companyName: { type: String, default: "" },
      summary: { type: String, default: "" },
    },
  },
  { timestamps: true }
);

// Every conversation-thread lookup filters by these two fields together.
MessageSchema.index({ from: 1, to: 1, createdAt: 1 });
MessageSchema.index({ to: 1, read: 1 });

export default mongoose.models.Message || mongoose.model("Message", MessageSchema);
