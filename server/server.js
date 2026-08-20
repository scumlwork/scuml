// server.js
import dotenv from "dotenv";
dotenv.config(); // ✅ load env before anything else

import path from "path";
import { fileURLToPath } from "url";
import { createServer } from "http";
import express from "express";
import session from "express-session";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import MongoStore from "connect-mongo";
import cors from "cors";
import csurf from "csurf";
// 🔸 Google Authenticator (TOTP) disabled — kept for possible future re-enable
// import speakeasy from "speakeasy"; // 🔹 NEW: For Google Authenticator

import connectDB from "./src/config/db.js";
import harden from "./src/security/harden.js";
import authRoutes from "./src/routes/auth.js";
import userRoutes from "./src/routes/user.js";
import registrationRoutes from "./src/routes/registrationRoutes.js";
import letterRoutes from "./src/routes/letterRoutes.js";
import sanctionRoutes from "./src/routes/sanctionRoutes.js";
import adminRoutes from "./src/routes/adminRoutes.js";
import offsiteInspectionRoutes from "./src/routes/offsiteInspection.js";
import onSiteInspectionRoutes from "./src/routes/onSiteInspectionRoutes.js"; // ✅ add
import trainingRoutes from "./src/routes/trainingRoutes.js";                 // ✅ add
import violationRoutes from "./src/routes/violationRoutes.js";
import userManagementRoutes from "./src/routes/userManagement.js";
import auditLogRoutes from "./src/routes/auditLogRoutes.js";
import sanitizeInput from "./src/middleware/sanitize.js";








// ✅ Fix __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

await connectDB();

const app = express();






const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
const isProd = process.env.NODE_ENV === "production";

// Fail fast instead of silently signing sessions with a well-known default
// secret — a missing SESSION_SECRET should stop the server, not run it with
// a value an attacker can find by reading this file.
if (!process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET missing — set it in .env before starting the server");
}

app.use(
  cors({
    origin: (origin, callback) => {
      const allowed = [
        process.env.FRONTEND_URL?.replace(/\/$/, ""), // strip trailing slash
        "http://localhost:3000",
      ];

      // allow same-origin (no origin header, like curl/Postman)
      if (!origin) return callback(null, true);

      // ✅ allow localhost + any *.ngrok-free.app subdomain — anchored regex,
      // not endsWith(), so a domain like "evilngrok-free.app" can't pass by
      // just happening to end with the same substring.
      const isNgrokSubdomain = /^https:\/\/[a-z0-9-]+\.ngrok-free\.app$/i.test(origin);
      if (allowed.includes(origin) || isNgrokSubdomain) {
        return callback(null, true);
      }

      console.error("Blocked by CORS:", origin);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "CSRF-Token",
      "X-CSRF-Token",
    ],
    exposedHeaders: ["CSRF-Token", "X-CSRF-Token"],
  })
);


// Basic middleware
// `true` rather than a fixed hop count (1) — Render's exact proxy chain
// depth isn't something this app controls, and getting that number wrong
// silently breaks secure-cookie detection and req.ip. There's no untrusted
// intermediary to worry about spoofing X-Forwarded-* here; Render's edge is
// the only entry point.
app.set("trust proxy", true);
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: false, limit: "100kb" }));
app.use(sanitizeInput); // strip $-operators / prototype-pollution keys from all input
app.use(cookieParser());
app.use(morgan("tiny"));

// Security hardening
harden(app);


// --- Sessions (must come BEFORE CSRF) ---
// --- Sessions ---
// Normal user sessions — 5 hours of INACTIVITY, not 5 hours from login.
// `rolling: true` re-issues the cookie (and connect-mongo re-touches the
// store record, sliding its TTL) on every authenticated request, so the
// session only actually expires after 5 hours with no requests at all.
// Plain "lax" works everywhere now — frontend and backend are both
// subdomains of the same parent (myscumlwork.me / api.myscumlwork.me in
// production, "localhost" in dev), which browsers treat as the same "site"
// regardless of subdomain, so cross-subdomain fetch/XHR still sends the
// cookie. This used to need SameSite=None (and its required secure:true)
// back when frontend and backend were on two unrelated *.onrender.com
// hosts — that's what broke iOS Safari, which blocks cross-site cookies
// even with None set. Same-parent-domain subdomains sidestep the problem
// entirely instead of working around it.
const SESSION_IDLE_TIMEOUT_MS = 1000 * 60 * 60 * 5; // 5 hours
const userSession = session({
  name: process.env.SESSION_NAME || "scuml.sid",
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  store: MongoStore.create({
    mongoUrl: process.env.MONGO_URI,
    collectionName: "sessions",
    ttl: SESSION_IDLE_TIMEOUT_MS / 1000,
  }),
  cookie: {
    httpOnly: true,
    secure: isProd, // HTTPS-only once actually deployed behind TLS
    sameSite: "lax",
    maxAge: SESSION_IDLE_TIMEOUT_MS,
  },
});

