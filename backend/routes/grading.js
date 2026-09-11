/**
 * Grading - AI-assisted and manual grade assignment
 */


const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const { gradeSubmission } = require('../services/openrouter');
const { ACTIONS, canPerform, getSubmission } = require('../lib/accessControl');
const { boundedNumber, trimString } = require('../lib/validators');
const audit = require('../services/audit');

const router = express.Router();

router.post('/ai/:submissionId', authenticate, authorize('instructor', 'admin'), async (req, res, next) => {
  try {
    const submission = await getSubmission(db, req.params.submissionId);
    if (!submission) return res.status(404).json({ error: 'Submission not found' });
    if (!(await canPerform(db, req.user, ACTIONS.GRADE_SUBMISSION, submission))) return res.status(403).json({ error: 'Unauthorized' });

    const studentResponse = submission.content || (submission.file_path ? `[File uploaded: ${submission.file_path}]` : '[No content]');

    const result = await gradeSubmission(studentResponse, {
      title: submission.assignment_title,
      description: submission.assignment_desc,
      instructions: submission.instructions,
      rubric: submission.rubric,
      maxScore: submission.max_score,
    });

    const existingGrade = await db.prepare('SELECT id FROM grades WHERE submission_id = ?').get(submission.id);
    if (existingGrade) {
      await db.prepare(`
        UPDATE grades SET score=?, feedback=?, strengths=?, weaknesses=?, suggestions=?,
        ai_score=?, ai_feedback=?, ai_assessed_at=CURRENT_TIMESTAMP, graded_by='ai', graded_at=CURRENT_TIMESTAMP
        WHERE submission_id=?
      `).run(result.score, result.feedback, result.strengths, result.weaknesses, result.suggestions, result.score, result.feedback, submission.id);
    } else {
      await db.prepare(`
        INSERT INTO grades (id, submission_id, student_id, assignment_id, score, max_score,
        feedback, strengths, weaknesses, suggestions, ai_score, ai_feedback, ai_assessed_at, graded_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 'ai')
      `).run(uuidv4(), submission.id, submission.student_id, submission.assignment_id,
        result.score, submission.max_score, result.feedback, result.strengths,
        result.weaknesses, result.suggestions, result.score, result.feedback);
    }

    await db.prepare('UPDATE submissions SET status = ? WHERE id = ?').run('graded', submission.id);

    const student = await db.prepare('SELECT id FROM users WHERE id = ?').get(submission.student_id);
    if (student) {
      const assign = await db.prepare('SELECT title FROM assignments WHERE id = ?').get(submission.assignment_id);
      await db.prepare('INSERT INTO notifications (id, user_id, title, message, type, related_id) VALUES (?, ?, ?, ?, ?, ?)').run(
        uuidv4(), student.id, 'Assignment Graded',
        `Your assignment "${assign ? assign.title : ''}" has been graded with AI. Score: ${result.score}`,
        'grade', submission.id
      );
      await db.saveDb();
      try {
        const { getIO } = require('../services/socket');
        const io = getIO();
        if (io) io.to(`user:${student.id}`).emit('notifications:new', { title: 'Assignment Graded', message: `Your assignment "${assign ? assign.title : ''}" graded: ${result.score}`, type: 'grade', related_id: submission.id });
      } catch {}
    }

    await audit(req.user, 'grade.ai', 'submission', submission.id, `AI graded submission for ${submission.assignment_title}`);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.put('/manual/:submissionId', authenticate, authorize('instructor', 'admin'), async (req, res, next) => {
  try {
    const submission = await getSubmission(db, req.params.submissionId);
    if (!submission) return res.status(404).json({ error: 'Submission not found' });
    if (!(await canPerform(db, req.user, ACTIONS.GRADE_SUBMISSION, submission))) return res.status(403).json({ error: 'Unauthorized' });
    const score = boundedNumber(req.body.score, 0, submission.max_score || 100, 0);
    const feedback = trimString(req.body.feedback, 5000);
    const strengths = trimString(req.body.strengths, 2000);
    const weaknesses = trimString(req.body.weaknesses, 2000);
    const suggestions = trimString(req.body.suggestions, 2000);

    const existingGrade = await db.prepare('SELECT id FROM grades WHERE submission_id = ?').get(submission.id);
    if (existingGrade) {
      await db.prepare(`
        UPDATE grades SET score=?, feedback=?, strengths=?, weaknesses=?, suggestions=?,
        manually_overridden=1, graded_by='instructor', graded_at=CURRENT_TIMESTAMP
        WHERE submission_id=?
      `).run(score, feedback, strengths, weaknesses, suggestions, submission.id);
    } else {
      await db.prepare(`
        INSERT INTO grades (id, submission_id, student_id, assignment_id, score, max_score,
        feedback, strengths, weaknesses, suggestions, manually_overridden, graded_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'instructor')
      `).run(uuidv4(), submission.id, submission.student_id, submission.assignment_id,
        score, submission.max_score || 100, feedback, strengths, weaknesses, suggestions);
    }

    await db.prepare("UPDATE submissions SET status = 'graded' WHERE id = ?").run(submission.id);
    await db.saveDb();
    try {
      const assign = await db.prepare('SELECT title FROM assignments WHERE id = ?').get(submission.assignment_id);
      await db.prepare('INSERT INTO notifications (id, user_id, title, message, type, related_id) VALUES (?, ?, ?, ?, ?, ?)').run(uuidv4(), submission.student_id, 'Assignment Graded', `Your assignment "${assign ? assign.title : ''}" has been graded. Score: ${score}`, 'grade', submission.id);
      await db.saveDb();
      const { getIO } = require('../services/socket');
      const io = getIO();
      if (io) io.to(`user:${submission.student_id}`).emit('notifications:new', { title: 'Assignment Graded', message: `Your assignment "${assign ? assign.title : ''}" graded`, type: 'grade', related_id: submission.id });
    } catch {}
    const grade = await db.prepare('SELECT * FROM grades WHERE submission_id = ?').get(submission.id);
    await audit(req.user, 'grade.manual', 'submission', submission.id, `Manual score ${score}/${submission.max_score || 100} for ${submission.assignment_title}`);
    res.json(grade);
  } catch (err) { next(err); }
});

module.exports = router;
