/**
 * Attendance - Session management, self-marking, student records
 */


const express = require('express');
const db = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');
const {
  ensureActiveEnrollment,
  instructorProgramIds,
  isAdmin,
  isInstructor,
  isStudent,
} = require('../lib/accessControl');
const { boundedNumber, isValidAttendanceStatus, trimString } = require('../lib/validators');
const router = express.Router();

async function canManageAttendanceProgram(user, programId) {
  if (isAdmin(user)) return true;
  if (!isInstructor(user)) return false;
  const programIds = await instructorProgramIds(db, user);
  return programIds.includes(programId);
}

async function canManageAttendanceClass(user, classId) {
  if (isAdmin(user)) return true;
  if (!isInstructor(user)) return false;
  const row = await db.prepare('SELECT id FROM program_classes WHERE id = ? AND instructor_id = ?').get(classId, user.id);
  return Boolean(row);
}

async function canStudentAttendSession(studentId, session) {
  if (!session) return false;
  if (session.class_id) {
    const row = await db.prepare(`
      SELECT id FROM enrollments
      WHERE student_id = ? AND class_id = ? AND status = 'active'
    `).get(studentId, session.class_id);
    return Boolean(row);
  }
  return ensureActiveEnrollment(db, studentId, session.program_id);
}

function activeRosterSql(session) {
  // Class sessions use the precise class roster; old program-wide sessions
  // keep using active programme enrollments for backward compatibility.
  if (session.class_id) {
    return {
      join: 'JOIN enrollments e ON e.student_id = u.id AND e.class_id = ? AND e.status = \'active\'',
      params: [session.class_id],
    };
  }
  return {
    join: 'JOIN enrollments e ON e.student_id = u.id AND e.program_id = ? AND e.status = \'active\'',
    params: [session.program_id],
  };
}

