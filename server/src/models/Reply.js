// server/src/models/Reply.js
// "Reply" — a formal outgoing EFCC/SCUML letter, independent of any
// registered company and entirely separate from the "My Memo" feature
// (own collection, own routes, own pages). No PDF is stored server-side
// (generated client-side); this is just the metadata + message content,
// shown on the home page, the Admin page, and Recent Activity.
import mongoose from "mongoose";

const ReplySchema = new mongoose.Schema(
  {
    title: { type: String, default: "" }, // addressee title, e.g. "THE DIRECTOR"
    refNo: { type: String, default: "" }, // reference number, shown above the title on the generated letter
    date: { type: String, default: "" },
    address: { type: String, default: "" }, // manually entered recipient address
    to: { type: String, default: "" }, // recipient email — used when sending via email
    subject: { type: String, default: "" },
    message: { type: String, default: "" },
    createdBy: { type: String, default: "" },
  },
  { timestamps: true }
);

export default mongoose.models.Reply || mongoose.model("Reply", ReplySchema);
