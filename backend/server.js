/**
 * Server Entry Point
 *
 * Loads the Express app (app.js), waits for the database to be ready,
 * and starts the HTTP server. Socket.IO is initialised here so it can
 * attach to the same HTTP server instance.
 */

require('dotenv').config();

const http = require('http');
const app = require('./app');
const db = require('./config/db');
const logger = require('./lib/logger');
const { initSocket } = require('./services/socket');

const server = http.createServer(app);
initSocket(server);

const PORT = process.env.PORT || 5000;

/** Graceful shutdown — close the HTTP server, persist the DB, exit. */
function shutdown(signal) {
  logger.info(`Received ${signal}, shutting down gracefully`);
  server.close(() => {
    db.saveDb();
    logger.info('Server closed');
    process.exit(0);
  });
  // Force-exit if connections don't drain within 10s
  setTimeout(() => process.exit(0), 10000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

db.ready.then(() => {
  server.listen(PORT, () => {
    logger.info(`JT NextGen Portal API running on port ${PORT}`, { dbType: db.type, env: process.env.NODE_ENV });
  });
}).catch((err) => {
  logger.error('Failed to initialize database', logger.errMeta(err));
  process.exit(1);
});
