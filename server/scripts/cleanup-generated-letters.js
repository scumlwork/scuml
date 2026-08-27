// server/scripts/cleanup-generated-letters.js
// Manual/local runner for the monthly generated-letters cleanup — the same
// logic the scheduled HTTP endpoint runs, for testing or a one-off run.
import dotenv from "dotenv";
dotenv.config();
import { cleanupGeneratedLetters } from "../src/utils/cleanupGeneratedLetters.js";

cleanupGeneratedLetters()
  .then((result) => {
    console.log(
      `Scanned ${result.scanned} generated letter(s), deleted ${result.deleted} older than ${result.olderThanDays} days.`
    );
  })
  .catch((err) => {
    console.error("Cleanup failed:", err);
    process.exit(1);
  });
