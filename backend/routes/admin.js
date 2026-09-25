/**
 * Admin - CRUD for users, certificates, enrollments, contacts
 */


const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');
const audit = require('../services/audit');
const { notifyUser } = require('../services/notificationService');
const { authenticate, authorize } = require('../middleware/auth');
const { isValidRole, normalizeEmail, trimString } = require('../lib/validators');
const { instructorProgramIds } = require('../lib/accessControl');

const router = express.Router();
const { cacheMiddleware, invalidate } = require('../middleware/cache');

const broadcastAudiences = new Set(['all', 'students', 'instructors', 'admins']);
const broadcastTypes = new Set(['info', 'success', 'warning', 'error']);

function broadcastAudienceSql(audience) {
  if (audience === 'students') return { where: "WHERE role = 'student'", params: [] };
  if (audience === 'instructors') return { where: "WHERE role = 'instructor'", params: [] };
  if (audience === 'admins') return { where: "WHERE role = 'admin'", params: [] };
  return { where: '', params: [] };
}

router.get('/stats', authenticate, authorize('admin'), cacheMiddleware(30), async (req, res, next) => {
  try {
    const instructors = await db.prepare("SELECT COUNT(*) as count FROM users WHERE role='instructor'").get();
    const programs = await db.prepare('SELECT COUNT(*) as count FROM programs').get();
    const enrollments = await db.prepare('SELECT COUNT(*) as count FROM enrollments').get();
    const activeEnrollments = await db.prepare("SELECT COUNT(*) as count FROM enrollments WHERE status='active'").get();
    const certificates = await db.prepare('SELECT COUNT(*) as count FROM certificates').get();
    const contacts = await db.prepare('SELECT COUNT(*) as count FROM contacts').get();
    const onboarding = await db.prepare("SELECT COUNT(*) as count FROM onboarding_assessments WHERE status = 'submitted'").get();

    // Active students = students with at least one active enrollment
    const activeStudents = await db.prepare(`
      SELECT COUNT(DISTINCT e.student_id) as count
      FROM enrollments e
      WHERE e.status = 'active'
    `).get();

    // Alumni = students with a completed enrollment; count distinct students
    const alumni = await db.prepare(`
      SELECT COUNT(DISTINCT e.student_id) as count
      FROM enrollments e
      WHERE e.status = 'completed'
    `).get();

    // Alumni grouped by completion year + month, for the admin breakdown
    let alumniByMonth = [];
    try {
      alumniByMonth = await db.prepare(`
        SELECT
          EXTRACT(YEAR FROM e.completed_at)::int as year,
          EXTRACT(MONTH FROM e.completed_at)::int as month,
          COUNT(DISTINCT e.student_id) as count
        FROM enrollments e
        WHERE e.status = 'completed' AND e.completed_at IS NOT NULL
        GROUP BY 1, 2
        ORDER BY 1 DESC, 2 DESC
      `).all();
    } catch {
      try {
        const rows = await db.prepare(`SELECT completed_at FROM enrollments WHERE status = 'completed' AND completed_at IS NOT NULL`).all();
        const map = new Map();
        for (const r of rows) {
          const d = new Date(r.completed_at);
          if (isNaN(d)) continue;
          const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
          map.set(key, (map.get(key) || 0) + 1);
        }
        alumniByMonth = Array.from(map.entries()).map(([k, count]) => {
          const [year, month] = k.split('-').map(Number);
          return { year, month, count };
        }).sort((a, b) => b.year - a.year || b.month - a.month);
      } catch { alumniByMonth = []; }
    }

    res.json({
      instructors: instructors.count,
      programs: programs.count,
      enrollments: enrollments.count,
      activeEnrollments: activeEnrollments.count,
      certificates: certificates.count,
      contacts: contacts.count,
      pendingAssessments: onboarding.count,
      activeStudents: activeStudents.count,
      alumni: alumni.count,
      alumniByMonth,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/users', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const role = req.query.role;
    let rows;
    if (role) {
      rows = await db.prepare('SELECT id, name, email, role, created_at FROM users WHERE role = ? ORDER BY created_at DESC').all(role);
    } else {
      rows = await db.prepare('SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC').all();
    }
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post('/users', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const name = trimString(req.body.name, 100);
    const email = normalizeEmail(req.body.email);
    const { password } = req.body;
    const role = req.body.role || 'student';
    if (!name || !email || !password) return res.status(400).json({ error: 'Name, email, password required' });
    if (!isValidRole(role)) return res.status(400).json({ error: 'Invalid role' });
    const existing = await db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) return res.status(409).json({ error: 'Email already exists' });
    const id = uuidv4();
    await db.prepare('INSERT INTO users (id, name, email, password, role) VALUES (?,?,?,?,?)').run(id, name, email, bcrypt.hashSync(password, 10), role);
    await db.saveDb?.();
    await audit(req.user, 'create', 'user', id, `Created user ${name} (${email})`);
    res.status(201).json({ id, name, email, role });
  } catch (err) {
    next(err);
  }
});

router.put('/users/:id', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const name = req.body.name !== undefined ? trimString(req.body.name, 100) : undefined;
    const email = req.body.email !== undefined ? normalizeEmail(req.body.email) : undefined;
    const { role, password } = req.body;
    if (role && !isValidRole(role)) return res.status(400).json({ error: 'Invalid role' });
    const existing = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'User not found' });
    if (req.params.id === req.user.id && role && role !== 'admin') {
      return res.status(400).json({ error: 'Admins cannot remove their own admin role' });
    }
    if (password) {
      await db.prepare('UPDATE users SET name=?, email=?, role=?, password=? WHERE id=?')
        .run(name || existing.name, email || existing.email, role || existing.role, bcrypt.hashSync(password, 10), req.params.id);
    } else {
      await db.prepare('UPDATE users SET name=?, email=?, role=? WHERE id=?')
        .run(name || existing.name, email || existing.email, role || existing.role, req.params.id);
    }
    await db.saveDb?.();
    if (password || (role && role !== existing.role)) await require('../lib/sessions').revokeUser(req.params.id);
    await audit(req.user, 'update', 'user', req.params.id, `Updated user ${name || existing.name}`);
    res.json(await db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(req.params.id));
  } catch (err) {
    next(err);
  }
});