// Admin sessions (15m) — currently unused (TOTP moved to login-time, see
// server.js's commented-out admin block), left configured consistently in
// case it's ever reactivated.
const adminSession = session({
  name: "scuml.admin.sid", // 👈 different cookie
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGO_URI,
    collectionName: "adminSessions",
    ttl: 60 * 60 * 2, // 2 hours
  }),
  cookie: {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    maxAge: 1000 * 60 * 60 * 2, // 2 hours
  },
});





// --- CSRF: cookie-based ---
const csrfProtection = csurf({
  cookie: {
    key: "scuml.csrf",
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
  },
});

// Attach CSRF globally
app.use(csrfProtection);

// Public endpoint to fetch CSRF token
app.get("/api/csrf-token", (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});




// ✅ Apply user sessions to normal routes
app.use("/api/auth", userSession, authRoutes);
app.use("/api/user", userSession, userRoutes);
app.use("/api/registrations", userSession, registrationRoutes);
app.use("/api/letters", userSession, letterRoutes);
app.use("/api/sanctions", userSession, sanctionRoutes);
app.use("/api/offsite-inspections", userSession, offsiteInspectionRoutes);
app.use("/api/on-site-inspections", userSession, onSiteInspectionRoutes); // ✅ mount
app.use("/api/trainings", userSession, trainingRoutes);                   // ✅ mount
app.use("/api/violations", userSession, violationRoutes);
app.use("/api/users", userSession, userManagementRoutes);
app.use("/api/audit-log", userSession, auditLogRoutes);

// ✅ Admin routes now gated by superadmin role (userSession) since TOTP is disabled
app.use("/api/admin", userSession, adminRoutes);












// Health check
app.get("/api/health", (_req, res) => res.json({ ok: true, ts: Date.now() }));





/* ----------------- 🔸 Google Authenticator (TOTP) — DISABLED -----------
   Commented out per request. Left intact (not deleted) so it can be
   re-enabled later if needed. Superadmin role-check is now the sole gate
   for /database and /register on the frontend.

// ✅ admin login (TOTP)
app.post("/api/admin/verify-totp", adminSession, (req, res) => {
  const { code } = req.body;

  const verified = speakeasy.totp.verify({
    secret: process.env.ADMIN_TOTP_SECRET,
    encoding: "base32",
    token: code,
    window: 2,
  });

  if (!verified) return res.status(403).json({ error: "Invalid code" });

  req.session.isAdmin = true; // 🔐 mark admin logged in
  console.log("🔐 Admin session set:", req.session.id);

  res.json({ success: true });
});

// ✅ protected admin route
app.get("/api/admin/protected/register", adminSession, requireAdmin, (req, res) => {
  res.json({ message: "✅ Admin access granted to register page" });
});


// Middleware to protect register
function requireAdmin(req, res, next) {
  if (req.session.isAdmin) return next();
  return res.status(401).json({ message: "Not authorized" });
}

------------------------------------------------------------------------ */

// CSRF error handler
app.use((err, req, res, next) => {
  if (err.code === "EBADCSRFTOKEN") {
    return res.status(403).json({ error: "Invalid CSRF token" });
  }
  return next(err);
});

// 404
app.use((req, res) => res.status(404).json({ error: "Not found" }));

// 🔹 Global error handler (this will catch your upload errors too)
app.use((err, req, res, next) => {
  console.error("🔥 Global error handler:", err.stack || err);
  res.status(500).json({
    error: err.message || "Server error",
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });
});

const PORT = process.env.PORT || 5000;
createServer(app).listen(PORT, () =>
  console.log(`SCUML API listening on :${PORT}`)
);
