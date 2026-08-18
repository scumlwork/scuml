// server/scripts/migrate-createdBy.js
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();
import Registration from "../src/models/Registration.js";

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to mongo. Updating registrations without createdBy...");

  const res = await Registration.updateMany(
    { $or: [{ createdBy: { $exists: false } }, { createdBy: "" }] },
    { $set: { createdBy: "imported" } }
  );

  console.log("Updated:", res.modifiedCount);
  await mongoose.disconnect();
  console.log("Done.");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
