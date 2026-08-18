// server/src/middleware/sanitize.js
// Strips MongoDB operator keys ("$...") and prototype-pollution keys
// (__proto__, constructor, prototype) from req.body/query/params so a client
// can never smuggle an update operator (e.g. {"$unset":{"field":1}}) or a
// query operator (e.g. {"$ne": null}) into a place a plain value is expected.
import { recordAuditEvent } from "../utils/auditLogger.js";

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

const BLOCKED_KEYS = new Set(["__proto__", "constructor", "prototype"]);

// `flags` is a shared mutable object the caller inspects afterward — every
// legitimate field name in this app is a plain identifier, so any $-prefixed
// or prototype-pollution key found here is inherently a NoSQL/injection
// probe, not a false positive from normal use.
function clean(value, flags) {
  if (Array.isArray(value)) {
    return value.map((v) => clean(v, flags));
  }
  if (isPlainObject(value)) {
    const out = {};
    for (const [key, val] of Object.entries(value)) {
      if (key.startsWith("$") || BLOCKED_KEYS.has(key)) {
        flags.stripped = true;
        continue;
      }
      out[key] = clean(val, flags);
    }
    return out;
  }
  return value;
}

export default function sanitizeInput(req, _res, next) {
  const flags = { stripped: false };
  if (req.body) req.body = clean(req.body, flags);
  if (req.query) req.query = clean(req.query, flags);
  if (req.params) req.params = clean(req.params, flags);

  if (flags.stripped) {
    const attemptedUsername = typeof req.body?.username === "string" ? req.body.username : "";
    recordAuditEvent(req, "injection_attempt", attemptedUsername);
  }

  next();
}