router.delete('/users/:id', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    if (req.params.id === req.user.id) return res.status(400).json({ error: 'Admins cannot delete their own account' });
    const existing = await db.prepare('SELECT name, email FROM users WHERE id = ?').get(req.params.id);
    if (existing) await audit(req.user, 'delete', 'user', req.params.id, `Deleted user ${existing.name} (${existing.email})`);
    await require('../lib/sessions').revokeUser(req.params.id);
    await db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
    await db.saveDb?.();
    res.json({ message: 'User deleted' });
  } catch (err) {
    next(err);
  }
});

router.get('/certificates', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const rows = await db.prepare(`
      SELECT c.*, u.name as student_name, u.email as student_email, p.title as program_title
      FROM certificates c
      JOIN users u ON c.student_id = u.id
      JOIN programs p ON c.program_id = p.id
      ORDER BY c.issue_date DESC
    `).all();
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post('/certificates', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const { student_id, program_id } = req.body;
    if (!student_id || !program_id) return res.status(400).json({ error: 'Student ID and Program ID required' });
    const student = await db.prepare("SELECT id FROM users WHERE id = ? AND role = 'student'").get(student_id);
    if (!student) return res.status(400).json({ error: 'Invalid student' });
    const program = await db.prepare('SELECT id FROM programs WHERE id = ?').get(program_id);
    if (!program) return res.status(400).json({ error: 'Invalid program' });
    const id = uuidv4();
    let serial;
    for (let attempts = 0; attempts < 5; attempts++) {
      serial = `JTNG-${String(Math.floor(Math.random() * 999999)).padStart(6, '0')}`;
      const existing = await db.prepare('SELECT id FROM certificates WHERE serial_number = ?').get(serial);
      if (!existing) break;
      serial = null;
    }
    if (!serial) return res.status(500).json({ error: 'Could not generate certificate serial' });
    await db.prepare('INSERT INTO certificates (id, serial_number, student_id, program_id) VALUES (?,?,?,?)').run(id, serial, student_id, program_id);
    await db.saveDb?.();
    await audit(req.user, 'create', 'certificate', id, `Issued certificate ${serial}`);
    res.status(201).json(await db.prepare('SELECT * FROM certificates WHERE id = ?').get(id));
  } catch (err) {
    next(err);
  }
});

