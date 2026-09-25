/**
 * Authentication - Register, login, profile, password change
 */


const express = require('express');
const bcrypt = require('bcryptjs');
const sessions = require('../lib/sessions');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');
const { invalidate } = require('../middleware/cache');
const { normalizeEmail, trimString } = require('../lib/validators');
const logger = require('../lib/logger');

const router = express.Router();
// Auth responses contain credentials or account data and must not be cached by
// the same-origin Netlify proxy. Cookie mutations require our CSRF header.
router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
router.use((req, res, next) => {
  // Prevent login-CSRF as well as refresh-CSRF. Browser credential submissions
  // carry Origin and our custom header; non-browser API clients have no Origin.
  if (req.method === 'POST' && ['/login', '/register'].includes(req.path) && req.get('origin')) {
    return sessions.protectCookieRequest(req, res, next);
  }
  next();
});
router.post('/refresh', sessions.protectCookieRequest, async (req, res, next) => {
  try { res.json(await sessions.rotate(req, res)); }
  catch (error) { if (error.status === 401) sessions.clearCookie(res); next(error); }
});
router.post('/logout', sessions.protectCookieRequest, async (req, res, next) => {
  try { await sessions.logout(req, res); res.json({ message: 'Signed out' }); }
  catch (error) { next(error); }
});

function normalizeRegistrationProfile(raw = {}) {
  return {
    date_of_birth: trimString(raw.date_of_birth, 20),
    gender: trimString(raw.gender, 20),
    education_level: trimString(raw.education_level, 100),
    computing_experience: trimString(raw.computing_experience, 20),
  };
}

function onboardingError(field, message) {
  return { field, message };
}

function validationResponse(res, field, message, status = 400) {
  return res.status(status).json({ error: message, fieldErrors: { [field]: message } });
}

function validateRegistrationProfile(profile, consent) {
  // Public registration stops at identity, program choice, and applicant
  // background. Admins recommend the long-form aptitude test later.
  if (!consent) return onboardingError('consent', 'Consent is required to process your application');
  if (!profile.date_of_birth) return onboardingError('date_of_birth', 'Date of birth is required');
  if (!['Male', 'Female', 'Prefer not to say'].includes(profile.gender)) return onboardingError('gender', 'Please select a valid gender option');
  if (!profile.education_level) return onboardingError('education_level', 'Highest level of education is required');
  if (!['Yes', 'No'].includes(profile.computing_experience)) return onboardingError('computing_experience', 'Please tell us if you have computing experience');
  return null;
}

