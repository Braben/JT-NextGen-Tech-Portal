/**
 * Program classes - cohort allocation, rosters, and class communication.
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const { isAdmin, isInstructor, isStudent } = require('../lib/accessControl');
const { trimString } = require('../lib/validators');
const audit = require('../services/audit');

const router = express.Router();

const classStatuses = new Set(['planned', 'active', 'completed', 'archived']);
const sessions = new Set(['Morning', 'Evening']);

function cleanClassInput(body = {}, existing = {}) {
  const name = trimString(body.name ?? existing.name, 120);
  const code = trimString(body.code ?? existing.code, 40).toUpperCase().replace(/\s+/g, '-');
  return {
    program_id: trimString(body.program_id ?? existing.program_id, 80),
    instructor_id: body.instructor_id === '' ? null : trimString(body.instructor_id ?? existing.instructor_id, 80) || null,
    name,
    code,
    session: trimString(body.session ?? existing.session ?? 'Morning', 20),
    capacity: Number(body.capacity ?? existing.capacity ?? 25),
    start_date: trimString(body.start_date ?? existing.start_date, 20),
    end_date: trimString(body.end_date ?? existing.end_date, 20),
    status: trimString(body.status ?? existing.status ?? 'planned', 20),
  };
}

function validateClassInput(input) {
  if (!input.program_id) return ['program_id', 'Program is required'];
  if (!input.name) return ['name', 'Class name is required'];
  if (!input.code || !/^[A-Z0-9-]{2,40}$/.test(input.code)) return ['code', 'Use 2-40 letters, numbers, or hyphens for class code'];
  if (!sessions.has(input.session)) return ['session', 'Session must be Morning or Evening'];
  if (!Number.isInteger(input.capacity) || input.capacity < 1 || input.capacity > 500) return ['capacity', 'Capacity must be between 1 and 500'];
  if (!classStatuses.has(input.status)) return ['status', 'Choose a valid class status'];
  return null;
}

function validationResponse(res, field, message, status = 400) {
  return res.status(status).json({ error: message, fieldErrors: { [field]: message } });
}

async function getClassById(id) {
  return db.prepare(`
    SELECT pc.*, p.title as program_title, i.name as instructor_name, i.email as instructor_email,
      (SELECT COUNT(*) FROM enrollments e WHERE e.class_id = pc.id) as allocated_count,
      (SELECT COUNT(*) FROM enrollments e WHERE e.class_id = pc.id AND e.status = 'active') as active_count
    FROM program_classes pc
    JOIN programs p ON p.id = pc.program_id
    LEFT JOIN users i ON i.id = pc.instructor_id
    WHERE pc.id = ?
  `).get(id);
}

async function canUseClass(user, classRow) {
  if (!classRow) return false;
  if (isAdmin(user)) return true;
  if (isInstructor(user)) return classRow.instructor_id === user.id;
  if (!isStudent(user)) return false;
  const row = await db.prepare('SELECT id FROM enrollments WHERE student_id = ? AND class_id = ?').get(user.id, classRow.id);
  return Boolean(row);
}

async function createClassForum(classRow) {
  const forumId = uuidv4();
  await db.prepare(`
    INSERT INTO forum_categories (id, name, description, type, session, program_id, class_id)
    VALUES (?, ?, ?, 'cohort', ?, ?, ?)
  `).run(
    forumId,
    `${classRow.name} Discussion`,
    `Class discussion space for ${classRow.program_title || 'this programme'}.`,
    classRow.session,
    classRow.program_id,
    classRow.id,
  );
  await db.prepare('UPDATE program_classes SET forum_category_id = ?, updated_at = ? WHERE id = ?')
    .run(forumId, new Date().toISOString(), classRow.id);
  return forumId;
}

router.get('/', authenticate, async (req, res, next) => {
  try {
    let rows;
    if (isAdmin(req.user)) {
      rows = await db.prepare(`
        SELECT pc.*, p.title as program_title, i.name as instructor_name,
          (SELECT COUNT(*) FROM enrollments e WHERE e.class_id = pc.id) as allocated_count,
          (SELECT COUNT(*) FROM enrollments e WHERE e.class_id = pc.id AND e.status = 'active') as active_count
        FROM program_classes pc
        JOIN programs p ON p.id = pc.program_id
        LEFT JOIN users i ON i.id = pc.instructor_id
        ORDER BY pc.created_at DESC
      `).all();
    } else if (isInstructor(req.user)) {
      rows = await db.prepare(`
        SELECT pc.*, p.title as program_title, i.name as instructor_name,
          (SELECT COUNT(*) FROM enrollments e WHERE e.class_id = pc.id) as allocated_count,
          (SELECT COUNT(*) FROM enrollments e WHERE e.class_id = pc.id AND e.status = 'active') as active_count
        FROM program_classes pc
        JOIN programs p ON p.id = pc.program_id
        LEFT JOIN users i ON i.id = pc.instructor_id
        WHERE pc.instructor_id = ?
        ORDER BY pc.created_at DESC
      `).all(req.user.id);
    } else if (isStudent(req.user)) {
      rows = await db.prepare(`
        SELECT pc.*, p.title as program_title, i.name as instructor_name, e.status as enrollment_status,
          (SELECT COUNT(*) FROM enrollments roster WHERE roster.class_id = pc.id) as allocated_count,
          (SELECT COUNT(*) FROM enrollments roster WHERE roster.class_id = pc.id AND roster.status = 'active') as active_count
        FROM enrollments e
        JOIN program_classes pc ON pc.id = e.class_id
        JOIN programs p ON p.id = pc.program_id
        LEFT JOIN users i ON i.id = pc.instructor_id
        WHERE e.student_id = ?
        ORDER BY pc.start_date ASC, pc.created_at DESC
      `).all(req.user.id);
    } else {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const input = cleanClassInput(req.body);
    const invalid = validateClassInput(input);
    if (invalid) return validationResponse(res, invalid[0], invalid[1]);

    const program = await db.prepare('SELECT id, title FROM programs WHERE id = ?').get(input.program_id);
    if (!program) return validationResponse(res, 'program_id', 'Choose a valid program');
    if (input.instructor_id) {
      const instructor = await db.prepare("SELECT id FROM users WHERE id = ? AND role = 'instructor'").get(input.instructor_id);
      if (!instructor) return validationResponse(res, 'instructor_id', 'Choose a valid instructor');
    }
    const existingCode = await db.prepare('SELECT id FROM program_classes WHERE code = ?').get(input.code);
    if (existingCode) return validationResponse(res, 'code', 'Class code already exists', 409);

    const id = uuidv4();
    await db.prepare(`
      INSERT INTO program_classes (id, program_id, instructor_id, name, code, session, capacity, start_date, end_date, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, input.program_id, input.instructor_id, input.name, input.code, input.session, input.capacity, input.start_date, input.end_date, input.status);

    let row = await getClassById(id);
    const forumId = await createClassForum(row);
    await db.saveDb?.();
    await audit(req.user, 'class.create', 'program_class', id, `Created class ${input.code}`);

    row = await getClassById(id);
    res.status(201).json({ ...row, forum_category_id: forumId });
  } catch (err) { next(err); }
});

router.put('/:id', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const existing = await getClassById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Class not found' });

    const input = cleanClassInput(req.body, existing);
    const invalid = validateClassInput(input);
    if (invalid) return validationResponse(res, invalid[0], invalid[1]);
    if (input.capacity < Number(existing.allocated_count || 0)) {
      return validationResponse(res, 'capacity', 'Capacity cannot be lower than allocated students');
    }
    if (input.instructor_id) {
      const instructor = await db.prepare("SELECT id FROM users WHERE id = ? AND role = 'instructor'").get(input.instructor_id);
      if (!instructor) return validationResponse(res, 'instructor_id', 'Choose a valid instructor');
    }
    const codeOwner = await db.prepare('SELECT id FROM program_classes WHERE code = ? AND id != ?').get(input.code, req.params.id);
    if (codeOwner) return validationResponse(res, 'code', 'Class code already exists', 409);

    await db.prepare(`
      UPDATE program_classes
      SET instructor_id = ?, name = ?, code = ?, session = ?, capacity = ?, start_date = ?,
          end_date = ?, status = ?, updated_at = ?
      WHERE id = ?
    `).run(input.instructor_id, input.name, input.code, input.session, input.capacity, input.start_date, input.end_date, input.status, new Date().toISOString(), req.params.id);
    await db.saveDb?.();
    await audit(req.user, 'class.update', 'program_class', req.params.id, `Updated class ${input.code}`);
    res.json(await getClassById(req.params.id));
  } catch (err) { next(err); }
});

router.get('/:id/roster', authenticate, async (req, res, next) => {
  try {
    const classRow = await getClassById(req.params.id);
    if (!classRow) return res.status(404).json({ error: 'Class not found' });
    if (!(await canUseClass(req.user, classRow))) return res.status(403).json({ error: 'Unauthorized' });

    const rows = await db.prepare(`
      SELECT e.*, u.name as student_name, u.email as student_email, u.phone as student_phone
      FROM enrollments e
      JOIN users u ON u.id = e.student_id
      WHERE e.class_id = ?
      ORDER BY u.name ASC
    `).all(req.params.id);
    res.json({ class: classRow, students: rows });
  } catch (err) { next(err); }
});

router.post('/:id/allocate', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const classRow = await getClassById(req.params.id);
    if (!classRow) return res.status(404).json({ error: 'Class not found' });

    const enrollmentIds = Array.isArray(req.body.enrollment_ids)
      ? [...new Set(req.body.enrollment_ids.map((id) => trimString(id, 80)).filter(Boolean))]
      : [];
    if (!enrollmentIds.length) return validationResponse(res, 'enrollment_ids', 'Select at least one student');

    const placeholders = enrollmentIds.map(() => '?').join(',');
    const enrollments = await db.prepare(`
      SELECT e.*, u.name as student_name
      FROM enrollments e
      JOIN users u ON u.id = e.student_id
      WHERE e.id IN (${placeholders})
    `).all(...enrollmentIds);
    if (enrollments.length !== enrollmentIds.length) return validationResponse(res, 'enrollment_ids', 'One or more enrollments could not be found');
    if (enrollments.some((item) => item.program_id !== classRow.program_id)) return validationResponse(res, 'enrollment_ids', 'Students must belong to the same program as the class');
    if (enrollments.some((item) => ['completed', 'dropped'].includes(item.status))) return validationResponse(res, 'enrollment_ids', 'Completed or dropped enrollments cannot be allocated');

    const currentCount = Number(classRow.allocated_count || 0);
    const incomingCount = enrollments.filter((item) => item.class_id !== classRow.id).length;
    if (currentCount + incomingCount > Number(classRow.capacity)) {
      return validationResponse(res, 'capacity', 'Class capacity would be exceeded');
    }

    for (const enrollment of enrollments) {
      await db.prepare('UPDATE enrollments SET class_id = ?, session = ? WHERE id = ?').run(classRow.id, classRow.session, enrollment.id);
      await db.prepare('INSERT INTO notifications (id, user_id, title, message, type, related_id) VALUES (?, ?, ?, ?, ?, ?)')
        .run(uuidv4(), enrollment.student_id, 'Class Assigned', `You have been assigned to ${classRow.name}.`, 'class', classRow.id);
    }
    await db.saveDb?.();
    await audit(req.user, 'class.allocate', 'program_class', classRow.id, `Allocated ${enrollments.length} enrollment(s) to ${classRow.code}`);

    res.json({
      class: await getClassById(classRow.id),
      allocated_count: enrollments.length,
    });
  } catch (err) { next(err); }
});

router.post('/:id/message', authenticate, authorize('admin', 'instructor'), async (req, res, next) => {
  try {
    const classRow = await getClassById(req.params.id);
    if (!classRow) return res.status(404).json({ error: 'Class not found' });
    if (!isAdmin(req.user) && classRow.instructor_id !== req.user.id) return res.status(403).json({ error: 'Unauthorized' });

    const content = trimString(req.body.content, 4000);
    if (!content) return validationResponse(res, 'content', 'Message content is required');

    const recipients = await db.prepare(`
      SELECT DISTINCT u.id, u.name
      FROM enrollments e
      JOIN users u ON u.id = e.student_id
      WHERE e.class_id = ? AND e.status IN ('pending','active')
    `).all(classRow.id);
    if (!recipients.length) return res.status(400).json({ error: 'This class has no students to message' });

    const now = new Date().toISOString();
    for (const recipient of recipients) {
      const messageId = uuidv4();
      await db.prepare('INSERT INTO messages (id, sender_id, receiver_id, content) VALUES (?, ?, ?, ?)')
        .run(messageId, req.user.id, recipient.id, content);
      await db.prepare('INSERT INTO notifications (id, user_id, title, message, type, related_id) VALUES (?, ?, ?, ?, ?, ?)')
        .run(uuidv4(), recipient.id, 'New Class Message', `${req.user.name} sent a message to ${classRow.name}`, 'message', messageId);

      try {
        const { getIO } = require('../services/socket');
        const io = getIO();
        if (io) {
          const payload = { id: messageId, content, sender_id: req.user.id, receiver_id: recipient.id, created_at: now, is_read: 0, sender_name: req.user.name };
          io.to(`user:${recipient.id}`).emit('messages:new', payload);
          io.to(`user:${recipient.id}`).emit('notifications:new', { title: 'New Class Message', message: `${req.user.name} sent a message to ${classRow.name}`, type: 'message', related_id: messageId });
        }
      } catch {}
    }
    await db.saveDb?.();
    await audit(req.user, 'class.message', 'program_class', classRow.id, `Sent class message to ${recipients.length} student(s)`);
    res.status(201).json({ sent: recipients.length });
  } catch (err) { next(err); }
});

module.exports = router;
