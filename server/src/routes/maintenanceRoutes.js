// server/src/routes/maintenanceRoutes.js
// Machine-to-machine maintenance endpoints — triggered by an external
// scheduler (cron-job.org, matching how this project's keep-alive ping
// works), not by a logged-in browser session. Auth is a shared secret
// header instead of the usual session cookie, since a cron service can't
// hold one.
import express from "express";
import { cleanupGeneratedLetters } from "../utils/cleanupGeneratedLetters.js";

const router = express.Router();

function requireCleanupSecret(req, res, next) {
  const provided = req.headers["x-cleanup-secret"];
  const expected = process.env.CLEANUP_SECRET;
  if (!expected) {
    return res.status(503).json({ error: "CLEANUP_SECRET not configured" });
  }
  if (provided !== expected) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

// GET (not POST) so this isn't caught by CSRF protection — there's no
// browser session here for csurf to check a token against.
router.get("/cleanup-generated-letters", requireCleanupSecret, async (req, res) => {
  try {
    const result = await cleanupGeneratedLetters();
    console.log(
      `🧹 Generated-letters cleanup: scanned ${result.scanned}, deleted ${result.deleted} (older than ${result.olderThanDays} days).`
    );
    res.json(result);
  } catch (err) {
    console.error("❌ Generated-letters cleanup failed:", err);
    res.status(500).json({ error: "Cleanup failed" });
  }
});

export default router;
