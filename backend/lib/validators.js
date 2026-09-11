const VALID_ROLES = new Set(['student', 'instructor', 'admin']);
const VALID_ENROLLMENT_STATUS = new Set(['pending', 'active', 'completed', 'dropped']);
const VALID_ATTENDANCE_STATUS = new Set(['present', 'absent', 'late', 'excused']);

function trimString(value, max = 500) {
  if (value === undefined || value === null) return '';
  return String(value).trim().slice(0, max);
}

function normalizeEmail(value) {
  return trimString(value, 255).toLowerCase();
}

function isValidRole(role) {
  return VALID_ROLES.has(role);
}

function isValidEnrollmentStatus(status) {
  return VALID_ENROLLMENT_STATUS.has(status);
}

function isValidAttendanceStatus(status) {
  return VALID_ATTENDANCE_STATUS.has(status);
}

function positiveMoney(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.round(amount * 100) / 100;
}

function boundedNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

module.exports = {
  boundedNumber,
  isValidAttendanceStatus,
  isValidEnrollmentStatus,
  isValidRole,
  normalizeEmail,
  positiveMoney,
  trimString,
};
