/**
 * Auth Middleware — JWT verification & role-based authorization
 *
 * authenticate  — Verifies the Bearer token on every protected request.
 *                 The decoded payload (id, name, email, role) is attached
 *                 to req.user for downstream use.
 *
 * authorize     — Factory that returns a middleware restricting access to
 *                 one or more roles (e.g. authorize('admin', 'instructor')).
 *
 * Security notes:
 *   - All protected routes MUST use authenticate BEFORE authorize.
 *   - Token is expected in the Authorization header: "Bearer <token>".
 *   - Expired tokens are rejected with a generic "Invalid or expired"
 *     message (no distinction between invalid and expired, preventing
 *     information leakage to attackers).
 */

const jwt = require('jsonwebtoken');
const db = require('../config/db');

/**
 * authenticate — Express middleware
 * Extracts and verifies the JWT from the Authorization header.
 * On success, sets req.user = decoded payload and calls next().
 * On failure, returns 401 with a generic error message.
 */
async function authenticate(req, res, next) {
  const header = req.headers.authorization;

  // Reject requests that don't carry a Bearer token at all
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  // Keep token validation and user lookup separate. A database outage should
  // not masquerade as an expired token, otherwise the frontend clears a valid
  // session and sends the user back to login.
  let decoded;
  try {
    const token = header.split(' ')[1];
    decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  try {
    const user = await db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(decoded.id);
    if (!user) return res.status(401).json({ error: 'Invalid or expired token' });
    req.user = user;
    next();
  } catch (err) {
    err.status = 503;
    err.message = 'Authentication temporarily unavailable';
    return next(err);
  }
}

/**
 * authorize — Express middleware factory
 * @param  {...string} roles — One or more allowed role names
 * @returns {Function} Middleware that checks req.user.role
 *
 * Usage: router.get('/secret', authenticate, authorize('admin'), handler)
 */
function authorize(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

module.exports = { authenticate, authorize };
