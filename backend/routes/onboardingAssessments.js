/**
 * Student onboarding assessments
 *
 * Admins decide when an applicant should take the aptitude test. Students use
 * these endpoints only after an assessment request has been recommended.
 */

const express = require('express');
const db = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const { trimString } = require('../lib/validators');
const { invalidate } = require('../middleware/cache');

const router = express.Router();

function normalizeAssessment(raw = {}) {
  return {
    strengths: trimString(raw.strengths, 1000),
    greatest_strength: trimString(raw.greatest_strength, 1000),
    weaknesses: trimString(raw.weaknesses, 1000),
    weakness_response: trimString(raw.weakness_response, 1200),
    improvement_plan: trimString(raw.improvement_plan, 1200),
  };
}

function validateAssessment(assessment, consent) {
  // Field keys match the React form state so the client can render precise
  // inline errors instead of flattening everything into a banner.
  if (assessment.strengths.length < 20) return ['strengths', 'Please state at least three strengths'];
  if (assessment.greatest_strength.length < 20) return ['greatest_strength', 'Please describe your greatest strength'];
  if (assessment.weaknesses.length < 20) return ['weaknesses', 'Please state at least three weaknesses'];
  if (assessment.weakness_response.length < 20) return ['weakness_response', 'Please describe how you addressed a weakness'];
  if (assessment.improvement_plan.length < 20) return ['improvement_plan', 'Please describe how you work on improving yourself'];
  if (!consent) return ['consent', 'Consent is required to submit your aptitude assessment'];
  return null;
}

router.get('/my', authenticate, authorize('student'), async (req, res, next) => {
  try {
    const rows = await db.prepare(`
      SELECT oa.*, e.session, e.status as enrollment_status, p.title as program_title
      FROM onboarding_assessments oa
      LEFT JOIN enrollments e ON e.id = oa.enrollment_id
      LEFT JOIN programs p ON p.id = e.program_id
      WHERE oa.student_id = ?
      ORDER BY
        CASE oa.status WHEN 'recommended' THEN 0 WHEN 'needs_followup' THEN 1 WHEN 'submitted' THEN 2 ELSE 3 END,
        oa.created_at DESC
    `).all(req.user.id);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.put('/:id/submit', authenticate, authorize('student'), async (req, res, next) => {
  try {
    const assessment = await db.prepare('SELECT * FROM onboarding_assessments WHERE id = ? AND student_id = ?').get(req.params.id, req.user.id);
    if (!assessment) return res.status(404).json({ error: 'Assessment not found' });
    if (!['recommended', 'needs_followup'].includes(assessment.status)) {
      return res.status(400).json({ error: 'This assessment is not open for submission' });
    }

    const answers = normalizeAssessment(req.body);
    const validation = validateAssessment(answers, req.body.consent);
    if (validation) {
      const [field, message] = validation;
      return res.status(400).json({ error: message, fieldErrors: { [field]: message } });
    }

    await db.prepare(`
      UPDATE onboarding_assessments
      SET strengths = ?, greatest_strength = ?, weaknesses = ?,
          weakness_response = ?, improvement_plan = ?, status = 'submitted',
          score = NULL, feedback = '', reviewed_by = NULL, reviewed_at = NULL,
          updated_at = ?
      WHERE id = ? AND student_id = ?
    `).run(
      answers.strengths,
      answers.greatest_strength,
      answers.weaknesses,
      answers.weakness_response,
      answers.improvement_plan,
      new Date().toISOString(),
      req.params.id,
      req.user.id,
    );
    await db.saveDb?.();
    invalidate('/api/admin/stats');

    const updated = await db.prepare('SELECT * FROM onboarding_assessments WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
