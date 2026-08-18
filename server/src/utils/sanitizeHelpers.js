// server/src/utils/sanitizeHelpers.js

// Escapes regex metacharacters so a search string is matched literally.
// Also caps length — an unescaped, unbounded pattern from user input is both
// a NoSQL-injection and a ReDoS (catastrophic backtracking) vector.
export function escapeRegex(str) {
  return String(str || "")
    .slice(0, 100)
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Strips fields a client should never be able to set directly on an update —
// identity/audit metadata and relationship keys that only the server (or a
// dedicated endpoint, e.g. Violation's /pay route) should control.
const PROTECTED_FIELDS = ["_id", "__v", "company", "createdAt", "updatedAt", "createdBy"];
export function omitProtectedFields(body) {
  const out = { ...(body || {}) };
  for (const key of PROTECTED_FIELDS) delete out[key];
  return out;
}