router.get('/sessions', authenticate, async (req, res, next) => {
  try {
    const user = req.user;
    let sql = `
      SELECT s.*, u.name as instructor_name, p.title as program_title,
        pc.name as class_name, pc.code as class_code,
        (SELECT COUNT(*) FROM attendance WHERE session_id = s.id) as marked_count
      FROM attendance_sessions s
      JOIN users u ON u.id = s.instructor_id
      JOIN programs p ON p.id = s.program_id
      LEFT JOIN program_classes pc ON pc.id = s.class_id
      WHERE 1=1
    `;
    const params = [];
    if (user.role === 'student') {
      sql += ` AND (
        (s.class_id IS NULL AND s.program_id IN (SELECT program_id FROM enrollments WHERE student_id = ? AND status = 'active'))
        OR s.class_id IN (SELECT class_id FROM enrollments WHERE student_id = ? AND status = 'active' AND class_id IS NOT NULL)
      )`;
      params.push(user.id, user.id);
    } else if (user.role === 'instructor') {
      sql += ' AND s.instructor_id = ?';
      params.push(user.id);
    }
    sql += ' ORDER BY s.created_at DESC';
    const rows = await db.prepare(sql).all(...params);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.get('/sessions/active', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'student') return res.json([]);
    const rows = await db.prepare(`
      SELECT s.*, u.name as instructor_name, p.title as program_title,
        pc.name as class_name, pc.code as class_code,
        (SELECT id FROM attendance WHERE session_id = s.id AND student_id = ?) as my_attendance_id,
        (SELECT status FROM attendance WHERE session_id = s.id AND student_id = ?) as my_status
      FROM attendance_sessions s
      JOIN users u ON u.id = s.instructor_id
      JOIN programs p ON p.id = s.program_id
      LEFT JOIN program_classes pc ON pc.id = s.class_id
      WHERE (
        (s.class_id IS NULL AND s.program_id IN (SELECT program_id FROM enrollments WHERE student_id = ? AND status = 'active'))
        OR s.class_id IN (SELECT class_id FROM enrollments WHERE student_id = ? AND status = 'active' AND class_id IS NOT NULL)
      )
      ORDER BY s.created_at DESC
    `).all(req.user.id, req.user.id, req.user.id, req.user.id);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post('/sessions', authenticate, authorize('instructor', 'admin'), async (req, res, next) => {
  try {
    const { program_id, date } = req.body;
    const classId = trimString(req.body.class_id, 80);
    if (!program_id || !date) return res.status(400).json({ error: 'Program and date are required' });
    const program = await db.prepare('SELECT id FROM programs WHERE id = ?').get(program_id);
    if (!program) return res.status(400).json({ error: 'Invalid program selected' });
    if (!(await canManageAttendanceProgram(req.user, program_id))) return res.status(403).json({ error: 'You cannot open attendance for this program' });
    if (classId) {
      const classRow = await db.prepare('SELECT id, program_id FROM program_classes WHERE id = ?').get(classId);
      if (!classRow) return res.status(400).json({ error: 'Invalid class selected' });
      if (classRow.program_id !== program_id) return res.status(400).json({ error: 'Class must belong to the selected program' });
      if (!(await canManageAttendanceClass(req.user, classId))) return res.status(403).json({ error: 'You cannot open attendance for this class' });
    }
    const id = uuidv4();
    const closeMinutes = boundedNumber(req.body.closes_at_minutes, 5, 480, 30);
    const closesAt = new Date();
    closesAt.setMinutes(closesAt.getMinutes() + closeMinutes);
    const closesAtTime = closesAt.toTimeString().slice(0, 5);
    await db.prepare('INSERT INTO attendance_sessions (id, instructor_id, program_id, class_id, title, date, closes_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(id, req.user.id, program_id, classId || null, trimString(req.body.title, 200), date, closesAtTime);
    await db.saveDb();
    const session = await db.prepare(`
      SELECT s.*, u.name as instructor_name, p.title as program_title, pc.name as class_name, pc.code as class_code
      FROM attendance_sessions s
      JOIN users u ON u.id = s.instructor_id
      JOIN programs p ON p.id = s.program_id
      LEFT JOIN program_classes pc ON pc.id = s.class_id
      WHERE s.id = ?
    `).get(id);
    res.status(201).json(session);
  } catch (err) {
    next(err);
  }
});

router.put('/sessions/:id', authenticate, authorize('instructor', 'admin'), async (req, res, next) => {
  try {
    const session = await db.prepare('SELECT * FROM attendance_sessions WHERE id = ?').get(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (req.user.role !== 'admin' && session.instructor_id !== req.user.id) return res.status(403).json({ error: 'Not your session' });
    if (session.status === 'closed') return res.status(400).json({ error: 'Cannot edit a closed session' });
    const { program_id, title, date, closes_at_minutes, closes_at, status } = req.body;
    const classId = req.body.class_id === '' ? null : trimString(req.body.class_id ?? session.class_id, 80) || null;
    let newClosesAt = session.closes_at;
    if (closes_at) newClosesAt = closes_at;
    else if (closes_at_minutes) {
      const d = new Date();
      d.setMinutes(d.getMinutes() + parseInt(closes_at_minutes));
      newClosesAt = d.toTimeString().slice(0, 5);
    }
    const newProgramId = program_id || session.program_id;
    if (status && !['open', 'closed'].includes(status)) return res.status(400).json({ error: 'Invalid session status' });
    if (program_id) {
      const prog = await db.prepare('SELECT id FROM programs WHERE id = ?').get(program_id);
      if (!prog) return res.status(400).json({ error: 'Invalid program' });
    }
    if (!(await canManageAttendanceProgram(req.user, newProgramId))) return res.status(403).json({ error: 'You cannot manage attendance for this program' });
    if (classId) {
      const classRow = await db.prepare('SELECT id, program_id FROM program_classes WHERE id = ?').get(classId);
      if (!classRow) return res.status(400).json({ error: 'Invalid class selected' });
      if (classRow.program_id !== newProgramId) return res.status(400).json({ error: 'Class must belong to the selected program' });
      if (!(await canManageAttendanceClass(req.user, classId))) return res.status(403).json({ error: 'You cannot manage attendance for this class' });
    }
    await db.prepare('UPDATE attendance_sessions SET program_id = COALESCE(?, program_id), class_id = ?, title = COALESCE(?, title), date = COALESCE(?, date), closes_at = COALESCE(?, closes_at), status = COALESCE(?, status) WHERE id = ?').run(newProgramId, classId, title, date, newClosesAt, status, req.params.id);
    await db.saveDb();
    const updated = await db.prepare('SELECT s.*, u.name as instructor_name, p.title as program_title, pc.name as class_name, pc.code as class_code, (SELECT COUNT(*) FROM attendance WHERE session_id = s.id) as marked_count FROM attendance_sessions s JOIN users u ON u.id = s.instructor_id JOIN programs p ON p.id = s.program_id LEFT JOIN program_classes pc ON pc.id = s.class_id WHERE s.id = ?').get(req.params.id);
    res.json(updated);
  } catch (err) { next(err); }
});

router.delete('/sessions/:id', authenticate, authorize('instructor', 'admin'), async (req, res, next) => {
  try {
    const session = await db.prepare('SELECT * FROM attendance_sessions WHERE id = ?').get(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (req.user.role !== 'admin' && session.instructor_id !== req.user.id) return res.status(403).json({ error: 'Not your session' });
    await db.prepare('DELETE FROM attendance WHERE session_id = ?').run(req.params.id);
    await db.prepare('DELETE FROM attendance_sessions WHERE id = ?').run(req.params.id);
    await db.saveDb();
    res.json({ message: 'Session deleted' });
  } catch (err) { next(err); }
});

router.post('/sessions/:id/close', authenticate, authorize('instructor', 'admin'), async (req, res, next) => {
  try {
    const session = await db.prepare('SELECT * FROM attendance_sessions WHERE id = ?').get(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (req.user.role !== 'admin' && session.instructor_id !== req.user.id) {
      return res.status(403).json({ error: 'Not your session' });
    }
    await db.prepare("UPDATE attendance_sessions SET status = 'closed' WHERE id = ?").run(req.params.id);
    const roster = activeRosterSql(session);
    const unmarked = await db.prepare(`
      SELECT u.id, u.name FROM users u
      ${roster.join}
      WHERE u.role = 'student' AND u.id NOT IN (SELECT student_id FROM attendance WHERE session_id = ?)
    `).all(...roster.params, req.params.id);
    const now = new Date().toISOString();
    for (const st of unmarked) {
      const aid = uuidv4();
      await db.prepare('INSERT INTO attendance (id, session_id, student_id, program_id, marked_by, date, status, notes, marked_at) VALUES (?,?,?,?,?,?,?,?,?)')
        .run(aid, req.params.id, st.id, session.program_id, req.user.id, session.date, 'absent', 'Auto-marked absent (session closed)', now);
      await db.prepare('INSERT INTO notifications (id, user_id, title, message, type, related_id) VALUES (?, ?, ?, ?, ?, ?)')
        .run(uuidv4(), st.id, 'Attendance Closed', `You were marked absent for ${session.date} - session closed before you marked`, 'attendance', req.params.id);
    }
    await db.saveDb();
    res.json({ message: 'Session closed', auto_marked: unmarked.length, total_attendance: await db.prepare('SELECT COUNT(*) as c FROM attendance WHERE session_id = ?').get(req.params.id).c });
  } catch (err) {
    next(err);
  }
});

router.get('/sessions/:id', authenticate, async (req, res, next) => {
  try {
    const session = await db.prepare(`
      SELECT s.*, u.name as instructor_name, p.title as program_title, pc.name as class_name, pc.code as class_code
      FROM attendance_sessions s
      JOIN users u ON u.id = s.instructor_id
      JOIN programs p ON p.id = s.program_id
      LEFT JOIN program_classes pc ON pc.id = s.class_id
      WHERE s.id = ?
    `).get(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (isStudent(req.user) && !(await canStudentAttendSession(req.user.id, session))) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    if (isInstructor(req.user) && session.instructor_id !== req.user.id) {
      return res.status(403).json({ error: 'Not your session' });
    }
    const records = await db.prepare(`
      SELECT a.*, u.name as student_name, u.email as student_email
      FROM attendance a
      JOIN users u ON u.id = a.student_id
      WHERE a.session_id = ?
      ORDER BY u.name ASC
    `).all(req.params.id);
    const roster = activeRosterSql(session);
    const unmarked = await db.prepare(`
      SELECT u.id, u.name, u.email, e.session as cohort_session, pc.name as class_name, pc.code as class_code
      FROM users u
      ${roster.join}
      LEFT JOIN program_classes pc ON pc.id = e.class_id
      WHERE u.role = 'student' AND u.id NOT IN (SELECT student_id FROM attendance WHERE session_id = ?)
      ORDER BY u.name ASC
    `).all(...roster.params, req.params.id);
    if (isStudent(req.user)) {
      return res.json({
        ...session,
        records: records.filter((record) => record.student_id === req.user.id),
        unmarked: [],
      });
    }
    res.json({ ...session, records, unmarked });
  } catch (err) {
    next(err);
  }
});

router.post('/self-mark', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'student') return res.status(403).json({ error: 'Only students can self-mark' });
    const { session_id } = req.body;
    if (!session_id) return res.status(400).json({ error: 'Session ID required' });
    const session = await db.prepare('SELECT * FROM attendance_sessions WHERE id = ?').get(session_id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (!(await canStudentAttendSession(req.user.id, session))) {
      return res.status(403).json({ error: 'You are not enrolled in this program' });
    }
    const now = new Date().toISOString();
    if (session.status !== 'open') return res.status(400).json({ error: 'Attendance session is closed' });
    if (session.date !== now.slice(0, 10)) return res.status(400).json({ error: 'Session is for a different date' });
    const existing = await db.prepare('SELECT id FROM attendance WHERE session_id = ? AND student_id = ?').get(session_id, req.user.id);
    if (existing) return res.status(400).json({ error: 'Already marked for this session' });
    const [closeH, closeM] = session.closes_at.split(':').map(Number);
    const closeTime = new Date();
    closeTime.setHours(closeH, closeM, 0);
    const isLate = new Date() > closeTime;
    const status = isLate ? 'late' : 'present';
    const notes = isLate ? 'Self-marked late' : 'Self-marked';
    const id = uuidv4();
    await db.prepare('INSERT INTO attendance (id, session_id, student_id, program_id, marked_by, date, status, notes, marked_at) VALUES (?,?,?,?,?,?,?,?,?)')
      .run(id, session_id, req.user.id, session.program_id, req.user.id, session.date, status, notes, now);
    await db.saveDb();
    res.json({ id, status, message: isLate ? 'Marked as late' : 'Attendance marked!' });
  } catch (err) {
    next(err);
  }
});

router.put('/sessions/:id/students/:studentId', authenticate, authorize('instructor', 'admin'), async (req, res, next) => {
  try {
    const { status, notes } = req.body;
    if (!status || !isValidAttendanceStatus(status)) {
      return res.status(400).json({ error: 'Valid status required: present, absent, late, or excused' });
    }
    const session = await db.prepare('SELECT * FROM attendance_sessions WHERE id = ?').get(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (req.user.role !== 'admin' && session.instructor_id !== req.user.id) {
      return res.status(403).json({ error: 'Not your session' });
    }
    const student = await db.prepare('SELECT id, name FROM users WHERE id = ? AND role = ?').get(req.params.studentId, 'student');
    if (!student) return res.status(404).json({ error: 'Student not found' });
    if (!(await canStudentAttendSession(req.params.studentId, session))) {
      return res.status(400).json({ error: 'Student is not actively enrolled in this session roster' });
    }
    const now = new Date().toISOString();
    const existing = await db.prepare('SELECT id FROM attendance WHERE session_id = ? AND student_id = ?').get(req.params.id, req.params.studentId);
    if (existing) {
      await db.prepare('UPDATE attendance SET status = ?, notes = ?, marked_by = ?, marked_at = ? WHERE id = ?')
        .run(status, notes || `Overridden by ${req.user.name}`, req.user.id, now, existing.id);
    } else {
      await db.prepare('INSERT INTO attendance (id, session_id, student_id, program_id, marked_by, date, status, notes, marked_at) VALUES (?,?,?,?,?,?,?,?,?)')
        .run(uuidv4(), req.params.id, req.params.studentId, session.program_id, req.user.id, session.date, status, notes || `Marked as ${status} by ${req.user.name}`, now);
    }
    await db.saveDb();
    await db.prepare('INSERT INTO notifications (id, user_id, title, message, type, related_id) VALUES (?, ?, ?, ?, ?, ?)')
      .run(uuidv4(), req.params.studentId, 'Attendance Updated', `Your attendance for ${session.date} has been updated to ${status}`, 'attendance', req.params.id);
    res.json({ message: `Student marked as ${status}` });
  } catch (err) {
    next(err);
  }
});

router.get('/', authenticate, async (req, res, next) => {
  try {
    const { status } = req.query;
    let sql = `
      SELECT a.*, u.name as student_name, p.title as program_title,
        s.title as session_title, s.closes_at, ins.name as instructor_name,
        pc.name as class_name, pc.code as class_code
      FROM attendance a
      JOIN attendance_sessions s ON s.id = a.session_id
      JOIN users u ON u.id = a.student_id
      JOIN programs p ON p.id = a.program_id
      JOIN users ins ON ins.id = s.instructor_id
      LEFT JOIN program_classes pc ON pc.id = s.class_id
      WHERE 1=1
    `;
    const params = [];
    if (req.user.role === 'student') {
      sql += ' AND a.student_id = ?';
      params.push(req.user.id);
    } else if (req.user.role === 'instructor') {
      sql += ' AND s.instructor_id = ?';
      params.push(req.user.id);
    }
    if (status) { sql += ' AND a.status = ?'; params.push(status); }
    sql += ' ORDER BY a.created_at DESC LIMIT 50';
    const rows = await db.prepare(sql).all(...params);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.get('/summary', authenticate, async (req, res, next) => {
  try {
    if (req.user.role === 'student') {
      const rows = await db.prepare('SELECT a.status, COUNT(*) as count FROM attendance a WHERE a.student_id = ? GROUP BY a.status').all(req.user.id);
      const total = rows.reduce((s, r) => s + r.count, 0);
      const summary = { present: 0, absent: 0, late: 0, excused: 0, total };
      rows.forEach(r => { summary[r.status] = r.count; });
      summary.percentage = total > 0 ? Math.round((summary.present + summary.late) / total * 100) : 0;
      return res.json(summary);
    }
    let sql = 'SELECT a.status, COUNT(*) as count FROM attendance a JOIN attendance_sessions s ON s.id = a.session_id WHERE 1=1';
    const params = [];
    if (req.user.role !== 'admin') { sql += ' AND s.instructor_id = ?'; params.push(req.user.id); }
    sql += ' GROUP BY a.status';
    const stats = await db.prepare(sql).all(...params);
    const total = stats.reduce((s, r) => s + r.count, 0);
    const summary = { present: 0, absent: 0, late: 0, excused: 0, total };
    stats.forEach(r => { summary[r.status] = r.count; });
    summary.percentage = total > 0 ? Math.round((summary.present + summary.late) / total * 100) : 0;
    res.json(summary);
  } catch (err) {
    next(err);
  }
});

router.get('/students', authenticate, authorize('instructor', 'admin'), async (req, res, next) => {
  try {
    const programIds = await instructorProgramIds(db, req.user);
    const scopeSql = isAdmin(req.user) ? '' : ` AND e.program_id IN (${programIds.map(() => '?').join(',')})`;
    if (!isAdmin(req.user) && !programIds.length) return res.json([]);
    const rows = await db.prepare(`
      SELECT DISTINCT u.id, u.name, u.email, u.avatar, e.session,
        p.title as program_title, p.id as program_id, pc.name as class_name, pc.code as class_code, pc.id as class_id
      FROM users u
      JOIN enrollments e ON e.student_id = u.id
      JOIN programs p ON p.id = e.program_id
      LEFT JOIN program_classes pc ON pc.id = e.class_id
      WHERE u.role = 'student' AND e.status = 'active'${scopeSql}
      ORDER BY u.name ASC
    `).all(...(isAdmin(req.user) ? [] : programIds));
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /students/:studentId — per-student attendance lookup.
 * Instructors see only sessions they created; admins see all sessions.
 * Returns the student profile plus their attendance records and summary.
 */
router.get('/students/:studentId', authenticate, authorize('instructor', 'admin'), async (req, res, next) => {
  try {
    const student = await db.prepare('SELECT id, name, email, avatar FROM users WHERE id = ? AND role = ?').get(req.params.studentId, 'student');
    if (!student) return res.status(404).json({ error: 'Student not found' });

    let sql = `
      SELECT a.*, s.title as session_title, p.title as program_title,
        ins.name as instructor_name, s.date as session_date, pc.name as class_name, pc.code as class_code
      FROM attendance a
      JOIN attendance_sessions s ON s.id = a.session_id
      JOIN programs p ON p.id = a.program_id
      JOIN users ins ON ins.id = s.instructor_id
      LEFT JOIN program_classes pc ON pc.id = s.class_id
      WHERE a.student_id = ?
    `;
    const params = [req.params.studentId];
    if (req.user.role !== 'admin') {
      sql += ' AND s.instructor_id = ?';
      params.push(req.user.id);
    }
    sql += ' ORDER BY a.created_at DESC';
    const records = await db.prepare(sql).all(...params);

    const statsRows = await db.prepare('SELECT a.status, COUNT(*) as count FROM attendance a JOIN attendance_sessions s ON s.id = a.session_id WHERE a.student_id = ?' + (req.user.role !== 'admin' ? ' AND s.instructor_id = ?' : '') + ' GROUP BY a.status')
      .all(req.params.studentId, ...(req.user.role !== 'admin' ? [req.user.id] : []));
    const total = statsRows.reduce((s, r) => s + r.count, 0);
    const summary = { present: 0, absent: 0, late: 0, excused: 0, total };
    statsRows.forEach(r => { summary[r.status] = r.count; });
    summary.percentage = total > 0 ? Math.round((summary.present + summary.late) / total * 100) : 0;

    res.json({ student, records, summary });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
