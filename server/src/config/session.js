// src/config/session.js
const ONE_DAY = 1000 * 60 * 60 * 24;

export default {
  secret: process.env.SESSION_SECRET || 'dev-session-secret-change-me',
  name: process.env.SESSION_NAME || 'scuml.sid',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // true in prod
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // dev: lax, prod: none
    maxAge: ONE_DAY,
  },
  proxy: process.env.NODE_ENV === 'production', // if behind proxy in prod
};
