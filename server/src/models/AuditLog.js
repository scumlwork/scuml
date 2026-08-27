// server/src/models/AuditLog.js
import mongoose from "mongoose";

const AuditLogSchema = new mongoose.Schema(
  {
    eventType: {
      type: String,
      enum: [
        "login_success",
        "login_failed",
        "brute_force_lockout",
        "totp_failed",
        "injection_attempt",
        "malware_blocked",
      ],
      required: true,
    },
    username: { type: String, default: "" }, // attempted or actual username
    ip: { type: String, default: "" },
    location: { type: String, default: "" }, // e.g. "City, Region, Country"
    userAgent: { type: String, default: "" },
    deviceType: { type: String, default: "" }, // "Phone" | "Tablet" | "Laptop/Desktop" | "Unknown"
  },
  { timestamps: true }
);

export default mongoose.model("AuditLog", AuditLogSchema);
