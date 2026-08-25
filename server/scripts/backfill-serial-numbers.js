// server/scripts/backfill-serial-numbers.js
// One-off: assigns sequential serial numbers (0001, 0002, ...) to existing
// registrations, ordered by creation date, and sets the Counter so future
// registrations continue from there.
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();
import Registration from "../src/models/Registration.js";
import Counter from "../src/models/Counter.js";

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to mongo. Backfilling serial numbers...");

  const regs = await Registration.find({
    $or: [{ serialNumber: { $exists: false } }, { serialNumber: "" }],
  }).sort({ createdAt: 1 });

  let seq = (await Counter.findById("registrationSerial"))?.seq || 0;

  for (const reg of regs) {
    seq += 1;
    const serialNumber = String(seq).padStart(4, "0");
    // Direct update, not .save() — old docs predate required fields like
    // companySize and would otherwise fail full-document validation.
    await Registration.updateOne({ _id: reg._id }, { $set: { serialNumber } });
    console.log(`  ${serialNumber} -> ${reg.companyName}`);
  }

  await Counter.findByIdAndUpdate(
    "registrationSerial",
    { $set: { seq } },
    { upsert: true }
  );

  console.log(`Done. Backfilled ${regs.length} registrations. Counter set to ${seq}.`);
  await mongoose.disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
