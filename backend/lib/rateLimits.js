const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const crypto = require('crypto');
const { decodeAccess } = require('./sessions');

function handler(req, res) {
  const retryAfter = Math.max(1, Math.ceil((req.rateLimit.resetTime.getTime() - Date.now()) / 1000));
  res.set('Retry-After', String(retryAfter));
  res.status(429).json({ error: `Too many requests. Try again in ${retryAfter} seconds.`, retryAfter });
}
const ipKey = req => ipKeyGenerator(req.ip);
function accountKey(req) {
  // Keep users on school Wi-Fi/proxy connections separate, without storing raw
  // email addresses in the limiter. The database enforces failures per account.
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase().slice(0,320) : '';
  return `${ipKey(req)}:${crypto.createHash('sha256').update(email).digest('hex')}`;
}
function generalKey(req) {
  try { return `user:${decodeAccess((req.get('authorization') || '').replace(/^Bearer /, '')).id}`; }
  catch { return `ip:${ipKey(req)}`; }
}
const make = options => rateLimit({ standardHeaders: true, legacyHeaders: false, handler, ...options });
module.exports = {
  // Each call gets its own store. Never share one limiter across auth routes.
  login: () => make({ windowMs: 15*60*1000, limit: 20, keyGenerator: accountKey, skipSuccessfulRequests: true,
    // Only real credential failures count, not validation, lockout or outages.
    requestWasSuccessful: (req, res) => res.statusCode !== 401 }),
  register: () => make({ windowMs: 15*60*1000, limit: 10, keyGenerator: accountKey }),
  forgot: () => make({ windowMs: 15*60*1000, limit: 5, keyGenerator: accountKey }),
  reset: () => make({ windowMs: 15*60*1000, limit: 30 }),
  refresh: () => make({ windowMs: 60*1000, limit: 120, skipSuccessfulRequests: true,
    // Anonymous startup requests have no cookie and do no database work.
    skip: req => !/(?:^|;\s*)(?:__Secure-)?jt-refresh=/.test(req.headers.cookie || '') }),
  // A coarse IP ceiling still limits attacks that cycle through account names.
  authBurst: () => make({ windowMs: 60*1000, limit: 120, skipSuccessfulRequests: true,
    requestWasSuccessful: (req, res) => req.originalUrl.split('?')[0] === '/api/auth/login' && res.statusCode < 400,
    skip: req => !['/login','/register','/forgot-password','/reset-password'].includes(req.path) }),
  scoped: limit => make({ windowMs: 60*1000, limit, keyGenerator: generalKey }),
  general: () => make({ windowMs: 60*1000, limit: 300, keyGenerator: generalKey,
    skip: req => req.path === '/health' || req.path.startsWith('/auth/') }),
};
