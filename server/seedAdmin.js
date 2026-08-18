// seedAdmin.js
import dotenv from "dotenv";
import mongoose from "mongoose";
import User from "./src/models/User.js"; // adjust path if needed

dotenv.config();

async function seedAdmin() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Read from env instead of hardcoding a real credential in a file that
    // sits on disk (and could end up in a backup, screenshot, or repo).
    const username = process.env.SEED_ADMIN_USERNAME;
    const password = process.env.SEED_ADMIN_PASSWORD;
    if (!username || !password) {
      console.error("❌ Set SEED_ADMIN_USERNAME and SEED_ADMIN_PASSWORD before running this script.");
      process.exit(1);
    }

    // check if admin already exists
    const existing = await User.findOne({ username });
    if (existing) {
      console.log("⚠️ Admin already exists. Aborting.");
      process.exit(0);
    }

    // create new admin
    const admin = new User({
      username,
      role: "superadmin",
    });

    await admin.setPassword(password); // use your User model's password hashing
    await admin.save();

    console.log(`🎉 Admin created:
      username: ${username}
      password: ${password}  (please change on first login!)
    `);

    process.exit(0);
  } catch (err) {
    console.error("❌ Error seeding admin:", err);
    process.exit(1);
  }
}

seedAdmin();
