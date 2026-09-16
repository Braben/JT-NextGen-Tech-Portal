/**
 * Enrollments - Student program enrollment and status
 */


const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const { ACTIONS, canPerform, instructorProgramIds, isAdmin, isInstructor, isStudent } = require('../lib/accessControl');
const { isValidEnrollmentStatus } = require('../lib/validators');
const audit = require('../services/audit');
const { invalidate } = require('../middleware/cache');

const router = express.Router();

router.get('/', authenticate, async (req, res, next) => {
  try {
    let rows;
    if (isStudent(req.user)) {
      rows = await db.prepare(`
        SELECT e.*, p.title as program_title, p.slug as program_slug, p.duration, p.level,
               pc.name as class_name, pc.code as class_code, pc.status as class_status,
               pc.start_date as class_start_date, pc.end_date as class_end_date,
               pc.forum_category_id as class_forum_category_id, i.name as instructor_name
        FROM enrollments e
        JOIN programs p ON e.program_id = p.id
        LEFT JOIN program_classes pc ON pc.id = e.class_id
        LEFT JOIN users i ON i.id = pc.instructor_id
        WHERE e.student_id = ?
        ORDER BY e.enrolled_at DESC
      `).all(req.user.id);
    } else if (isAdmin(req.user)) {
      rows = await db.prepare(`
        SELECT e.*, p.title as program_title, p.slug as program_slug, u.name as student_name, u.email as student_email,
               pc.name as class_name, pc.code as class_code, pc.status as class_status,
               pc.start_date as class_start_date, pc.end_date as class_end_date,
               pc.forum_category_id as class_forum_category_id, i.name as instructor_name
        FROM enrollments e
        JOIN programs p ON e.program_id = p.id
        JOIN users u ON e.student_id = u.id
        LEFT JOIN program_classes pc ON pc.id = e.class_id
        LEFT JOIN users i ON i.id = pc.instructor_id
        ORDER BY e.enrolled_at DESC
      `).all();
    } else if (isInstructor(req.user)) {
      const programIds = await instructorProgramIds(db, req.user);
      if (!programIds.length) return res.json([]);
      const placeholders = programIds.map(() => '?').join(',');
      rows = await db.prepare(`
        SELECT e.*, p.title as program_title, p.slug as program_slug, u.name as student_name, u.email as student_email,
               pc.name as class_name, pc.code as class_code, pc.status as class_status,
               pc.start_date as class_start_date, pc.end_date as class_end_date,
               pc.forum_category_id as class_forum_category_id, i.name as instructor_name
        FROM enrollments e
        JOIN programs p ON e.program_id = p.id
        JOIN users u ON e.student_id = u.id
        LEFT JOIN program_classes pc ON pc.id = e.class_id
        LEFT JOIN users i ON i.id = pc.instructor_id
        WHERE e.program_id IN (${placeholders})
        ORDER BY e.enrolled_at DESC
      `).all(...programIds);
    } else {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post('/', authenticate, async (req, res, next) => {
  try {
    if (!isStudent(req.user)) return res.status(403).json({ error: 'Only students can enroll themselves' });
    const { program_id, session } = req.body;
    if (!program_id) return res.status(400).json({ error: 'Program ID required' });
    if (session && !['Morning', 'Evening'].includes(session)) return res.status(400).json({ error: 'Invalid session' });
    const program = await db.prepare('SELECT id FROM programs WHERE id = ?').get(program_id);
    if (!program) return res.status(404).json({ error: 'Program not found' });
    const existing = await db.prepare('SELECT id FROM enrollments WHERE student_id = ? AND program_id = ?').get(req.user.id, program_id);
    if (existing) return res.status(409).json({ error: 'Already enrolled in this program' });
    const id = uuidv4();
    await db.prepare('INSERT INTO enrollments (id, student_id, program_id, session) VALUES (?,?,?,?)')
      .run(id, req.user.id, program_id, session || 'Morning');
    await db.saveDb();
    const enrollment = await db.prepare('SELECT * FROM enrollments WHERE id = ?').get(id);
    res.status(201).json(enrollment);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', authenticate, authorize('instructor', 'admin'), async (req, res, next) => {
  try {
    const { status } = req.body;
    if (status && !isValidEnrollmentStatus(status)) return res.status(400).json({ error: 'Invalid enrollment status' });
    const prev = await db.prepare('SELECT * FROM enrollments WHERE id = ?').get(req.params.id);
    if (!prev) return res.status(404).json({ error: 'Enrollment not found' });
    if (!(await canPerform(db, req.user, ACTIONS.MANAGE_ENROLLMENT, prev))) return res.status(403).json({ error: 'Unauthorized' });
    const data = {};
    const placementFields = ['program_id', 'class_id', 'session'];
    const editsPlacement = placementFields.some((key) => Object.prototype.hasOwnProperty.call(req.body, key));
    if (editsPlacement) {
      if (!isAdmin(req.user)) return res.status(403).json({ error: 'Only admins can change program, class, or session' });
      const programId = req.body.program_id === undefined ? prev.program_id : req.body.program_id;
      let session = req.body.session === undefined ? prev.session : req.body.session;
      if (typeof programId !== 'string' || !programId || !await db.prepare('SELECT id FROM programs WHERE id = ?').get(programId)) {
        return res.status(400).json({ error: 'Choose a valid program' });
      }
      if (!['Morning', 'Evening'].includes(session)) return res.status(400).json({ error: 'Session must be Morning or Evening' });
      const duplicate = await db.prepare('SELECT id FROM enrollments WHERE student_id = ? AND program_id = ? AND id != ?')
        .get(prev.student_id, programId, prev.id);
      if (duplicate) return res.status(409).json({ error: 'Student is already enrolled in this program' });

      // A different program/session cannot retain an incompatible old class.
      let classId = req.body.class_id === undefined
        ? (programId !== prev.program_id || session !== prev.session ? null : prev.class_id)
        : req.body.class_id || null;
      if (req.body.class_id !== undefined && req.body.class_id !== null && typeof req.body.class_id !== 'string') {
        return res.status(400).json({ error: 'Choose a valid class' });
      }
      if (classId) {
        const classRow = await db.prepare('SELECT * FROM program_classes WHERE id = ?').get(classId);
        if (!classRow || classRow.program_id !== programId) return res.status(400).json({ error: 'Class must belong to the selected program' });
        if (req.body.session === undefined) session = classRow.session;
        if (session !== classRow.session) return res.status(400).json({ error: 'Session must match the selected class' });
        if (classId !== prev.class_id) {
          if (!['planned', 'active'].includes(classRow.status)) return res.status(400).json({ error: 'Choose a planned or active class' });
          if (['completed', 'dropped'].includes(status || prev.status)) return res.status(400).json({ error: 'Completed or dropped enrollments cannot be allocated' });
          const count = await db.prepare('SELECT COUNT(*) as count FROM enrollments WHERE class_id = ?').get(classId);
          if (Number(count.count) >= Number(classRow.capacity)) return res.status(409).json({ error: 'Class capacity would be exceeded' });
        }
      }
      Object.assign(data, { program_id: programId, class_id: classId, session });
    }
    if (status) data.status = status;
    if (status === 'completed') data.completed_at = new Date().toISOString();
    if (status === 'active' && prev.status !== 'active') data.enrolled_at = new Date().toISOString();
    const sets = Object.keys(data).map((k) => `${k}=?`).join(',');
    const vals = Object.values(data);
    if (!sets) return res.json(prev);
    vals.push(req.params.id);
    await db.prepare(`UPDATE enrollments SET ${sets} WHERE id=?`).run(...vals);
    await db.saveDb();
    if (editsPlacement) {
      await audit(req.user, 'enrollment.placement', 'enrollment', prev.id,
        JSON.stringify({ before: { program_id: prev.program_id, class_id: prev.class_id, session: prev.session }, after: { program_id: data.program_id, class_id: data.class_id, session: data.session } }));
      for (const path of ['/api/admin/stats', '/api/gradebook', '/api/attendance']) invalidate(path);
    }
    if (status && status !== prev.status) {
      await audit(req.user, 'enrollment.status', 'enrollment', prev.id, `Changed status from ${prev.status} to ${status}`);
    }
    if (status && status !== prev.status) {
      try {
        const prog = await db.prepare('SELECT title FROM programs WHERE id = ?').get(data.program_id || prev.program_id);
        await db.prepare('INSERT INTO notifications (id, user_id, title, message, type, related_id) VALUES (?, ?, ?, ?, ?, ?)').run(require('uuid').v4(), prev.student_id, 'Enrollment Updated', `Your enrollment for "${prog ? prog.title : 'program'}" is now ${status}`, 'enrollment', prev.id);
        await db.saveDb();
        const { getIO } = require('../services/socket');
        const io = getIO();
        if (io) io.to(`user:${prev.student_id}`).emit('notifications:new', { title: 'Enrollment Updated', message: `Enrollment ${status}`, type: 'enrollment', related_id: prev.id });
      } catch {}
    }
    res.json(await db.prepare('SELECT * FROM enrollments WHERE id = ?').get(req.params.id));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
