// server/src/utils/cleanupGeneratedLetters.js
// Generated letter PDFs (Initiate Letters -> Share) are hosted on Cloudinary
// purely so they have a real, shareable download link — they aren't meant
// to be kept forever. This deletes ones older than 30 days so the
// scuml-generated-letters/ folder doesn't grow unbounded and eat into the
// account's storage quota.
import cloudinary from "../config/cloudinary.js";

const FOLDER = "scuml-generated-letters";
const MAX_AGE_DAYS = 30;

export async function cleanupGeneratedLetters() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - MAX_AGE_DAYS);

  let deleted = 0;
  let scanned = 0;
  let nextCursor;

  do {
    const res = await cloudinary.api.resources({
      type: "upload",
      resource_type: "image", // letters are uploaded as resource_type "image" (see letterRoutes.js) to get past Cloudinary's raw/PDF delivery restriction
      prefix: `${FOLDER}/`,
      max_results: 500,
      next_cursor: nextCursor,
    });

    scanned += res.resources.length;
    const stale = res.resources.filter((r) => new Date(r.created_at) < cutoff);

    if (stale.length > 0) {
      await cloudinary.api.delete_resources(
        stale.map((r) => r.public_id),
        { resource_type: "image" }
      );
      deleted += stale.length;
    }

    nextCursor = res.next_cursor;
  } while (nextCursor);

  return { scanned, deleted, olderThanDays: MAX_AGE_DAYS };
}
