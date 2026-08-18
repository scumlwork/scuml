// server/src/routes/adminRoutes.js
import express from "express";
import Registration from "../models/Registration.js";
import Letter from "../models/Letter.js";
import Sanction from "../models/Sanction.js";
import OffSiteInspection from "../models/OffSiteInspection.js";
import OnSiteInspection from "../models/OnSiteInspection.js";
import Training from "../models/Training.js";
import Violation from "../models/Violation.js";

const router = express.Router();

// 🔸 TOTP disabled — now gated by the regular userSession + superadmin role
// instead of req.session.isAdmin (which was only ever set via TOTP verify).
function requireAdminSession(req, res, next) {
  if (req.session?.user?.role === "superadmin") return next();
  return res.status(401).json({ error: "Not authorized" });
}

// 🔹 Clear all records
router.delete("/clear-all", requireAdminSession, async (req, res) => {
  try {
    await Promise.all([
      Registration.deleteMany({}),
      Letter.deleteMany({}),
      Sanction.deleteMany({}),
      OffSiteInspection.deleteMany({}),
      OnSiteInspection.deleteMany({}),
      Training.deleteMany({}),
      Violation.deleteMany({}),
    ]);

    res.json({ message: "All records cleared successfully" });
  } catch (err) {
    console.error("❌ Error clearing all:", err);
    res.status(500).json({ error: "Failed to clear records" });
  }
});

export default router;
