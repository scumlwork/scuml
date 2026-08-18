// server/src/utils/auditLogger.js
import geoip from "geoip-lite";
import AuditLog from "../models/AuditLog.js";

function clientIp(req) {
  // Parse X-Forwarded-For directly instead of relying solely on req.ip —
  // Express's trust-proxy hop counting has to exactly match how many proxy
  // layers actually sit in front of the app, and getting that wrong on a
  // platform like Render silently resolves req.ip to an internal proxy
  // address instead of the real visitor, which is unroutable and always
  // geolocates to nothing. The header's leftmost entry is the original
  // client by convention, regardless of hop count.
  const forwarded = req.headers["x-forwarded-for"];
  const ip = forwarded ? forwarded.split(",")[0].trim() : req.ip;
  // Local/dev traffic commonly shows up as an IPv6-mapped IPv4 address
  // (::ffff:127.0.0.1) — strip the prefix so it reads as plain IPv4.
  return (ip || "").replace(/^::ffff:/, "");
}

// Private/loopback ranges — geoip-lite can never resolve these (they're not
// publicly routable), so they get their own label instead of being lumped in
// with "a real public IP that just has no geo match" (a genuinely rare case).
const PRIVATE_IP_RE = /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1$|fc|fd)/i;

function locationFor(ip) {
  if (!ip || PRIVATE_IP_RE.test(ip)) return "Local";
  const geo = geoip.lookup(ip);
  if (!geo) return "Unknown";
  const parts = [geo.city, geo.region, geo.country].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "Unknown";
}

// Fire-and-forget — an audit write should never block or fail the request
// it's describing.
export function recordAuditEvent(req, eventType, username = "") {
  const ip = clientIp(req);
  AuditLog.create({
    eventType,
    username,
    ip,
    location: locationFor(ip),
    userAgent: req.headers["user-agent"] || "",
  }).catch((err) => console.error("❌ Failed to write audit log entry:", err));
}
