/**
 * Submissions - Assignment submission, file upload, status
 */


const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const sanitizeHtml = require('sanitize-html');
const db = require('../config/db');
const { authenticate } = require('../middleware/auth');
const {
  canViewSubmission,
  getSubmission,
  isAdmin,
  isInstructor,
  isStudent,
} = require('../lib/accessControl');

const cleanHtml = (h) => sanitizeHtml(h || '', { allowedTags: ['p','b','strong','i','em','u','s','ul','ol','li','a','br','span','div','h1','h2','h3','blockquote','pre','code'], allowedAttributes: { a: ['href'] }, disallowedTagsMode: 'discard' });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'uploads')),
  filename: (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`),
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.docx', '.doc', '.txt', '.rtf', '.odt'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) return cb(null, true);
    const err = new Error('Only PDF, DOCX, DOC, TXT, RTF, ODT files are allowed');
    err.status = 400;
    cb(err);
  },
});

const router = express.Router();

async function canSubmitAssignment(studentId, assignment) {
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

router.get('/my', authenticate, async (req, res, next) => {
  try {
    const rows = await db.prepare(`
      SELECT s.*, a.title as assignment_title, a.due_date, g.score, g.feedback, g.manually_overridden
      FROM submissions s
      JOIN assignments a ON s.assignment_id = a.id
      LEFT JOIN grades g ON g.submission_id = s.id
      WHERE s.student_id = ?
      ORDER BY s.submitted_at DESC
    `).all(req.user.id);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.get('/assignment/:assignmentId', authenticate, async (req, res, next) => {
  try {
    const assignment = await db.prepare('SELECT instructor_id FROM assignments WHERE id = ?').get(req.params.assignmentId);
    if (!assignment) return res.status(404).json({ error: 'Assignment not found' });
    if (!isAdmin(req.user) && (!isInstructor(req.user) || assignment.instructor_id !== req.user.id)) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    const rows = await db.prepare(`
      SELECT s.*, u.name as student_name, u.email as student_email,
             g.score, g.feedback, g.strengths, g.weaknesses, g.suggestions,
             g.ai_score, g.manually_overridden, g.graded_by, g.graded_at
      FROM submissions s
      JOIN users u ON s.student_id = u.id
      LEFT JOIN grades g ON g.submission_id = s.id
      WHERE s.assignment_id = ?
      ORDER BY s.submitted_at DESC
    `).all(req.params.assignmentId);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const submission = await db.prepare(`
      SELECT s.*, a.instructor_id, a.title as assignment_title, a.description as assignment_desc,
             a.instructions, a.rubric, a.max_score, u.name as student_name,
             g.score, g.feedback, g.strengths, g.weaknesses, g.suggestions,
             g.ai_score, g.ai_feedback, g.manually_overridden, g.graded_by, g.graded_at
      FROM submissions s
      JOIN assignments a ON s.assignment_id = a.id
      JOIN users u ON s.student_id = u.id
      LEFT JOIN grades g ON g.submission_id = s.id
      WHERE s.id = ?
    `).get(req.params.id);
    if (!submission) return res.status(404).json({ error: 'Submission not found' });
    if (!canViewSubmission(req.user, submission)) return res.status(403).json({ error: 'Unauthorized' });
    res.json(submission);
  } catch (err) {
    next(err);
  }
});

router.post('/', authenticate, upload.single('file'), async (req, res, next) => {
  try {
    if (!isStudent(req.user)) return res.status(403).json({ error: 'Only students can submit assignments' });
    const { assignment_id, content } = req.body;
    if (!assignment_id) {
      return res.status(400).json({ error: 'Assignment ID is required' });
    }
    const assignment = await db.prepare('SELECT id, program_id, class_id FROM assignments WHERE id = ?').get(assignment_id);
    if (!assignment) return res.status(404).json({ error: 'Assignment not found' });
    if (!(await canSubmitAssignment(req.user.id, assignment))) {
      return res.status(403).json({ error: 'You are not enrolled in this assignment scope' });
    }
    const existing = await db.prepare('SELECT id FROM submissions WHERE assignment_id = ? AND student_id = ?').get(assignment_id, req.user.id);
    if (existing) {
      return res.status(409).json({ error: 'You have already submitted this assignment' });
    }
    const id = uuidv4();
    const filePath = req.file ? `/uploads/${req.file.filename}` : null;
    const fileType = req.file ? req.file.mimetype : null;
    const safeContent = cleanHtml(content);
    await db.prepare(`
      INSERT INTO submissions (id, assignment_id, student_id, content, file_path, file_type, status)
      VALUES (?, ?, ?, ?, ?, ?, 'submitted')
    `).run(id, assignment_id, req.user.id, safeContent, filePath, fileType);

    const instructors = await db.prepare(`
      SELECT DISTINCT u.id FROM users u
      JOIN assignments a ON a.instructor_id = u.id
      WHERE a.id = ?
    `).all(assignment_id);
    for (const inst of instructors) {
      await db.prepare('INSERT INTO notifications (id, user_id, title, message, type, related_id) VALUES (?, ?, ?, ?, ?, ?)').run(uuidv4(), inst.id, 'New Submission', `${req.user.name} submitted work for an assignment.`, 'submission', id);
    }
    await db.saveDb();
    try {
      const { getIO } = require('../services/socket');
      const io = getIO();
      if (io) {
        for (const inst of instructors) {
          io.to(`user:${inst.id}`).emit('notifications:new', { title: 'New Submission', message: `${req.user.name} submitted work`, type: 'submission', related_id: id });
        }
      }
    } catch {}

    const submission = await db.prepare('SELECT * FROM submissions WHERE id = ?').get(id);
    res.status(201).json(submission);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', authenticate, upload.single('file'), async (req, res, next) => {
  try {
    const existing = await getSubmission(db, req.params.id);
    if (existing && existing.student_id !== req.user.id) return res.status(403).json({ error: 'Unauthorized' });
    if (!existing) return res.status(404).json({ error: 'Submission not found or unauthorized' });

    const rawContent = req.body.content !== undefined ? req.body.content : existing.content;
    const safeContent = cleanHtml(rawContent);
    const filePath = req.file ? `/uploads/${req.file.filename}` : existing.file_path;
    const fileType = req.file ? req.file.mimetype : existing.file_type;
    await db.prepare('UPDATE submissions SET content=?, file_path=?, file_type=?, status=? WHERE id=?').run(safeContent, filePath, fileType, 'resubmitted', req.params.id);
    await db.saveDb();
    const updated = await db.prepare('SELECT * FROM submissions WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
