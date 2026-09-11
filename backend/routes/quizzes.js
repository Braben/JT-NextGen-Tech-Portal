/**
 * Quizzes - Quiz creation, taking, submission, auto-grading
 */


const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { authenticate } = require('../middleware/auth');
const db = require('../config/db');
const { ensureActiveEnrollment, isAdmin, isInstructor, isStudent } = require('../lib/accessControl');

router.get('/', authenticate, async (req, res, next) => {
  try {
    const { program_id } = req.query;
    let listRows;
    if (isInstructor(req.user)) {
      listRows = program_id
        ? await db.prepare('SELECT q.*, u.name AS instructor_name FROM quizzes q LEFT JOIN users u ON q.instructor_id = u.id WHERE q.program_id = ? AND q.instructor_id = ? ORDER BY q.created_at DESC').all(program_id, req.user.id)
        : await db.prepare('SELECT q.*, u.name AS instructor_name FROM quizzes q LEFT JOIN users u ON q.instructor_id = u.id WHERE q.instructor_id = ? ORDER BY q.created_at DESC').all(req.user.id);
    } else if (isStudent(req.user)) {
      const enrolled = (await db.prepare("SELECT program_id FROM enrollments WHERE student_id = ? AND status = 'active'").all(req.user.id)).map(r => r.program_id);
      if (!enrolled.length) return res.json([]);
      const placeholders = enrolled.map(() => '?').join(',');
      listRows = await db.prepare(`SELECT q.*, u.name AS instructor_name FROM quizzes q LEFT JOIN users u ON q.instructor_id = u.id WHERE q.program_id IN (${placeholders}) ORDER BY q.created_at DESC`).all(...enrolled);
    } else if (isAdmin(req.user)) {
      listRows = await db.prepare('SELECT q.*, u.name AS instructor_name FROM quizzes q LEFT JOIN users u ON q.instructor_id = u.id ORDER BY q.created_at DESC').all();
    } else {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    const rows = [];
    for (const r of listRows) {
      const submission = req.user.role === 'student' ? await db.prepare('SELECT id, score, total_points, submitted_at FROM quiz_submissions WHERE quiz_id = ? AND student_id = ?').get(r.id, req.user.id) : null;
      const qc = await db.prepare('SELECT COUNT(*) AS count FROM quiz_questions WHERE quiz_id = ?').get(r.id);
      rows.push({ ...r, submission, questionCount: qc ? Number(qc.count) : 0 });
    }
    res.json(rows);
  } catch (e) { next(e); }
});

router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const quiz = await db.prepare('SELECT q.*, u.name AS instructor_name FROM quizzes q LEFT JOIN users u ON q.instructor_id = u.id WHERE q.id = ?').get(req.params.id);
    if (!quiz) return res.status(404).json({ error: 'Quiz not found' });
    if (isStudent(req.user) && !(await ensureActiveEnrollment(db, req.user.id, quiz.program_id))) return res.status(403).json({ error: 'Unauthorized' });
    if (isInstructor(req.user) && quiz.instructor_id !== req.user.id) return res.status(403).json({ error: 'Unauthorized' });
    const questions = await db.prepare('SELECT * FROM quiz_questions WHERE quiz_id = ? ORDER BY sort_order ASC').all(req.params.id);
    const questionsWithOptions = [];
    for (const q of questions) {
      const options = await db.prepare('SELECT * FROM quiz_options WHERE question_id = ? ORDER BY sort_order ASC').all(q.id);
      if (q.type === 'multiple_choice' && req.user.role !== 'instructor' && req.user.role !== 'admin') {
        questionsWithOptions.push({ ...q, options: options.map(o => ({ id: o.id, option_text: o.option_text, sort_order: o.sort_order })) });
      } else {
        questionsWithOptions.push({ ...q, options });
      }
    }
    res.json({ ...quiz, questions: questionsWithOptions });
  } catch (e) { next(e); }
});

router.post('/', authenticate, async (req, res, next) => {
  try {
    if (!isInstructor(req.user) && !isAdmin(req.user)) return res.status(403).json({ error: 'Only instructors can create quizzes' });
    const { program_id, title, description, due_date, time_limit, questions } = req.body;
    if (!program_id || !title) return res.status(400).json({ error: 'Program and title required' });
    const quizId = uuidv4();
    await db.prepare('INSERT INTO quizzes (id, instructor_id, program_id, title, description, due_date, time_limit) VALUES (?,?,?,?,?,?,?)').run(quizId, req.user.id, program_id, title, description || '', due_date || null, time_limit || 0);
    if (questions && Array.isArray(questions)) {
      for (const [qi, q] of questions.entries()) {
        const qId = uuidv4();
        await db.prepare('INSERT INTO quiz_questions (id, quiz_id, question, type, points, sort_order) VALUES (?,?,?,?,?,?)').run(qId, quizId, q.question_text || q.question || '', q.type || 'multiple_choice', parseInt(q.points) || 1, qi);
        if (q.options && Array.isArray(q.options)) {
          for (const [oi, o] of q.options.entries()) {
            await db.prepare('INSERT INTO quiz_options (id, question_id, option_text, is_correct, sort_order) VALUES (?,?,?,?,?)').run(uuidv4(), qId, o.option_text, o.is_correct ? 1 : 0, oi);
          }
        }
      }
    }
    await db.saveDb();
    const row = await db.prepare('SELECT q.*, u.name AS instructor_name FROM quizzes q LEFT JOIN users u ON q.instructor_id = u.id WHERE q.id = ?').get(quizId);
    res.status(201).json(row);
  } catch (e) { next(e); }
});