router.put('/certificates/:id', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['valid', 'revoked'].includes(status)) return res.status(400).json({ error: 'Invalid certificate status' });
    await db.prepare('UPDATE certificates SET status=? WHERE id=?').run(status, req.params.id);
    await db.saveDb?.();
    await audit(req.user, 'update', 'certificate', req.params.id, `Set certificate status to ${status}`);
    res.json(await db.prepare('SELECT * FROM certificates WHERE id = ?').get(req.params.id));
  } catch (err) {
    next(err);
  }
});

router.get('/enrollments', authenticate, authorize('admin', 'instructor'), async (req, res, next) => {
  try {
    let rows;
    if (req.user.role === 'instructor') {
      const programIds = await instructorProgramIds(db, req.user);
      if (!programIds.length) return res.json([]);
      const placeholders = programIds.map(() => '?').join(',');
      rows = await db.prepare(`
        SELECT e.*, u.name as student_name, u.email as student_email, p.title as program_title,
               pc.name as class_name, pc.code as class_code, pc.status as class_status,
               pc.forum_category_id as class_forum_category_id, i.name as instructor_name
        FROM enrollments e
        JOIN users u ON e.student_id = u.id
        JOIN programs p ON e.program_id = p.id
        LEFT JOIN program_classes pc ON pc.id = e.class_id
        LEFT JOIN users i ON i.id = pc.instructor_id
        WHERE e.program_id IN (${placeholders})
        ORDER BY e.enrolled_at DESC
      `).all(...programIds);
    } else {
      rows = await db.prepare(`
        SELECT e.*, u.name as student_name, u.email as student_email, p.title as program_title,
               pc.name as class_name, pc.code as class_code, pc.status as class_status,
               pc.forum_category_id as class_forum_category_id, i.name as instructor_name,
               oa.id as assessment_id, oa.status as assessment_status, oa.score as assessment_score,
               oa.max_score as assessment_max_score, oa.feedback as assessment_feedback,
               COALESCE(oa.date_of_birth, u.date_of_birth, '') as date_of_birth,
               COALESCE(oa.gender, u.gender, '') as gender,
               COALESCE(oa.education_level, u.education_level, '') as education_level,
               COALESCE(oa.computing_experience, u.computing_experience, '') as computing_experience,
               oa.strengths, oa.greatest_strength, oa.weaknesses, oa.weakness_response,
               oa.improvement_plan, oa.reviewed_at
        FROM enrollments e
        JOIN users u ON e.student_id = u.id
        JOIN programs p ON e.program_id = p.id
        LEFT JOIN program_classes pc ON pc.id = e.class_id
        LEFT JOIN users i ON i.id = pc.instructor_id
        LEFT JOIN onboarding_assessments oa ON oa.enrollment_id = e.id
        ORDER BY e.enrolled_at DESC
      `).all();
    }
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.get('/onboarding-assessments', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const rows = await db.prepare(`
      SELECT oa.*, u.name as student_name, u.email as student_email, u.phone as student_phone,
             e.session, e.status as enrollment_status, p.title as program_title
      FROM onboarding_assessments oa
      JOIN users u ON u.id = oa.student_id
      LEFT JOIN enrollments e ON e.id = oa.enrollment_id
      LEFT JOIN programs p ON p.id = e.program_id
      ORDER BY
        CASE oa.status WHEN 'recommended' THEN 0 WHEN 'submitted' THEN 1 WHEN 'needs_followup' THEN 2 ELSE 3 END,
        oa.created_at DESC
    `).all();
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post('/onboarding-assessments/recommend', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const enrollmentId = trimString(req.body.enrollment_id, 80);
    if (!enrollmentId) return res.status(400).json({ error: 'Enrollment is required' });

    const enrollment = await db.prepare(`
      SELECT e.*, u.name as student_name, u.email as student_email, u.date_of_birth,
             u.gender, u.education_level, u.computing_experience, p.title as program_title
      FROM enrollments e
      JOIN users u ON u.id = e.student_id
      JOIN programs p ON p.id = e.program_id
      WHERE e.id = ?
    `).get(enrollmentId);
    if (!enrollment) return res.status(404).json({ error: 'Enrollment not found' });

    const existing = await db.prepare('SELECT * FROM onboarding_assessments WHERE enrollment_id = ?').get(enrollmentId);
    if (existing) return res.status(409).json({ error: 'An aptitude assessment already exists for this enrollment' });

    const id = uuidv4();
    await db.prepare(`
      INSERT INTO onboarding_assessments (
        id, student_id, enrollment_id, date_of_birth, gender, education_level,
        computing_experience, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'recommended')
    `).run(
      id,
      enrollment.student_id,
      enrollment.id,
      enrollment.date_of_birth || '',
      enrollment.gender || '',
      enrollment.education_level || '',
      enrollment.computing_experience || '',
    );
    await db.saveDb?.();
    invalidate('/api/admin/stats');

    await audit(req.user, 'onboarding.recommend', 'onboarding_assessment', id, `Recommended aptitude assessment for ${enrollment.student_name}`);
    await notifyUser(
      enrollment.student_id,
      'onboarding',
      'Aptitude Test Recommended',
      `Your aptitude test for ${enrollment.program_title} is ready. Please complete it so admissions can continue reviewing your application.`,
      id,
    );

    const row = await db.prepare(`
      SELECT oa.*, u.name as student_name, u.email as student_email, u.phone as student_phone,
             e.session, e.status as enrollment_status, p.title as program_title
      FROM onboarding_assessments oa
      JOIN users u ON u.id = oa.student_id
      LEFT JOIN enrollments e ON e.id = oa.enrollment_id
      LEFT JOIN programs p ON p.id = e.program_id
      WHERE oa.id = ?
    `).get(id);
    res.status(201).json(row);
  } catch (err) {
    next(err);
  }
});

router.get('/broadcasts', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const rows = await db.prepare(`
      SELECT
        n.related_id as id,
        n.title,
        n.message,
        n.type,
        MIN(n.created_at) as created_at,
        COUNT(*) as recipient_count,
        SUM(CASE WHEN n.read = 0 THEN 1 ELSE 0 END) as unread_count
      FROM notifications n
      WHERE n.type = 'announcement' AND n.related_id IS NOT NULL
      GROUP BY n.related_id, n.title, n.message, n.type
      ORDER BY MIN(n.created_at) DESC
      LIMIT 100
    `).all();
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post('/broadcasts', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const title = trimString(req.body.title, 120);
    const message = trimString(req.body.message, 2000);
    const audience = trimString(req.body.audience || 'all', 20);
    const tone = trimString(req.body.type || 'info', 20);

    if (!title) return res.status(400).json({ error: 'Title is required', fieldErrors: { title: 'Title is required' } });
    if (!message) return res.status(400).json({ error: 'Message is required', fieldErrors: { message: 'Message is required' } });
    if (!broadcastAudiences.has(audience)) return res.status(400).json({ error: 'Invalid audience', fieldErrors: { audience: 'Choose a valid audience' } });
    if (!broadcastTypes.has(tone)) return res.status(400).json({ error: 'Invalid message type', fieldErrors: { type: 'Choose a valid message type' } });

    const { where, params } = broadcastAudienceSql(audience);
    const recipients = await db.prepare(`SELECT id, name, role FROM users ${where} ORDER BY name ASC`).all(...params);
    if (!recipients.length) return res.status(400).json({ error: 'No recipients match this audience' });

    const broadcastId = uuidv4();
    const notificationIds = [];

    // Fan out one durable in-app notification per recipient so read state,
    // badge counts, and announcement history remain per-user and auditable.
    for (const recipient of recipients) {
      const notificationId = await notifyUser(recipient.id, 'announcement', title, message, broadcastId);
      notificationIds.push(notificationId);
      await db.prepare(`
        INSERT INTO notification_log (id, user_id, notification_id, channel, subject, message, status)
        VALUES (?, ?, ?, 'in_app', ?, ?, 'sent')
      `).run(uuidv4(), recipient.id, notificationId, title, message);
    }
    await db.saveDb?.();
    await audit(req.user, 'broadcast.send', 'announcement', broadcastId, `Sent announcement to ${recipients.length} recipient(s): ${audience}`);

    res.status(201).json({
      id: broadcastId,
      title,
      message,
      type: 'announcement',
      tone,
      audience,
      recipient_count: recipients.length,
      notification_ids: notificationIds,
    });
  } catch (err) {
    next(err);
  }
});

router.put('/onboarding-assessments/:id/grade', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const assessment = await db.prepare('SELECT * FROM onboarding_assessments WHERE id = ?').get(req.params.id);
    if (!assessment) return res.status(404).json({ error: 'Assessment not found' });

    const score = Number(req.body.score);
    const maxScore = Number(req.body.max_score || 100);
    const feedback = trimString(req.body.feedback, 1200);
    const status = req.body.status || 'reviewed';

    if (assessment.status === 'recommended') return res.status(400).json({ error: 'Assessment has not been submitted by the student' });
    if (!Number.isFinite(score) || score < 0) return res.status(400).json({ error: 'Score must be a non-negative number' });
    if (!Number.isFinite(maxScore) || maxScore <= 0 || maxScore > 1000) return res.status(400).json({ error: 'Invalid maximum score' });
    if (score > maxScore) return res.status(400).json({ error: 'Score cannot exceed maximum score' });
    if (!['reviewed', 'needs_followup'].includes(status)) return res.status(400).json({ error: 'Invalid assessment status' });

    // Admin grading is intentionally separate from coursework grades because
    // this assessment belongs to admissions/readiness, not class performance.
    await db.prepare(`
      UPDATE onboarding_assessments
      SET score = ?, max_score = ?, feedback = ?, status = ?, reviewed_by = ?,
          reviewed_at = ?, updated_at = ?
      WHERE id = ?
    `).run(score, maxScore, feedback, status, req.user.id, new Date().toISOString(), new Date().toISOString(), req.params.id);
    await db.saveDb?.();
    invalidate('/api/admin/stats');

    await audit(req.user, 'onboarding.grade', 'onboarding_assessment', req.params.id, `Scored onboarding assessment ${score}/${maxScore}`);

    const row = await db.prepare(`
      SELECT oa.*, u.name as student_name, u.email as student_email, u.phone as student_phone,
             e.session, e.status as enrollment_status, p.title as program_title
      FROM onboarding_assessments oa
      JOIN users u ON u.id = oa.student_id
      LEFT JOIN enrollments e ON e.id = oa.enrollment_id
      LEFT JOIN programs p ON p.id = e.program_id
      WHERE oa.id = ?
    `).get(req.params.id);
    res.json(row);
  } catch (err) {
    next(err);
  }
});

