/**
 * Gradebook - Aggregated student grade view
 */


const express = require('express');
const db = require('../config/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

function visibleToStudentClause(alias = 'a') {
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

function eligibleStudentClause(alias = 'a') {
  return `
    (${alias}.program_id IS NULL OR EXISTS (
      SELECT 1 FROM enrollments e
      WHERE e.student_id = u.id AND e.status = 'active'
        AND (
          (${alias}.class_id IS NOT NULL AND e.class_id = ${alias}.class_id)
          OR (${alias}.class_id IS NULL AND e.program_id = ${alias}.program_id)
        )
    ))
  `;
}

router.get('/', authenticate, async (req, res, next) => {
  try {
    const user = req.user;
    let rows;
    if (user.role === 'student') {
      rows = await db.prepare(`
        SELECT a.id as assignment_id, a.title as assignment_title, a.due_date, a.max_score,
               s.id as submission_id, s.submitted_at, s.status as submission_status,
               g.score, g.feedback, g.strengths, g.weaknesses, g.suggestions,
               g.manually_overridden, g.graded_by, g.graded_at
        FROM assignments a
        LEFT JOIN submissions s ON s.assignment_id = a.id AND s.student_id = ?
        LEFT JOIN grades g ON g.submission_id = s.id
        WHERE ${visibleToStudentClause('a')}
        ORDER BY a.created_at DESC
      `).all(user.id, user.id);
    } else if (user.role === 'instructor') {
      rows = await db.prepare(`
        SELECT a.id as assignment_id, a.title as assignment_title,
               u.id as student_id, u.name as student_name, u.email as student_email,
               s.id as submission_id, s.submitted_at, s.status as submission_status,
               g.score, g.feedback, g.strengths, g.weaknesses, g.suggestions,
               g.manually_overridden, g.graded_by, g.graded_at
        FROM assignments a
        CROSS JOIN users u
        LEFT JOIN submissions s ON s.assignment_id = a.id AND s.student_id = u.id
        LEFT JOIN grades g ON g.submission_id = s.id
        WHERE u.role = 'student' AND a.instructor_id = ? AND ${eligibleStudentClause('a')}
        ORDER BY a.created_at DESC, u.name ASC
      `).all(user.id);
    } else {
      rows = await db.prepare(`
        SELECT a.id as assignment_id, a.title as assignment_title,
               u.id as student_id, u.name as student_name, u.email as student_email,
               s.id as submission_id, s.submitted_at, s.status as submission_status,
               g.score, g.feedback, g.strengths, g.weaknesses, g.suggestions,
               g.manually_overridden, g.graded_by, g.graded_at
        FROM assignments a
        CROSS JOIN users u
        LEFT JOIN submissions s ON s.assignment_id = a.id AND s.student_id = u.id
        LEFT JOIN grades g ON g.submission_id = s.id
        WHERE u.role = 'student' AND ${eligibleStudentClause('a')}
        ORDER BY a.created_at DESC, u.name ASC
      `).all();
    }
    res.json(rows);
  } catch (err) { next(err); }
});

router.get('/summary', authenticate, async (req, res, next) => {
  try {
    const user = req.user;
    if (user.role === 'student') {
      const graded = await db.prepare(`
        SELECT COUNT(*) as count, AVG(g.score) as avg_score, SUM(g.score) as total
        FROM grades g
        JOIN submissions s ON g.submission_id = s.id
        WHERE s.student_id = ?
      `).get(user.id);
      const total = await db.prepare(`
        SELECT COUNT(*) as count
        FROM assignments a
        WHERE ${visibleToStudentClause('a')}
      `).get(user.id);
      const submitted = await db.prepare('SELECT COUNT(*) as count FROM submissions WHERE student_id = ?').get(user.id);
      res.json({
        gradedCount: graded.count || 0,
        avgScore: Math.round(graded.avg_score || 0),
        totalScore: graded.total || 0,
        totalAssignments: total.count || 0,
        submittedCount: submitted.count || 0,
      });
    } else if (user.role === 'instructor') {
      const stats = await db.prepare(`
        SELECT COUNT(DISTINCT s.id) as total_submissions,
               COUNT(DISTINCT CASE WHEN g.id IS NOT NULL THEN s.id END) as graded_submissions,
               AVG(g.score) as avg_score
        FROM assignments a
        LEFT JOIN submissions s ON s.assignment_id = a.id
        LEFT JOIN grades g ON g.submission_id = s.id
        WHERE a.instructor_id = ?
      `).get(user.id);
      const totalAssignmentsRow = await db.prepare('SELECT COUNT(*) as c FROM assignments WHERE instructor_id = ?').get(user.id);
      const pending = (stats.total_submissions || 0) - (stats.graded_submissions || 0);
      res.json({
        totalSubmissions: stats.total_submissions || 0,
        gradedSubmissions: stats.graded_submissions || 0,
        pendingSubmissions: pending,
        totalAssignments: totalAssignmentsRow?.c || 0,
        avgScore: Math.round(stats.avg_score || 0),
      });
    } else {
      // Admin summaries intentionally span every assignment, not a single
      // instructor's ownership scope, so admin dashboards match /gradebook.
      const stats = await db.prepare(`
        SELECT COUNT(DISTINCT s.id) as total_submissions,
               COUNT(DISTINCT CASE WHEN g.id IS NOT NULL THEN s.id END) as graded_submissions,
               AVG(g.score) as avg_score
        FROM assignments a
        LEFT JOIN submissions s ON s.assignment_id = a.id
        LEFT JOIN grades g ON g.submission_id = s.id
      `).get();
      const totalAssignmentsRow = await db.prepare('SELECT COUNT(*) as c FROM assignments').get();
      const pending = (stats.total_submissions || 0) - (stats.graded_submissions || 0);
      res.json({
        totalSubmissions: stats.total_submissions || 0,
        gradedSubmissions: stats.graded_submissions || 0,
        pendingSubmissions: pending,
        totalAssignments: totalAssignmentsRow?.c || 0,
        avgScore: Math.round(stats.avg_score || 0),
      });
    }
  } catch (err) { next(err); }
});

module.exports = router;
