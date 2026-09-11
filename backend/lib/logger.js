/**
 * Structured Logger
 *
 * A minimal JSON-line logger. Each log entry is a single JSON object
 * on one line, making it easy to parse with tools like jq, or forward
 * to log aggregators (ELK, Datadog, etc.).
 *
 * Usage:
 *   const logger = require('../lib/logger');
 *   logger.info('User logged in', { userId });
 *   logger.error('DB failed', new Error('...'));
 *
 * Log levels: debug < info < warn < error
 * Set LOG_LEVEL env var to filter (default: info).
 * Set NODE_ENV=development to get pretty-printed output.
 */

const crypto = require('crypto');

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const CONFIG = {
  level: LEVELS[process.env.LOG_LEVEL] || LEVELS.info,
  pretty: process.env.NODE_ENV === 'development',
};

/**
 * Generate a unique request ID (used to correlate all logs from one request).
 * @returns {string}
 */
function genRequestId() {
  return crypto.randomBytes(8).toString('hex');
}

/**
 * Core emit function.
 * @param {number} level — Numeric level (see LEVELS)
 * @param {string} levelName
 * @param {string} message
 * @param {Object} [meta] — Arbitrary structured context
 */
function emit(level, levelName, message, meta) {
  if (level < CONFIG.level) return;
  const entry = {
    time: new Date().toISOString(),
    level: levelName,
    msg: message,
    ...(meta || {}),
  };

  if (CONFIG.pretty) {
    const prefix = `[${entry.time}] ${levelName.toUpperCase().padEnd(5)}`;
    if (meta && meta.requestId) {
      const requestBits = [
        `req=${meta.requestId}`,
        meta.method,
        meta.path,
        meta.status ? `status=${meta.status}` : null,
        meta.durationMs !== undefined ? `duration=${meta.durationMs}ms` : null,
      ].filter(Boolean).join(' ');
      console.log(`${prefix} ${requestBits} ${message}`);
    } else {
      console.log(`${prefix} ${message}`);
    }
    if (meta && Object.keys(meta).length > 0 && !meta.requestId) {
      console.log(JSON.stringify(meta, null, 2));
    }
    if (entry.err && entry.err.stack) {
      console.log(entry.err.stack);
    }
    return;
  }

  // JSON-line format — parseable by jq:  jq -R 'fromjson' logfile
  if (entry.err && entry.err.stack) {
    entry.stack = entry.err.stack;
    delete entry.err;
  }
  console.log(JSON.stringify(entry));
}

/**
 * Error-to-meta helper: converts an Error into a structured object
 * (includes stack for debugging) without leaking to client responses.
 * @param {Error} err
 * @returns {{ err: { name: string, message: string, stack?: string } }}
 */
function errMeta(err) {
  return {
    err: {
      name: err.name || 'Error',
      message: err.message,
      ...(CONFIG.level <= LEVELS.debug ? { stack: err.stack } : {}),
    },
  };
}

const logger = {
  debug: (msg, meta) => emit(LEVELS.debug, 'debug', msg, meta),
  info:  (msg, meta) => emit(LEVELS.info, 'info', msg, meta),
  warn:  (msg, meta) => emit(LEVELS.warn, 'warn', msg, meta),
  error: (msg, meta) => emit(LEVELS.error, 'error', msg, meta),
  genRequestId,
  errMeta,
};

module.exports = logger;
