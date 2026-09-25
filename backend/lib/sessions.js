const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

const LIFETIME = 7 * 24 * 60 * 60 * 1000;
const cookieName = () => process.env.NODE_ENV === 'production' ? '__Secure-jt-refresh' : 'jt-refresh';
const hash = token => crypto.createHash('sha256').update(token).digest('hex');
const options = () => ({ httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/api/auth' });
const unauthorized = () => Object.assign(new Error('Session expired. Please sign in again.'), { status: 401 });

function readCookie(req) {
  return (req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith(`${cookieName()}=`))?.slice(cookieName().length + 1);
}
function clearCookie(res) { res.clearCookie(cookieName(), options()); }
function accessToken(user, sessionId) {
  return jwt.sign({ id: user.id, role: user.role, sid: sessionId }, process.env.JWT_SECRET,
    { algorithm: 'HS256', expiresIn: '15m', issuer: 'jt-portal', audience: 'jt-portal-api', jwtid: crypto.randomUUID() });
}
function decodeAccess(token) {
  return jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'], issuer: 'jt-portal', audience: 'jt-portal-api' });
}
async function activeSession(claims) {
  if (!claims.sid || !claims.id) return false;
  return !!await db.prepare('SELECT id FROM auth_sessions WHERE id = ? AND user_id = ? AND revoked = 0 AND expires_at > ?')
    .get(claims.sid, claims.id, Date.now());
}
function respond(res, user, session, raw) {
  res.set('Cache-Control', 'no-store');
  res.cookie(cookieName(), raw, { ...options(), maxAge: Math.max(0, session.expires_at - Date.now()) });
  return { token: accessToken(user, session.id), user: { id: user.id, name: user.name, email: user.email, role: user.role, avatar: user.avatar }, expiresIn: 900 };
}
async function issueSession(user, res) {
  const raw = crypto.randomBytes(32).toString('hex');
  const session = { id: crypto.randomUUID(), expires_at: Date.now() + LIFETIME };
  await db.prepare('INSERT INTO auth_sessions (id,user_id,current_hash,expires_at,revoked) VALUES (?,?,?,?,0)')
    .run(session.id, user.id, hash(raw), session.expires_at);
  await db.prepare('INSERT INTO refresh_tokens (token_hash,session_id) VALUES (?,?)').run(hash(raw), session.id);
  await db.saveDb();
  return respond(res, user, session, raw);
}
async function revokeSession(id) {
  await db.prepare('UPDATE auth_sessions SET revoked = 1 WHERE id = ?').run(id);
  // Disconnect existing sockets too, rather than waiting for another HTTP call.
  require('../services/socket').getIO()?.in(`session:${id}`).disconnectSockets(true);
  await db.saveDb();
}
async function revokeUser(userId) {
  await db.prepare('UPDATE auth_sessions SET revoked = 1 WHERE user_id = ?').run(userId);
  require('../services/socket').getIO()?.in(`user:${userId}`).disconnectSockets(true);
  await db.saveDb();
}
async function rotate(req, res) {
  const raw = readCookie(req);
  if (!raw || !/^[a-f0-9]{64}$/.test(raw)) throw unauthorized();
  const digest = hash(raw);
  const session = await db.prepare('SELECT s.* FROM auth_sessions s JOIN refresh_tokens t ON t.session_id = s.id WHERE t.token_hash = ?').get(digest);
  if (!session || session.revoked || session.expires_at <= Date.now()) throw unauthorized();
  if (session.current_hash !== digest) {
    // Keep consumed hashes until session expiry: reuse invalidates the entire
    // session, including access tokens issued by an earlier successful rotation.
    await revokeSession(session.id);
    throw unauthorized();
  }
  const user = await db.prepare('SELECT id,name,email,role,avatar FROM users WHERE id = ?').get(session.user_id);
  if (!user) { await revokeSession(session.id); throw unauthorized(); }
  const next = crypto.randomBytes(32).toString('hex');
  await db.prepare('INSERT INTO refresh_tokens (token_hash,session_id) VALUES (?,?)').run(hash(next), session.id);
  // Compare-and-swap is atomic in both adapters. Do not use the legacy shared
  // transaction adapter here: overlapping refreshes must never both succeed.
  const result = await db.prepare('UPDATE auth_sessions SET current_hash = ? WHERE id = ? AND current_hash = ? AND revoked = 0 AND expires_at > ?')
    .run(hash(next), session.id, digest, Date.now());
  if (result.changes !== 1) { await revokeSession(session.id); throw unauthorized(); }
  await db.saveDb();
  return respond(res, user, session, next);
}
async function logout(req, res) {
  const raw = readCookie(req);
  if (raw) {
    const row = await db.prepare('SELECT session_id FROM refresh_tokens WHERE token_hash = ?').get(hash(raw));
    if (row) await revokeSession(row.session_id);
  }
  clearCookie(res);
}

// A custom header prevents simple cross-site form submissions; an explicit
// origin allowlist protects cookie endpoints even if CORS changes later.
function protectCookieRequest(req, res, next) {
  const allowed = (process.env.CORS_ORIGIN || 'http://localhost:3000,http://127.0.0.1:3000').split(',').map(s => s.trim());
  if (process.env.FRONTEND_URL) allowed.push(new URL(process.env.FRONTEND_URL).origin);
  const origin = req.get('origin');
  if (req.get('X-Portal-CSRF') !== '1' || (origin && !allowed.includes(origin)) || req.get('sec-fetch-site') === 'cross-site') {
    return res.status(403).json({ error: 'Invalid session request origin' });
  }
  next();
}

module.exports = { issueSession, rotate, logout, revokeUser, activeSession, decodeAccess, clearCookie, protectCookieRequest };
