// server/src/utils/auditLogger.js
import geoip from "geoip-lite";
import AuditLog from "../models/AuditLog.js";

function clientIp(req) {
  // trust proxy is enabled in server.js, so req.ip already accounts for
  // X-Forwarded-For when behind a real proxy; strip the IPv6-mapped prefix
  // localhost/dev traffic commonly shows up with (::ffff:127.0.0.1).
  return (req.ip || "").replace(/^::ffff:/, "");
}

function locationFor(ip) {
  const geo = geoip.lookup(ip);
  if (!geo) return "Local/Unknown";
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
