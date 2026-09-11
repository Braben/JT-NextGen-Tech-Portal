/**
 * Test Helpers
 *
 * Sets the database URL to an isolated temporary SQLite file so tests
 * never touch the real portal.db, then exposes the Express app for
 * supertest. Because config/db.js reads DATABASE_URL at module-load
 * time, this module MUST be required by every test BEFORE requiring
 * anything else.
 *
 * Usage:
 *   const { app, waitForDb, cleanupTestDb } = require('./helpers');
 *   const request = require('supertest');
 */

const fs = require('fs');
const path = require('path');

// Isolated on-disk SQLite file (tests persist but never touch prod data).
// Unique per process (pid) so parallel test files don't collide.
const TEST_DB = path.join(__dirname, `.test-portal-${process.pid}.db`);
process.env.DATABASE_URL = `sqlite://${TEST_DB.replace(/\\/g, '/')}`;

// Now it is safe to load the app (it will connect to the test DB).
const app = require('../app');
const db = require('../config/db');

/** Resolves once the database schema + migrations are ready. */
const waitForDb = () => db.ready;

/** Stop the periodic save timer so the test process can exit. */
function stopDb() {
  if (typeof db.closeDb === 'function') db.closeDb();
}

/** Delete the temporary test database file. */
function cleanupTestDb() {
  stopDb();
  try { fs.unlinkSync(TEST_DB); } catch (e) { /* already gone */ }
}

module.exports = { app, db, waitForDb, stopDb, cleanupTestDb, TEST_DB };