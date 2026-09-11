/**
 * Request Logging Middleware
 *
 * Assigns a unique request ID to every incoming request and logs:
 *   - method, path, status code, duration, and client IP
 *
 * The request ID is attached to res.locals so that downstream error
 * logs can include it, letting you correlate all log lines belonging
 * to a single request.
 *
 * Usage: app.use(requestLogger);  (must be registered before routes)
 */

const logger = require('../lib/logger');

module.exports = function requestLogger(req, res, next) {
  const start = process.hrtime.bigint();
  const requestId = logger.genRequestId();
  req.requestId = requestId;
  res.locals.requestId = requestId;

  // Log when the response finishes
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    const meta = {
      requestId,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Math.round(durationMs * 100) / 100,
      ip: req.ip,
      userAgent: req.headers['user-agent'] || '',
    };
    // 4xx/5xx get louder levels for visibility
    if (res.statusCode >= 500) logger.error('Request failed', meta);
    else if (res.statusCode >= 400) logger.warn('Request warn', meta);
    else logger.info('Request ok', meta);
  });

  next();
};