router.post('/:id/submit', authenticate, async (req, res, next) => {
  try {
    if (!isStudent(req.user)) return res.status(403).json({ error: 'Only students can submit quizzes' });
    const quiz = await db.prepare('SELECT * FROM quizzes WHERE id = ?').get(req.params.id);
    if (!quiz) return res.status(404).json({ error: 'Quiz not found' });
    if (!(await ensureActiveEnrollment(db, req.user.id, quiz.program_id))) return res.status(403).json({ error: 'You are not enrolled in this quiz program' });
    const existing = await db.prepare('SELECT id FROM quiz_submissions WHERE quiz_id = ? AND student_id = ?').get(req.params.id, req.user.id);
    if (existing) return res.status(400).json({ error: 'You have already submitted this quiz' });
    const { answers } = req.body;
    if (!answers || !Array.isArray(answers)) return res.status(400).json({ error: 'Answers array required' });
    const questions = await db.prepare('SELECT * FROM quiz_questions WHERE quiz_id = ?').all(req.params.id);
    const subId = uuidv4();
    let totalScore = 0;
    let totalPoints = 0;
    const answerRows = [];
    for (const q of questions) {
      totalPoints += q.points;
      const userAns = answers.find(a => a.question_id === q.id);
      const answerText = userAns ? userAns.answer : '';
      let isCorrect = 0;
      let pointsEarned = 0;
      if (q.type === 'multiple_choice') {
        const correctOpt = await db.prepare('SELECT id, option_text FROM quiz_options WHERE question_id = ? AND is_correct = 1').get(q.id);
        if (correctOpt && String(answerText).trim() === String(correctOpt.option_text).trim()) {
          isCorrect = 1;
          pointsEarned = q.points;
          totalScore += q.points;
        }
      }
      answerRows.push({ question_id: q.id, answer: answerText, is_correct: isCorrect, points_earned: pointsEarned });
    }
    // Insert the submission FIRST (quiz_answers has an FK to quiz_submissions),
    // then the answers. In SQLite order didn't matter; Postgres enforces it.
    await db.prepare('INSERT INTO quiz_submissions (id, quiz_id, student_id, score, total_points) VALUES (?,?,?,?,?)').run(subId, req.params.id, req.user.id, totalScore, totalPoints);
    for (const ar of answerRows) {
      const aId = uuidv4();
      await db.prepare('INSERT INTO quiz_answers (id, submission_id, question_id, answer, is_correct, points_earned) VALUES (?,?,?,?,?,?)').run(aId, subId, ar.question_id, ar.answer, ar.is_correct, ar.points_earned);
    }
    await db.saveDb();
    res.json({ submission_id: subId, score: totalScore, total_points: totalPoints, answers: answerRows });
  } catch (e) { next(e); }
});

router.get('/:id/submissions', authenticate, async (req, res, next) => {
  try {
    const quiz = await db.prepare('SELECT * FROM quizzes WHERE id = ?').get(req.params.id);
    if (!quiz) return res.status(404).json({ error: 'Quiz not found' });
    if (!isAdmin(req.user) && (!isInstructor(req.user) || quiz.instructor_id !== req.user.id)) return res.status(403).json({ error: 'Unauthorized' });
    const submissions = await db.prepare('SELECT s.*, u.name AS student_name FROM quiz_submissions s LEFT JOIN users u ON s.student_id = u.id WHERE s.quiz_id = ? ORDER BY s.submitted_at DESC').all(req.params.id);
    res.json(submissions);
  } catch (e) { next(e); }
});

router.get('/submissions/:submissionId', authenticate, async (req, res, next) => {
  try {
    const sub = await db.prepare('SELECT s.*, u.name AS student_name FROM quiz_submissions s LEFT JOIN users u ON s.student_id = u.id WHERE s.id = ?').get(req.params.submissionId);
    if (!sub) return res.status(404).json({ error: 'Submission not found' });
    if (!isAdmin(req.user) && sub.student_id !== req.user.id) {
      const quiz = await db.prepare('SELECT instructor_id FROM quizzes WHERE id = ?').get(sub.quiz_id);
      if (!quiz || quiz.instructor_id !== req.user.id) return res.status(403).json({ error: 'Unauthorized' });
    }
    const answers = await db.prepare('SELECT a.*, q.question, q.type, q.points FROM quiz_answers a LEFT JOIN quiz_questions q ON a.question_id = q.id WHERE a.submission_id = ?').all(req.params.submissionId);
    res.json({ ...sub, answers });
  } catch (e) { next(e); }
});

router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const quiz = await db.prepare('SELECT * FROM quizzes WHERE id = ?').get(req.params.id);
    if (!quiz) return res.status(404).json({ error: 'Quiz not found' });
    if (!isAdmin(req.user) && (!isInstructor(req.user) || quiz.instructor_id !== req.user.id)) return res.status(403).json({ error: 'Unauthorized' });
    const questions = await db.prepare('SELECT id FROM quiz_questions WHERE quiz_id = ?').all(req.params.id);
    for (const q of questions) {
      await db.prepare('DELETE FROM quiz_options WHERE question_id = ?').run(q.id);
    }
    await db.prepare('DELETE FROM quiz_answers WHERE question_id IN (SELECT id FROM quiz_questions WHERE quiz_id = ?)').run(req.params.id);
    await db.prepare('DELETE FROM quiz_questions WHERE quiz_id = ?').run(req.params.id);
    await db.prepare('DELETE FROM quiz_submissions WHERE quiz_id = ?').run(req.params.id);
    await db.prepare('DELETE FROM quizzes WHERE id = ?').run(req.params.id);
    await db.saveDb();
    res.json({ message: 'Quiz deleted' });
  } catch (e) { next(e); }
});

module.exports = router;

