/**
 * Request Validation Middleware
 *
 * Provides a reusable validation layer for Express route handlers.
 * Define a schema object describing the required fields and their
 * validation rules, then pass it to validate() to create middleware.
 *
 * Schema format:
 *   { fieldName: ['required', 'email', 255, { min: 6 }] }
 *
 * Rules (applied in order, first failure stops):
 *   'required' — value must not be null, undefined, or empty string
 *   'email'    — must match a basic email pattern
 *   Number     — max length (string length check)
 *   { min: N } — min length (string length check)
 *
 * Usage:
 *   const { validate, schemas } = require('../middleware/validate');
 *   router.post('/register', validate(schemas.register), handler);
 */

/**
 * Creates Express middleware that validates req.body against a schema.
 * On failure, creates a ValidationError and passes it to next().
 * On success, calls next() with no error.
 *
 * @param {Object} schema — Field definitions (see above)
 * @returns {Function} Express middleware
 */
function validate(schema) {
  return (req, res, next) => {
    const errors = [];
    const fieldErrors = {};

    for (const [field, rules] of Object.entries(schema)) {
      const value = req.body[field];

      for (const rule of rules) {
        // Required field check
        if (rule === 'required' && (value === undefined || value === null || value === '')) {
          const message = `${field} is required`;
          errors.push(message);
          fieldErrors[field] = message;
          break;
        }
        // Basic email format check (not exhaustive — just catches typos)
        if (rule === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          const message = `${field} must be a valid email`;
          errors.push(message);
          fieldErrors[field] = message;
          break;
        }
        // Max length
        if (typeof rule === 'number' && value && value.length > rule) {
          const message = `${field} must be at most ${rule} characters`;
          errors.push(message);
          fieldErrors[field] = message;
          break;
        }
        // Min length
        if (typeof rule === 'object' && rule.min !== undefined &&
            value !== undefined && value !== null && value.length < rule.min) {
          const message = `${field} must be at least ${rule.min} characters`;
          errors.push(message);
          fieldErrors[field] = message;
          break;
        }
      }
    }

    if (errors.length > 0) {
      const err = new Error(errors.join('; '));
      err.name = 'ValidationError';
      err.fieldErrors = fieldErrors;
      return next(err);  // caught by errorHandler.js
    }

    next();
  };
}

/**
 * Pre-defined validation schemas for common endpoints.
 * Import these alongside the validate() function.
 */
const schemas = {
  register: {
    name:     ['required', 100],
    email:    ['required', 'email', 255],
    password: ['required', { min: 6 }],
    role:     [],
  },
  login: {
    email:    ['required', 'email'],
    password: ['required'],
  },
  assignment: {
    title:       ['required', 200],
    description: ['required'],
  },
};

module.exports = { validate, schemas };
