// server/src/models/ConversationPin.js
// A conversation's *existence* in someone's Conversations list, kept
// separate from its message content. Created (for both participants) the
// moment a message is first sent between them. Clearing a chat deletes its
// messages but leaves the pin — the conversation still shows, just empty.
// Deleting a chat removes both the messages and the pins, so it disappears
// from the list until a fresh message starts it again.
import mongoose from "mongoose";

const ConversationPinSchema = new mongoose.Schema(
  {
    ownerUsername: { type: String, required: true }, // whose Conversations list this appears in
    otherUsername: { type: String, required: true },
  },
  { timestamps: true }
);

ConversationPinSchema.index({ ownerUsername: 1, otherUsername: 1 }, { unique: true });

export default mongoose.models.ConversationPin ||
  mongoose.model("ConversationPin", ConversationPinSchema);
