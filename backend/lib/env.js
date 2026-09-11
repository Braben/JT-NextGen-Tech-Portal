/**
 * Runtime Environment Guard
 *
 * Centralizes startup checks for configuration that should never be
 * guessed in production. Development can keep friendly defaults, while
 * production fails fast before it accepts traffic in an unsafe state.
 */

function requireSecret(name, minLength) {
  const value = process.env[name]?.trim();
  if (!value || value.length < minLength) {
    throw new Error(`${name} missing or too short; expected at least ${minLength} characters`);
  }
}

function validateRuntimeEnv() {
  requireSecret('JWT_SECRET', 32);

  if (process.env.NODE_ENV !== 'production') return;

  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required in production');
  }
  if (!/^postgres(?:ql)?:\/\//i.test(databaseUrl)) {
    throw new Error('DATABASE_URL must point to PostgreSQL in production; SQLite is for local development only');
  }

  const origins = (process.env.CORS_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!origins.length || origins.includes('*')) {
    throw new Error('CORS_ORIGIN must list explicit origins in production');
  }

  for (const origin of origins) {
    try {
      const parsed = new URL(origin);
      if (!['http:', 'https:'].includes(parsed.protocol) || parsed.pathname !== '/' || parsed.search || parsed.hash) {
        throw new Error('invalid origin format');
      }
    } catch {
      throw new Error(`CORS_ORIGIN contains an invalid origin: ${origin}`);
    }
  }
}

module.exports = { validateRuntimeEnv };
