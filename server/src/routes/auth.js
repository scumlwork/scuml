// src/routes/auth.js (ESM)
import express from 'express';
import { body, validationResult } from 'express-validator';
import rateLimit from 'express-rate-limit';
import speakeasy from 'speakeasy';
import qrcode from 'qrcode';
import User from '../models/User.js';
import { validatePasswordStrength } from '../utils/passwordRules.js';
import { recordAuditEvent } from '../utils/auditLogger.js';

const router = express.Router();

// A broad, network-level abuse backstop — NOT the "3 tries then locked"
// control (that's the per-account failedLogin counter below, keyed per user
// so one account's bad attempts can't affect another). This is IP-keyed and
// shared across /login and /verify-totp-login, so a real superadmin login
// (password request + TOTP request) already spends 2 of whatever budget is
// set here; keep it generous or a busy shared network (or one person retrying
// a couple of different accounts) trips it long before any single account
// would ever hit its own 3-attempt lockout.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: 'Too many login attempts from this network. Try again in 15 minutes.' },
});
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
});

// GET current user
router.get('/me', (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: 'Not authenticated' });
  return res.json(req.session.user);
});

// Self-service 2FA enrollment — lets a superadmin created *before* TOTP was
// wired into registration (or anyone wanting to re-pair a new phone) set up
// Google Authenticator on their own account. Only ever acts on the caller's
// own account, never another user's.
router.post('/totp-setup', registerLimiter, async (req, res) => {
  try {
    if (req.session?.user?.role !== 'superadmin') {
      return res.status(403).json({ error: 'Two-factor setup is only for super admin accounts' });
    }

    const user = await User.findById(req.session.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const secret = speakeasy.generateSecret({
      name: `SCUML (${user.username})`,
      length: 20,
    });
    user.totpSecret = secret.base32;
    await user.save();

    const qrCodeDataUrl = await qrcode.toDataURL(secret.otpauth_url);
    return res.json({ qrCodeDataUrl, manualEntryKey: secret.base32 });
  } catch (err) {
    console.error('TOTP setup error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Register — only an authenticated superadmin may create new accounts
router.post(
  '/register',
  registerLimiter,
  [
    body('username').isString().isLength({ min: 3, max: 64 }).trim().escape(),
    body('password').isString(),
    body('role').optional().isIn(['superadmin', 'staff', 'guest']),
  ],
  async (req, res) => {
    try {
      if (req.session?.user?.role !== 'superadmin') {
        return res.status(403).json({ error: 'Only a super admin can create users' });
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const passwordErrors = validatePasswordStrength(req.body.password);
      if (passwordErrors.length > 0) {
        return res.status(400).json({ error: passwordErrors[0], passwordErrors });
      }

      const { username, password, role } = req.body;
      const exists = await User.findOne({ username }).lean();
      if (exists) return res.status(409).json({ error: 'Username already exists' });

      const user = new User({ username, role: role || 'staff' });
      await user.setPassword(password);

      // Superadmin accounts get a personal TOTP secret at creation time — the
      // QR/manual key is only ever returned in this one response, right after
      // setup, matching how every other 2FA setup flow works.
      let totpSetup = null;
      if (user.role === 'superadmin') {
        const secret = speakeasy.generateSecret({
          name: `SCUML (${username})`,
          length: 20,
        });
        user.totpSecret = secret.base32;
        totpSetup = {
          qrCodeDataUrl: await qrcode.toDataURL(secret.otpauth_url),
          manualEntryKey: secret.base32,
        };
      }

      await user.save();

      return res.status(201).json({ message: 'User registered', totpSetup });
    } catch (err) {
      console.error('Register error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }
);

// Login (explicit session regenerate + save)
router.post(
  '/login',
  loginLimiter,
  [body('username').isString(), body('password').isString()],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const { username, password } = req.body;
      const user = await User.findOne({ username });
      if (!user) {
        recordAuditEvent(req, 'login_failed', username);
        return res.status(400).json({ error: 'Invalid credentials' });
      }

      if (!user.failedLogin) user.failedLogin = { count: 0, lastAttempt: null, lockUntil: null };

      const MAX_ATTEMPTS = 3;
      const LOCK_MINUTES = 15;

      const now = new Date();
      if (user.failedLogin.lockUntil && user.failedLogin.lockUntil > now) {
        const minutesLeft = Math.ceil((user.failedLogin.lockUntil - now) / 60000);
        return res.status(423).json({
          error: `Too many failed attempts. Try again in ${minutesLeft} minute${minutesLeft === 1 ? '' : 's'}.`,
        });
      }

      const ok = await user.verifyPassword(password);
      if (!ok) {
        // A lockout that has already expired resets the counter before this
        // attempt is counted, so a fresh 3-attempt window starts now.
        if (user.failedLogin.lockUntil && user.failedLogin.lockUntil <= now) {
          user.failedLogin.count = 0;
        }
        user.failedLogin.count = (user.failedLogin.count || 0) + 1;
        user.failedLogin.lastAttempt = now;

        if (user.failedLogin.count >= MAX_ATTEMPTS) {
          user.failedLogin.lockUntil = new Date(now.getTime() + LOCK_MINUTES * 60 * 1000);
          await user.save();
          recordAuditEvent(req, 'brute_force_lockout', username);
          return res.status(423).json({
            error: `Too many failed attempts. Try again in ${LOCK_MINUTES} minutes.`,
          });
        }

        user.failedLogin.lockUntil = null;
        await user.save();
        recordAuditEvent(req, 'login_failed', username);
        const attemptsRemaining = MAX_ATTEMPTS - user.failedLogin.count;
        return res.status(400).json({
          error: 'Invalid credentials',
          attemptsRemaining,
        });
      }

      if (!user.isActive) {
        return res.status(403).json({ error: 'This account has been deactivated. Contact your super admin.' });
      }

      // Password verified — clear the counter now, whether or not a second
      // factor follows. Otherwise a stray earlier mistyped password leaves a
      // count that, unreset, carries straight into the TOTP step and can
      // lock the account out on a first bad code.
      user.failedLogin = { count: 0, lastAttempt: now, lockUntil: null };
      await user.save();

      // Superadmin accounts with 2FA set up need a second step before the
      // session is actually established — regenerate now (fresh session id,
      // same session-fixation protection as a full login) but only record a
      // *pending* identity, not a logged-in one.
      const needsTotp = user.role === 'superadmin' && !!user.totpSecret;

      req.session.regenerate((regErr) => {
        if (regErr) {
          console.error('Session regenerate error:', regErr);
          return res.status(500).json({ error: 'Server error' });
        }

        if (needsTotp) {
          req.session.pendingTotpUserId = user._id.toString();
          return req.session.save((saveErr) => {
            if (saveErr) {
              console.error('Session save error:', saveErr);
              return res.status(500).json({ error: 'Server error' });
            }
            return res.json({ requiresTotp: true });
          });
        }

        // No second factor required — finish the login now.
        req.session.user = {
          id: user._id.toString(),
          username: user.username,
          role: user.role,
          isOwner: !!user.isOwner,
          photoUrl: user.photoUrl || '',
        };
        if (req.session.cookie) {
          req.session.cookie.maxAge = 1000 * 60 * 60 * 24; // 1 day
        }

        req.session.save((saveErr) => {
          if (saveErr) {
            console.error('Session save error:', saveErr);
            return res.status(500).json({ error: 'Server error' });
          }
          recordAuditEvent(req, 'login_success', user.username);
          return res.json({ message: 'Login successful' });
        });
      });
    } catch (err) {
      console.error('Login error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }
);

// Step 2 of superadmin login — verify the 6-digit authenticator code for the
// user pending in this session and, on success, actually establish the
// logged-in session. No attempt limit or lockout here by design — this is a
// deliberate exception to the 3-try/15-minute policy used everywhere else;
// a mistyped or expired 30-second code shouldn't lock someone out of their
// own account, so there's no cap on retries at this step.
router.post(
  '/verify-totp-login',
  [body('code').isString()],
  async (req, res) => {
    try {
      const pendingId = req.session?.pendingTotpUserId;
      if (!pendingId) {
        return res.status(400).json({ error: 'No login in progress' });
      }

      const user = await User.findById(pendingId);
      if (!user || !user.totpSecret) {
        delete req.session.pendingTotpUserId;
        return res.status(400).json({ error: 'Invalid session, please log in again' });
      }

      const verified = speakeasy.totp.verify({
        secret: user.totpSecret,
        encoding: 'base32',
        token: req.body.code,
        window: 1,
      });

      if (!verified) {
        recordAuditEvent(req, 'totp_failed', user.username);
        return res.status(400).json({ error: 'Invalid code' });
      }

      // Code verified — finish the login.
      delete req.session.pendingTotpUserId;
      req.session.user = {
        id: user._id.toString(),
        username: user.username,
        role: user.role,
        isOwner: !!user.isOwner,
        photoUrl: user.photoUrl || '',
      };
      if (req.session.cookie) {
        req.session.cookie.maxAge = 1000 * 60 * 60 * 24;
      }

      req.session.save((saveErr) => {
        if (saveErr) {
          console.error('Session save error:', saveErr);
          return res.status(500).json({ error: 'Server error' });
        }
        recordAuditEvent(req, 'login_success', user.username);
        return res.json({ message: 'Login successful' });
      });
    } catch (err) {
      console.error('TOTP verify error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }
);

// Logout
router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie(process.env.SESSION_NAME || 'scuml.sid');
    return res.json({ message: 'Logged out' });
  });
});

export default router;