router.get('/contacts', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const rows = await db.prepare('SELECT * FROM contacts ORDER BY created_at DESC').all();
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post('/contacts', async (req, res, next) => {
  try {
    // Public forms are hostile input surfaces; normalize before validation and persistence.
    const name = trimString(req.body.name, 100);
    const email = normalizeEmail(req.body.email);
    const phone = trimString(req.body.phone, 40);
    const message = trimString(req.body.message, 2000);
    if (!name || !email || !message) return res.status(400).json({ error: 'Name, email, message required' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Valid email required' });
    const id = uuidv4();
    await db.prepare('INSERT INTO contacts (id, name, email, phone, message) VALUES (?,?,?,?,?)').run(id, name, email, phone, message);
    await db.saveDb?.();
    res.status(201).json({ message: 'Message sent successfully' });
  } catch (err) {
    next(err);
  }
});

/** GET /audit — admin action audit trail (newest first) */
router.get('/audit', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
    const rows = await db.prepare('SELECT * FROM admin_audit_log ORDER BY created_at DESC LIMIT ?').all(limit);
    res.json(rows);
  } catch (err) { next(err); }
});

/** GET /security/login-attempts — recent login attempts (security monitoring) */
router.get('/security/login-attempts', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
    const rows = await db.prepare('SELECT * FROM login_attempts ORDER BY created_at DESC LIMIT ?').all(limit);
    // Summary: failed attempts in the last hour
    // sql.js binds scalar values only; match SQLite CURRENT_TIMESTAMP's
    // UTC text format so same-day comparisons also count recent failures.
    const cutoffIso = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const cutoff = db.type === 'sqlite' ? cutoffIso.slice(0, 19).replace('T', ' ') : cutoffIso;
    const failed = await db.prepare('SELECT COUNT(*) AS c FROM login_attempts WHERE success = 0 AND created_at > ?').get(cutoff);
    res.json({ attempts: rows, failedLastHour: Number(failed?.c || 0) });
  } catch (err) { next(err); }
});

module.exports = router;
