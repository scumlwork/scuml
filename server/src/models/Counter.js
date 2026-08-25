// server/src/models/Counter.js
// Backs sequential, gap-free numbering (e.g. registration serial numbers) via
// atomic $inc — safer under concurrent writes than counting existing docs.
import mongoose from "mongoose";

const CounterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

export default mongoose.models.Counter || mongoose.model("Counter", CounterSchema);