/** POST /register  -  Create a new user account */
router.post('/register', validate(schemas.register), async (req, res, next) => {
  try {
    const { password, program_id, session } = req.body;
    const name = trimString(req.body.name, 100);
    const email = normalizeEmail(req.body.email);
    const profile = normalizeRegistrationProfile(req.body.profile || req.body.onboarding);
    const profileError = validateRegistrationProfile(profile, req.body.consent);
    if (profileError) {
      return res.status(400).json({
        error: profileError.message,
        fieldErrors: { [profileError.field]: profileError.message },
      });
    }
    if (!program_id) return validationResponse(res, 'program_id', 'Please select a program');

    // Prevent duplicate email registration
    const existing = await db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      return validationResponse(res, 'email', 'Email already registered', 409);
    }

    const sessionValue = session || 'Morning';
    if (program_id) {
      if (!['Morning', 'Evening'].includes(sessionValue)) {
        return validationResponse(res, 'session', 'Please select Morning or Evening session');
      }
      const program = await db.prepare('SELECT id FROM programs WHERE id = ?').get(program_id);
      if (!program) {
        return validationResponse(res, 'program_id', 'Please select a valid program');
      }
    }

    const id = uuidv4();
    const hashed = await bcrypt.hash(password, 10);
    // Public registration is intentionally student-only. Elevated roles are
    // created through authenticated admin user management, never self-service.
    const userRole = 'student';

    await db.prepare(`
      INSERT INTO users (
        id, name, email, password, role, phone, date_of_birth, gender,
        education_level, computing_experience
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      name,
      email,
      hashed,
      userRole,
      trimString(req.body.phone, 40),
      profile.date_of_birth,
      profile.gender,
      profile.education_level,
      profile.computing_experience,
    );

    // Every user gets default notification settings
    await db.prepare('INSERT INTO notification_settings (id, user_id) VALUES (?, ?)').run(uuidv4(), id);

    // Optional: enroll student in a program during registration
    let enrollmentId = null;
    if (program_id && userRole === 'student') {
      enrollmentId = uuidv4();
      await db.prepare('INSERT INTO enrollments (id, student_id, program_id, session, status) VALUES (?,?,?,?,?)')
        .run(enrollmentId, id, program_id, sessionValue, 'pending');
    }

    await db.saveDb?.();
    invalidate('/api/admin/stats');

    res.status(201).json(await sessions.issueSession({ id, name, email, role: userRole }, res));
  } catch (err) {
    next(err);
  }
});

/** POST /login  -  Authenticate an existing user */
router.post('/login', validate(schemas.login), async (req, res, next) => {
  try {
    const { password } = req.body;
    const email = normalizeEmail(req.body.email);
    const ip = req.ip || '';

    // Compare timestamps in the database's own type. SQLite's CAST AS timestamp
    // converts dates to numbers and can accidentally count very old failures.
    const cutoff = new Date(Date.now() - 15 * 60 * 1000);
    const boundary = db.type === 'sqlite' ? cutoff.toISOString().slice(0,19).replace('T',' ') : cutoff.toISOString();
    const recentFails = await db.prepare(
      'SELECT created_at FROM login_attempts WHERE email = ? AND success = 0 AND created_at > ? ORDER BY created_at DESC LIMIT 5'
    ).all(email, boundary);
    if (recentFails.length >= 5) {
      const oldest = recentFails[4].created_at;
      const stamp = oldest instanceof Date ? oldest.getTime() : Date.parse(String(oldest).replace(' ', 'T') + (String(oldest).endsWith('Z') ? '' : 'Z'));
      const retryAfter = Math.max(1, Math.ceil((stamp + 15 * 60 * 1000 - Date.now()) / 1000));
      // Rejected retries are not password failures: do not extend the window.
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({ error: `Too many failed attempts. Try again in ${Math.ceil(retryAfter / 60)} minute(s).`, retryAfter });
    }

    const user = await db.prepare('SELECT * FROM users WHERE email = ?').get(email);

    // Single error message for missing user OR wrong password
    // (prevents user-enumeration attacks)
    if (!user || !(await bcrypt.compare(password, user.password))) {
      await db.prepare('INSERT INTO login_attempts (id, email, ip, success) VALUES (?,?,?,?)')
        .run(uuidv4(), email, ip, 0);
      await db.saveDb();
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Successful login — clear lockout history
    await db.prepare('DELETE FROM login_attempts WHERE email = ? AND success = 0').run(email);
    await db.prepare('INSERT INTO login_attempts (id, email, ip, success) VALUES (?,?,?,?)')
      .run(uuidv4(), email, ip, 1);
    await db.saveDb();

    res.json(await sessions.issueSession(user, res));
  } catch (err) {
    next(err);
  }
});

/** POST /forgot-password — request a reset link */
router.post('/forgot-password', async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body.email);
    if (!email) return res.status(400).json({ error: 'Email is required' });
    const user = await db.prepare('SELECT id, email, name FROM users WHERE email = ?').get(email);
    if (!user) {
      return res.json({ message: 'If that email exists, a reset link has been sent' });
    }
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    await db.prepare('INSERT INTO password_resets (id, user_id, token, expires_at) VALUES (?,?,?,?)').run(uuidv4(), user.id, token, expiresAt);
    await db.saveDb?.();
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${token}`;
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[password-reset] ${user.email} -> ${resetUrl} (expires ${expiresAt})`);
    } else {
      logger.info('Password reset requested', { userId: user.id, email: user.email, expiresAt });
    }
    const payload = { message: 'If that email exists, a reset link has been sent' };
    if (process.env.NODE_ENV !== 'production') {
      payload.token = token;
      payload.resetUrl = resetUrl;
    }
    res.json(payload);
  } catch (err) {
    res.status(500).json({ error: 'Failed to process request' });
  }
});

/** POST /reset-password — consume a reset token */
router.post('/reset-password', async (req, res, next) => {
  try {
    const { token, new_password, password } = req.body;
    const newPass = new_password || password;
    if (!token || !newPass) return res.status(400).json({ error: 'Token and new password are required' });
    if (newPass.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
    const row = await db.prepare('SELECT * FROM password_resets WHERE token = ?').get(token);
    if (!row) return res.status(400).json({ error: 'Invalid or expired token' });
    if (row.used) return res.status(400).json({ error: 'Token already used' });
    if (new Date(row.expires_at) < new Date()) return res.status(400).json({ error: 'Token expired' });
    const hashed = await bcrypt.hash(newPass, 10);
    await db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashed, row.user_id);
    await sessions.revokeUser(row.user_id);
    await db.prepare('DELETE FROM login_attempts WHERE email = (SELECT email FROM users WHERE id = ?) AND success = 0').run(row.user_id);
    await db.prepare('UPDATE password_resets SET used = 1 WHERE id = ?').run(row.id);
    await db.prepare('DELETE FROM password_resets WHERE user_id = ? AND used = 1 AND id != ?').run(row.user_id, row.id);
    await db.saveDb?.();
    res.json({ message: 'Password reset successfully. You can now log in.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

/** GET /me  -  Return the authenticated user's profile + enrollments */
router.get('/me', authenticate, async (req, res, next) => {
  try {
    let user;
    try {
      user = await db.prepare('SELECT id, name, email, role, avatar, location, phone, bio, avatar_color, goal, mission, objectives, created_at FROM users WHERE id = ?').get(req.user.id);
    } catch {
      user = await db.prepare('SELECT id, name, email, role, avatar, location, goal, mission, objectives, created_at FROM users WHERE id = ?').get(req.user.id);
    }
    if (!user) return res.status(404).json({ error: 'User not found' });

    const enrollments = await db.prepare(
      'SELECT e.*, p.title as program_title FROM enrollments e JOIN programs p ON e.program_id = p.id WHERE e.student_id = ?'
    ).all(user.id);

    res.json({ ...user, enrollments });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load profile. Please try again.' });
  }
});

/** PUT /change-password  -  Update password (requires current password) */
router.put('/change-password', authenticate, async (req, res, next) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'Current and new password required' });
    }
    if (new_password.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    const user = await db.prepare('SELECT password FROM users WHERE id = ?').get(req.user.id);
    if (!user || !(await bcrypt.compare(current_password, user.password))) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const hashed = await bcrypt.hash(new_password, 10);
    await db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashed, req.user.id);
    await db.saveDb();

    // Revoke all devices, including the current session, after a password change.
    await sessions.revokeUser(req.user.id);
    sessions.clearCookie(res);

    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to change password. Please try again.' });
  }
});

/** PUT /profile  -  Update user profile fields */
router.put('/profile', authenticate, async (req, res, next) => {
  try {
    const { name, avatar, location, phone, bio, avatar_color, goal, mission, objectives } = req.body;

    const tryUpdate = async (col, val) => {
      if (val === undefined) return;
      try { await db.prepare(`UPDATE users SET ${col} = ? WHERE id = ?`).run(val, req.user.id); } catch {}
    };

    if (name) await tryUpdate('name', name);
    if (avatar !== undefined) await tryUpdate('avatar', avatar);
    if (location !== undefined) await tryUpdate('location', location);
    if (phone !== undefined) await tryUpdate('phone', phone);
    if (bio !== undefined) {
      await tryUpdate('bio', bio);
      await tryUpdate('goal', bio);
    } else if (goal !== undefined) await tryUpdate('goal', goal);
    if (avatar_color !== undefined) await tryUpdate('avatar_color', avatar_color);
    if (mission !== undefined) await tryUpdate('mission', mission);
    if (objectives !== undefined) await tryUpdate('objectives', objectives);

    await db.saveDb?.();

    let user;
    try { user = await db.prepare('SELECT id, name, email, role, avatar, location, phone, bio, avatar_color, goal, mission, objectives FROM users WHERE id = ?').get(req.user.id); }
    catch { user = await db.prepare('SELECT id, name, email, role, avatar, location, goal, mission, objectives FROM users WHERE id = ?').get(req.user.id); }

    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update profile. Please try again.' });
  }
});

module.exports = router;
