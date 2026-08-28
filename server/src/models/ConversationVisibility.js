// server/src/models/ConversationVisibility.js
// The owner account (isOwner: true on User — durable regardless of
// username changes) is invisible in chat by default. Sending a message to
// someone makes the owner visible to that specific person; explicitly
// closing the chat hides the owner from them again. Directional: only
// affects how the *other* party sees the owner, never the owner's own
// view of their own conversation history.
import mongoose from "mongoose";

const ConversationVisibilitySchema = new mongoose.Schema(
  {
    ownerUsername: { type: String, required: true },
    otherUsername: { type: String, required: true },
    visible: { type: Boolean, default: false },
  },
  { timestamps: true }
);

ConversationVisibilitySchema.index({ ownerUsername: 1, otherUsername: 1 }, { unique: true });

export default mongoose.models.ConversationVisibility ||
  mongoose.model("ConversationVisibility", ConversationVisibilitySchema);
