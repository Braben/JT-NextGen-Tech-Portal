const path = require('path');

const ACTIONS = Object.freeze({
  VIEW_SUBMISSION: 'submission:view',
  GRADE_SUBMISSION: 'submission:grade',
  MANAGE_ENROLLMENT: 'enrollment:manage',
  VIEW_MATERIAL: 'material:view',
});

function isAdmin(user) {
  return user?.role === 'admin';
}

function isInstructor(user) {
  return user?.role === 'instructor';
}

function isStudent(user) {
  return user?.role === 'student';
}

function requireRole(res, user, roles) {
  if (!roles.includes(user?.role)) {
    res.status(403).json({ error: 'Insufficient permissions' });
    return false;
  }
  return true;
}

async function getSubmission(db, submissionId) {
  return db.prepare(`
    SELECT s.*, a.instructor_id, a.title AS assignment_title, a.description AS assignment_desc,
           a.instructions, a.rubric, a.max_score, u.name AS student_name, u.email AS student_email
    FROM submissions s
    JOIN assignments a ON s.assignment_id = a.id
    JOIN users u ON s.student_id = u.id
    WHERE s.id = ?
  `).get(submissionId);
}

function canViewSubmission(user, submission) {
  if (!user || !submission) return false;
  return isAdmin(user) || submission.student_id === user.id || submission.instructor_id === user.id;
}

function canGradeSubmission(user, submission) {
  if (!user || !submission) return false;
  return isAdmin(user) || (isInstructor(user) && submission.instructor_id === user.id);
}

/**
 * Explicit policy matrix for resource actions that need more than role
 * checks. Routes can still call the small helpers directly, but new
 * sensitive flows should prefer this function so permissions stay visible.
 */
async function canPerform(db, user, action, resource) {
  switch (action) {
    case ACTIONS.VIEW_SUBMISSION:
      return canViewSubmission(user, resource);
    case ACTIONS.GRADE_SUBMISSION:
      return canGradeSubmission(user, resource);
    case ACTIONS.MANAGE_ENROLLMENT:
      return canManageEnrollment(db, user, resource);
    case ACTIONS.VIEW_MATERIAL:
      return canViewMaterial(db, user, resource);
    default:
      return false;
  }
}

async function assertCan(db, user, action, resource) {
  if (await canPerform(db, user, action, resource)) return true;
  const err = new Error('Forbidden');
  err.name = 'ForbiddenError';
  throw err;
}

async function canManageEnrollment(db, user, enrollment) {
  if (!user || !enrollment) return false;
  if (isAdmin(user)) return true;
  if (!isInstructor(user)) return false;

  const row = await db.prepare(`
    SELECT 1 AS ok
    WHERE EXISTS (SELECT 1 FROM quizzes WHERE instructor_id = ? AND program_id = ?)
       OR EXISTS (SELECT 1 FROM materials WHERE instructor_id = ? AND program_id = ?)
       OR EXISTS (SELECT 1 FROM attendance_sessions WHERE instructor_id = ? AND program_id = ?)
       OR EXISTS (SELECT 1 FROM program_classes WHERE instructor_id = ? AND program_id = ?)
    LIMIT 1
  `).get(user.id, enrollment.program_id, user.id, enrollment.program_id, user.id, enrollment.program_id, user.id, enrollment.program_id);
  return Boolean(row?.ok);
}

async function instructorProgramIds(db, user) {
  if (isAdmin(user)) return null;
  if (!isInstructor(user)) return [];
  const rows = await db.prepare(`
    SELECT DISTINCT program_id FROM quizzes WHERE instructor_id = ?
    UNION
    SELECT DISTINCT program_id FROM materials WHERE instructor_id = ?
    UNION
    SELECT DISTINCT program_id FROM attendance_sessions WHERE instructor_id = ?
    UNION
    SELECT DISTINCT program_id FROM program_classes WHERE instructor_id = ?
  `).all(user.id, user.id, user.id, user.id);
  return rows.map((r) => r.program_id).filter(Boolean);
}

async function ensureActiveEnrollment(db, studentId, programId) {
  const row = await db.prepare(
    "SELECT id FROM enrollments WHERE student_id = ? AND program_id = ? AND status = 'active'"
  ).get(studentId, programId);
  return Boolean(row);
}

function parseAudienceGroups(value) {
  try {
    const groups = Array.isArray(value) ? value : JSON.parse(value || '["active"]');
    return groups.filter((g) => g === 'active' || g === 'alumni');
  } catch {
    return ['active'];
  }
}

async function canViewMaterial(db, user, material) {
  if (!user || !material) return false;
  if (isAdmin(user) || material.instructor_id === user.id) return true;
  if (!isStudent(user)) return false;

  const groups = parseAudienceGroups(material.audience_groups);
  const enrollments = await db.prepare(
    'SELECT status, completed_at FROM enrollments WHERE student_id = ? AND program_id = ?'
  ).all(user.id, material.program_id);

  if (groups.includes('active') && enrollments.some((e) => e.status === 'active')) return true;
  if (!groups.includes('alumni')) return false;

  return enrollments.some((e) => {
    if (e.status !== 'completed') return false;
    if (!material.audience_year && !material.audience_month) return true;
    const completed = new Date(e.completed_at);
    if (Number.isNaN(completed.getTime())) return false;
    const year = String(completed.getFullYear());
    const month = String(completed.getMonth() + 1).padStart(2, '0');
    return (!material.audience_year || year === String(material.audience_year)) &&
      (!material.audience_month || month === String(material.audience_month).padStart(2, '0'));
  });
}

function uploadFilenameFromPath(filePath) {
  if (!filePath || typeof filePath !== 'string') return null;
  const normalized = filePath.replace(/\\/g, '/');
  const filename = path.basename(normalized);
  if (!/^[a-f0-9-]{36}\.[a-z0-9]+$/i.test(filename)) return null;
  return filename;
}

module.exports = {
  ACTIONS,
  assertCan,
  canGradeSubmission,
  canManageEnrollment,
  canPerform,
  canViewMaterial,
  canViewSubmission,
  ensureActiveEnrollment,
  getSubmission,
  instructorProgramIds,
  isAdmin,
  isInstructor,
  isStudent,
  parseAudienceGroups,
  requireRole,
  uploadFilenameFromPath,
};
