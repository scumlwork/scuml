import helmet from 'helmet';
import hpp from 'hpp';
import xssClean from 'xss-clean';
import rateLimit from 'express-rate-limit';


export default function harden(app) {
const FRONTEND = process.env.FRONTEND_URL;
if (!FRONTEND) throw new Error('FRONTEND_URL missing');


app.disable('x-powered-by');


// CORS is configured once, in server.js (needs the ngrok-subdomain allowance
// this static single-origin config can't express) — a second cors()
// middleware here would silently overwrite those headers on non-preflight
// requests while never actually being consulted for preflight OPTIONS
// (the first cors() short-circuits those), so it's removed rather than
// left as dead, misleading config.


// Helmet with a tight but pragmatic CSP
app.use(
helmet({
contentSecurityPolicy: {
useDefaults: true,
directives: {
"default-src": ["'self'"],
"img-src": ["'self'", 'data:'],
"script-src": ["'self'"],
"style-src": ["'self'", "'unsafe-inline'"],
"connect-src": ["'self'", process.env.FRONTEND_URL]
}
},
hidePoweredBy: true,
referrerPolicy: { policy: 'no-referrer' }
})
);


app.use(hpp());
app.use(xssClean());


// Global rate limit (tighten as needed)
const globalLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 500 });
app.use(globalLimiter);
}