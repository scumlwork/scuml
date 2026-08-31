// server/src/utils/sendSystemMessage.js
// Sends a message the same way the chat's own POST /api/messages route
// does — pinning the conversation for both sides (so it shows up in each
// person's Minutes list) and, if the sender is the owner account, making
// them visible to the recipient. Used for system-generated notifications
// (e.g. "a target was set for you") so they behave identically to a
// message someone typed by hand, rather than silently missing from the
// conversation list.
import Message from "../models/Message.js";
import ConversationPin from "../models/ConversationPin.js";
import ConversationVisibility from "../models/ConversationVisibility.js";

export async function sendSystemMessage({ from, to, text, fromIsOwner = false }) {
  if (!from || !to || from === to) return null; // no self-notifications

  const message = await Message.create({ from, to, text });

  await Promise.all([
    ConversationPin.updateOne(
      { ownerUsername: from, otherUsername: to },
      { $setOnInsert: { ownerUsername: from, otherUsername: to } },
      { upsert: true }
    ),
    ConversationPin.updateOne(
      { ownerUsername: to, otherUsername: from },
      { $setOnInsert: { ownerUsername: to, otherUsername: from } },
      { upsert: true }
    ),
  ]);

  if (fromIsOwner) {
    await ConversationVisibility.updateOne(
      { ownerUsername: from, otherUsername: to },
      { $set: { visible: true } },
      { upsert: true }
    );
  }

  return message;
}
