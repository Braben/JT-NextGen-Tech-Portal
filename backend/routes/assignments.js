/**
 * Assignments - CRUD for class assignments
 *
 * Routes in this file:
 *   GET    /              - List assignments (filtered by role)
 *   GET    /:id           - Single assignment
 *   POST   /              - Create (instructor/admin only)
 *   PUT    /:id           - Update (instructor/admin only)
 *   DELETE /:id           - Delete (instructor/admin only)
 *
 * All routes require authentication.
 * Write operations also require authorize('instructor', 'admin').
 * Parameterised queries used throughout (SQL injection safe).
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const sanitizeHtml = require('sanitize-html');
const db = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const { boundedNumber, trimString } = require('../lib/validators');

const cleanHtml = (html) => sanitizeHtml(html || '', {
  allowedTags: ['p','b','strong','i','em','u','s','ul','ol','li','a','img','table','thead','tbody','tr','th','td','br','span','div','h1','h2','h3','h4','blockquote','pre','code','hr'],
  allowedAttributes: { a: ['href','target'], img: ['src','alt'], table: ['border'], th: ['colspan'] },
  disallowedTagsMode: 'discard',
});

const router = express.Router();

function assignmentSelect(whereClause = '') {
  return `
    SELECT a.*, u.name as instructor_name, p.title as program_title,
           pc.name as class_name, pc.code as class_code,
           (SELECT COUNT(*) FROM submissions s WHERE s.assignment_id = a.id) as submissionCount
    FROM assignments a
    JOIN users u ON a.instructor_id = u.id
    LEFT JOIN programs p ON p.id = a.program_id
    LEFT JOIN program_classes pc ON pc.id = a.class_id
    ${whereClause}
  `;
}

function studentVisibilityClause(alias = 'a') {
  return `
    (${alias}.program_id IS NULL OR EXISTS (
      SELECT 1 FROM enrollments e
      WHERE e.student_id = ? AND e.status = 'active'
        AND (
          (${alias}.class_id IS NOT NULL AND e.class_id = ${alias}.class_id)
          OR (${alias}.class_id IS NULL AND e.program_id = ${alias}.program_id)
        )
    ))
  `;
}

async function canStudentAccessAssignment(studentId, assignment) {
  if (!assignment) return false;
  if (!assignment.program_id) return true;
  const row = await db.prepare(`
    SELECT id FROM enrollments
    WHERE student_id = ? AND status = 'active'
      AND (
        (? IS NOT NULL AND class_id = ?)
        OR (? IS NULL AND program_id = ?)
      )
    LIMIT 1
  `).get(studentId, assignment.class_id, assignment.class_id, assignment.class_id, assignment.program_id);
  return Boolean(row);
}

async function resolveAssignmentScope(user, body = {}, existing = {}) {
  const programId = body.program_id !== undefined
    ? trimString(body.program_id, 80)
    : (existing.program_id || null);
  const classId = body.class_id === ''
    ? null
    : body.class_id !== undefined
      ? trimString(body.class_id, 80) || null
      : (existing.class_id || null);

  // Existing legacy assignments may remain unscoped, but every newly created
  // assignment must name a programme so notifications and student access stay tight.
  if (!existing.id && !programId) {
    return { error: 'Program is required for assignments', fieldErrors: { program_id: 'Program is required' } };
  }
  if (!programId) return { program_id: null, class_id: null };

  const program = await db.prepare('SELECT id FROM programs WHERE id = ?').get(programId);
  if (!program) return { error: 'Choose a valid program', fieldErrors: { program_id: 'Choose a valid program' } };

  if (classId) {
    const classRow = await db.prepare('SELECT id, program_id, instructor_id FROM program_classes WHERE id = ?').get(classId);
    if (!classRow) return { error: 'Choose a valid class', fieldErrors: { class_id: 'Choose a valid class' } };
    if (classRow.program_id !== programId) return { error: 'Class must belong to the selected program', fieldErrors: { class_id: 'Class must belong to the selected program' } };
    if (user.role === 'instructor' && classRow.instructor_id !== user.id) {
      return { error: 'You can only assign work to classes you teach', fieldErrors: { class_id: 'Choose one of your assigned classes' }, status: 403 };
    }
  } else if (user.role === 'instructor') {
    const teachesProgram = await db.prepare('SELECT id FROM program_classes WHERE program_id = ? AND instructor_id = ? LIMIT 1').get(programId, user.id);
    if (!teachesProgram) {
      return { error: 'You can only assign work to programmes you teach', fieldErrors: { program_id: 'Choose a programme you teach' }, status: 403 };
    }
  }

  return { program_id: programId, class_id: classId };
}

async function getScopedRecipients(assignment) {
  if (assignment.class_id) {
    return db.prepare(`
      SELECT DISTINCT u.id
      FROM enrollments e
      JOIN users u ON u.id = e.student_id
      WHERE e.class_id = ? AND e.status = 'active'
    `).all(assignment.class_id);
  }
  if (assignment.program_id) {
    return db.prepare(`
      SELECT DISTINCT u.id
      FROM enrollments e
      JOIN users u ON u.id = e.student_id
      WHERE e.program_id = ? AND e.status = 'active'
    `).all(assignment.program_id);
  }
  return db.prepare("SELECT id FROM users WHERE role = 'student'").all();
}

router.get('/', authenticate, async (req, res, next) => {
  try {
    const user = req.user;
    let rows;
    if (user.role === 'admin') {
      rows = await db.prepare(`${assignmentSelect()} ORDER BY a.created_at DESC`).all();
    } else if (user.role === 'instructor') {
      rows = await db.prepare(`${assignmentSelect('WHERE a.instructor_id = ?')} ORDER BY a.created_at DESC`).all(user.id);
    } else {
      rows = await db.prepare(`${assignmentSelect(`WHERE ${studentVisibilityClause('a')}`)} ORDER BY a.created_at DESC`).all(user.id);
    }
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const assignment = await db.prepare(`${assignmentSelect('WHERE a.id = ?')}`).get(req.params.id);
    if (!assignment) return res.status(404).json({ error: 'Assignment not found' });
    if (req.user.role === 'instructor' && assignment.instructor_id !== req.user.id) return res.status(403).json({ error: 'Unauthorized' });
    if (req.user.role === 'student' && !(await canStudentAccessAssignment(req.user.id, assignment))) return res.status(403).json({ error: 'Unauthorized' });
    res.json(assignment);
  } catch (err) {
    next(err);
  }
});

router.post('/', authenticate, authorize('instructor', 'admin'), async (req, res, next) => {
  try {
    const title = trimString(req.body.title, 200);
    const description = trimString(req.body.description, 5000);
    const { instructions, rubric, due_date } = req.body;
    if (!title || !description) {
      return res.status(400).json({ error: 'Title and description are required' });
    }
    const scope = await resolveAssignmentScope(req.user, req.body);
    if (scope.error) return res.status(scope.status || 400).json({ error: scope.error, fieldErrors: scope.fieldErrors });
    const safeInstructions = cleanHtml(instructions);
    const maxScore = boundedNumber(req.body.max_score, 1, 1000, 100);
    const id = uuidv4();
    await db.prepare(`
      INSERT INTO assignments (id, instructor_id, title, description, program_id, class_id, instructions, rubric, max_score, due_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, req.user.id, title, description, scope.program_id, scope.class_id, safeInstructions, trimString(rubric, 5000), maxScore, due_date || null);

    const students = await getScopedRecipients(scope);
    const insertNotif = db.prepare('INSERT INTO notifications (id, user_id, title, message, type, related_id) VALUES (?, ?, ?, ?, ?, ?)');
    for (const s of students) {
      await insertNotif.run(uuidv4(), s.id, 'New Assignment', `New assignment: "${title}" has been posted. Due: ${due_date || 'No deadline'}`, 'assignment', id);
    }
    await db.saveDb();
    try {
      const { getIO } = require('../services/socket');
      const io = getIO();
      if (io) {
        for (const s of students) {
          io.to(`user:${s.id}`).emit('notifications:new', { title: 'New Assignment', message: `New assignment: "${title}"`, type: 'assignment', related_id: id });
        }
      }
    } catch {}

    const assignment = await db.prepare('SELECT * FROM assignments WHERE id = ?').get(id);
    res.status(201).json(assignment);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', authenticate, authorize('instructor', 'admin'), async (req, res, next) => {
  try {
    const { instructions, rubric, due_date } = req.body;
    const title = req.body.title !== undefined ? trimString(req.body.title, 200) : undefined;
    const description = req.body.description !== undefined ? trimString(req.body.description, 5000) : undefined;
    const existing = req.user.role === 'admin'
      ? await db.prepare('SELECT * FROM assignments WHERE id = ?').get(req.params.id)
      : await db.prepare('SELECT * FROM assignments WHERE id = ? AND instructor_id = ?').get(req.params.id, req.user.id);
    if (!existing) return res.status(404).json({ error: 'Assignment not found or unauthorized' });
    const scope = await resolveAssignmentScope(req.user, req.body, existing);
    if (scope.error) return res.status(scope.status || 400).json({ error: scope.error, fieldErrors: scope.fieldErrors });
    const safeInstructions = instructions !== undefined ? cleanHtml(instructions) : existing.instructions;
    const maxScore = req.body.max_score !== undefined ? boundedNumber(req.body.max_score, 1, 1000, existing.max_score) : existing.max_score;

    await db.prepare(`
      UPDATE assignments SET title=?, description=?, program_id=?, class_id=?, instructions=?, rubric=?, max_score=?, due_date=?, updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `).run(
      title || existing.title,
      description || existing.description,
      scope.program_id,
      scope.class_id,
      safeInstructions,
      rubric !== undefined ? trimString(rubric, 5000) : existing.rubric,
      maxScore,
      due_date !== undefined ? due_date : existing.due_date,
      req.params.id
    );
    const updated = await db.prepare('SELECT * FROM assignments WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', authenticate, authorize('instructor', 'admin'), async (req, res, next) => {
  try {
    const existing = req.user.role === 'admin'
      ? await db.prepare('SELECT * FROM assignments WHERE id = ?').get(req.params.id)
      : await db.prepare('SELECT * FROM assignments WHERE id = ? AND instructor_id = ?').get(req.params.id, req.user.id);
    if (!existing) return res.status(404).json({ error: 'Assignment not found or unauthorized' });
    await db.prepare('DELETE FROM assignments WHERE id = ?').run(req.params.id);
    res.json({ message: 'Assignment deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;



