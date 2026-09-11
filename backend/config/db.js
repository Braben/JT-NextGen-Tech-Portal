/**
 * Database Configuration & Schema Initialisation
 *
 * This module is the application's central database gateway.
 * It delegates to the Database abstraction in lib/database.js but
 * adds the following on top:
 *
 *   1. Schema initialisation — creates all 20+ tables on first run.
 *   2. Migration helpers — ALTER TABLE statements for gradual schema
 *      evolution without dropping existing data.
 *   3. Auto-persistence — periodic saveDb() every 5 seconds + on exit.
 *   4. Lazy proxy — routes can import this module synchronously even
 *      though the database connection is established asynchronously.
 *
 * Import pattern (all routes use this):
 *   const db = require('../config/db');
 *   db.ready.then(() => { ... });  // optional: wait for init
 *   db.prepare('SELECT ...').get(...);
 *   db.saveDb();                    // persist changes
 */

const path = require('path');
const fs = require('fs');
const database = require('../lib/database');
const migrations = require('../lib/migrations');
const logger = require('../lib/logger');

/** Path to the SQLite file used when DATABASE_URL is not set. */
const dbPath = path.join(__dirname, '..', 'portal.db');

let db = null;
let readyResolve = null;
let readyReject = null;

/**
 * Promise that resolves once the database is fully initialised
 * (connection open + schema created + migrations run).
 * @type {Promise<void>}
 */
const ready = new Promise((resolve, reject) => { readyResolve = resolve; readyReject = reject; });

/* ================================================================== */
/*  Initialisation                                                     */
/* ================================================================== */

async function initDb() {
  // Determine connection string: DATABASE_URL env var, or default to SQLite
  const url = process.env.DATABASE_URL || `sqlite://${dbPath.replace(/\\/g, '/')}`;
  await database.connect(url);
  db = database;

  // Schema creation and migrations are only needed for SQLite.
  // PostgreSQL would use a proper migration tool (e.g. node-pg-migrate).
  if (database.type === 'sqlite') {
    _createTables();
    await migrations.run(db); // versioned migrations, tracked in DB
  }

  readyResolve();
}

/* ================================================================== */
/*  Schema (CREATE TABLE IF NOT EXISTS)                                */
/* ================================================================== */

function _createTables() {
  // The full schema is run inside db.exec() which executes multiple
  // semicolon-separated statements atomically. Each table uses
  // IF NOT EXISTS so this is safe to run on every startup.
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL,
      role TEXT CHECK(role IN ('student','instructor','admin')) NOT NULL DEFAULT 'student',
      avatar TEXT DEFAULT NULL, phone TEXT DEFAULT '', bio TEXT DEFAULT '', avatar_color TEXT DEFAULT '#16a34a',
      avatar_url TEXT DEFAULT '', date_of_birth TEXT DEFAULT '', gender TEXT DEFAULT '',
      education_level TEXT DEFAULT '', computing_experience TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS assignments (
      id TEXT PRIMARY KEY, instructor_id TEXT NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL,
      program_id TEXT DEFAULT NULL, class_id TEXT DEFAULT NULL,
      instructions TEXT DEFAULT '', rubric TEXT DEFAULT '', max_score INTEGER DEFAULT 100,
      due_date DATETIME, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (instructor_id) REFERENCES users(id),
      FOREIGN KEY (program_id) REFERENCES programs(id), FOREIGN KEY (class_id) REFERENCES program_classes(id)
    );
    CREATE TABLE IF NOT EXISTS submissions (
      id TEXT PRIMARY KEY, assignment_id TEXT NOT NULL, student_id TEXT NOT NULL,
      content TEXT DEFAULT '', file_path TEXT DEFAULT NULL, file_type TEXT DEFAULT NULL,
      submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP, status TEXT DEFAULT 'submitted',
      FOREIGN KEY (assignment_id) REFERENCES assignments(id), FOREIGN KEY (student_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS grades (
      id TEXT PRIMARY KEY, submission_id TEXT UNIQUE NOT NULL, student_id TEXT NOT NULL,
      assignment_id TEXT NOT NULL, score REAL DEFAULT 0, max_score INTEGER DEFAULT 100,
      feedback TEXT DEFAULT '', strengths TEXT DEFAULT '', weaknesses TEXT DEFAULT '',
      suggestions TEXT DEFAULT '', ai_score REAL DEFAULT NULL, ai_feedback TEXT DEFAULT '',
      ai_assessed_at DATETIME, manually_overridden INTEGER DEFAULT 0, graded_by TEXT DEFAULT 'ai',
      graded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (submission_id) REFERENCES submissions(id), FOREIGN KEY (student_id) REFERENCES users(id),
      FOREIGN KEY (assignment_id) REFERENCES assignments(id)
    );
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, title TEXT NOT NULL, message TEXT NOT NULL,
      type TEXT DEFAULT 'info', read INTEGER DEFAULT 0, related_id TEXT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS programs (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, slug TEXT UNIQUE NOT NULL, description TEXT NOT NULL,
      duration TEXT DEFAULT '3 Months', level TEXT DEFAULT 'Beginner', audience TEXT DEFAULT '',
      outcomes TEXT DEFAULT '', icon TEXT DEFAULT '', created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS enrollments (
      id TEXT PRIMARY KEY, student_id TEXT NOT NULL, program_id TEXT NOT NULL,
      class_id TEXT DEFAULT NULL,
      session TEXT CHECK(session IN ('Morning','Evening')) NOT NULL DEFAULT 'Morning',
      status TEXT CHECK(status IN ('pending','active','completed','dropped')) NOT NULL DEFAULT 'pending',
      enrolled_at DATETIME DEFAULT CURRENT_TIMESTAMP, completed_at DATETIME,
      FOREIGN KEY (student_id) REFERENCES users(id), FOREIGN KEY (program_id) REFERENCES programs(id),
      FOREIGN KEY (class_id) REFERENCES program_classes(id)
    );
    CREATE TABLE IF NOT EXISTS program_classes (
      id TEXT PRIMARY KEY,
      program_id TEXT NOT NULL,
      instructor_id TEXT DEFAULT NULL,
      forum_category_id TEXT DEFAULT NULL,
      name TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL,
      session TEXT CHECK(session IN ('Morning','Evening')) NOT NULL DEFAULT 'Morning',
      capacity INTEGER NOT NULL DEFAULT 25,
      start_date TEXT DEFAULT '',
      end_date TEXT DEFAULT '',
      status TEXT CHECK(status IN ('planned','active','completed','archived')) NOT NULL DEFAULT 'planned',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (program_id) REFERENCES programs(id),
      FOREIGN KEY (instructor_id) REFERENCES users(id),
      FOREIGN KEY (forum_category_id) REFERENCES forum_categories(id)
    );
    CREATE TABLE IF NOT EXISTS certificates (
      id TEXT PRIMARY KEY, serial_number TEXT UNIQUE NOT NULL, student_id TEXT NOT NULL,
      program_id TEXT NOT NULL, issue_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT CHECK(status IN ('valid','revoked')) NOT NULL DEFAULT 'valid',
      FOREIGN KEY (student_id) REFERENCES users(id), FOREIGN KEY (program_id) REFERENCES programs(id)
    );
    CREATE TABLE IF NOT EXISTS contacts (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT DEFAULT '',
      message TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS onboarding_assessments (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      enrollment_id TEXT DEFAULT NULL,
      date_of_birth TEXT DEFAULT '',
      gender TEXT DEFAULT '',
      education_level TEXT DEFAULT '',
      computing_experience TEXT DEFAULT '',
      strengths TEXT DEFAULT '',
      greatest_strength TEXT DEFAULT '',
      weaknesses TEXT DEFAULT '',
      weakness_response TEXT DEFAULT '',
      improvement_plan TEXT DEFAULT '',
      status TEXT CHECK(status IN ('recommended','submitted','reviewed','needs_followup')) NOT NULL DEFAULT 'recommended',
      score REAL DEFAULT NULL,
      max_score INTEGER DEFAULT 100,
      feedback TEXT DEFAULT '',
      reviewed_by TEXT DEFAULT NULL,
      reviewed_at DATETIME DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES users(id),
      FOREIGN KEY (enrollment_id) REFERENCES enrollments(id),
      FOREIGN KEY (reviewed_by) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS testimonials (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, role TEXT NOT NULL, message TEXT NOT NULL,
      avatar TEXT DEFAULT '', active INTEGER DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS partners (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, logo_url TEXT NOT NULL, active INTEGER DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY, sender_id TEXT NOT NULL, receiver_id TEXT NOT NULL,
      content TEXT NOT NULL, is_read INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sender_id) REFERENCES users(id), FOREIGN KEY (receiver_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS forum_categories (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT DEFAULT '',
      type TEXT CHECK(type IN ('general','cohort')) NOT NULL DEFAULT 'general',
      session TEXT DEFAULT NULL, program_id TEXT DEFAULT NULL, class_id TEXT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (program_id) REFERENCES programs(id),
      FOREIGN KEY (class_id) REFERENCES program_classes(id)
    );
    CREATE TABLE IF NOT EXISTS forum_topics (
      id TEXT PRIMARY KEY, category_id TEXT NOT NULL, user_id TEXT NOT NULL,
      title TEXT NOT NULL, content TEXT NOT NULL, is_pinned INTEGER DEFAULT 0, is_closed INTEGER DEFAULT 0,
      views INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES forum_categories(id), FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS forum_replies (
      id TEXT PRIMARY KEY, topic_id TEXT NOT NULL, user_id TEXT NOT NULL,
      content TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (topic_id) REFERENCES forum_topics(id), FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS attendance_sessions (
      id TEXT PRIMARY KEY, instructor_id TEXT NOT NULL, program_id TEXT NOT NULL,
      class_id TEXT DEFAULT NULL,
      title TEXT DEFAULT '', date TEXT NOT NULL, closes_at TEXT NOT NULL,
      status TEXT CHECK(status IN ('open','closed')) NOT NULL DEFAULT 'open',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (instructor_id) REFERENCES users(id), FOREIGN KEY (program_id) REFERENCES programs(id),
      FOREIGN KEY (class_id) REFERENCES program_classes(id)
    );
    CREATE TABLE IF NOT EXISTS attendance (
      id TEXT PRIMARY KEY, session_id TEXT NOT NULL, student_id TEXT NOT NULL, program_id TEXT NOT NULL,
      marked_by TEXT NOT NULL, date TEXT NOT NULL,
      status TEXT CHECK(status IN ('present','absent','late','excused')) NOT NULL DEFAULT 'present',
      notes TEXT DEFAULT '', marked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES attendance_sessions(id), FOREIGN KEY (student_id) REFERENCES users(id),
      FOREIGN KEY (program_id) REFERENCES programs(id), FOREIGN KEY (marked_by) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS notification_settings (
      id TEXT PRIMARY KEY, user_id TEXT UNIQUE NOT NULL, email_notifications INTEGER DEFAULT 1,
      sms_notifications INTEGER DEFAULT 0, phone TEXT DEFAULT NULL,
      notify_assignment INTEGER DEFAULT 1, notify_grade INTEGER DEFAULT 1,
      notify_forum INTEGER DEFAULT 1, notify_message INTEGER DEFAULT 1,
      notify_attendance INTEGER DEFAULT 1, FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS notification_log (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, notification_id TEXT DEFAULT NULL,
      channel TEXT CHECK(channel IN ('email','sms','in_app')) NOT NULL DEFAULT 'in_app',
      subject TEXT DEFAULT '', message TEXT NOT NULL,
      status TEXT CHECK(status IN ('sent','failed','pending')) NOT NULL DEFAULT 'pending',
      error TEXT DEFAULT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS forum_likes (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL,
      target_type TEXT CHECK(target_type IN ('topic','reply')) NOT NULL,
      target_id TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id,target_type,target_id), FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS forum_reply_ratings (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, reply_id TEXT NOT NULL,
      rating INTEGER CHECK(rating>=1 AND rating<=5) NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id,reply_id), FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (reply_id) REFERENCES forum_replies(id)
    );
    CREATE TABLE IF NOT EXISTS materials (
      id TEXT PRIMARY KEY, instructor_id TEXT NOT NULL, program_id TEXT NOT NULL,
      title TEXT NOT NULL, description TEXT DEFAULT '', file_path TEXT DEFAULT NULL,
      file_type TEXT DEFAULT NULL, link_url TEXT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (instructor_id) REFERENCES users(id), FOREIGN KEY (program_id) REFERENCES programs(id)
    );
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY, program_id TEXT, title TEXT NOT NULL, description TEXT DEFAULT '',
      event_date TEXT NOT NULL, start_time TEXT DEFAULT '', end_time TEXT DEFAULT '',
      type TEXT CHECK(type IN ('class','deadline','holiday','exam','other')) NOT NULL DEFAULT 'class',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (program_id) REFERENCES programs(id)
    );
    CREATE TABLE IF NOT EXISTS quizzes (
      id TEXT PRIMARY KEY, instructor_id TEXT NOT NULL, program_id TEXT NOT NULL,
      title TEXT NOT NULL, description TEXT DEFAULT '', due_date TEXT DEFAULT NULL,
      time_limit INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (instructor_id) REFERENCES users(id), FOREIGN KEY (program_id) REFERENCES programs(id)
    );
    CREATE TABLE IF NOT EXISTS quiz_questions (
      id TEXT PRIMARY KEY, quiz_id TEXT NOT NULL, question TEXT NOT NULL,
      type TEXT CHECK(type IN ('multiple_choice','essay')) NOT NULL DEFAULT 'multiple_choice',
      points INTEGER DEFAULT 1, sort_order INTEGER DEFAULT 0,
      FOREIGN KEY (quiz_id) REFERENCES quizzes(id)
    );
    CREATE TABLE IF NOT EXISTS quiz_options (
      id TEXT PRIMARY KEY, question_id TEXT NOT NULL, option_text TEXT NOT NULL,
      is_correct INTEGER DEFAULT 0, sort_order INTEGER DEFAULT 0,
      FOREIGN KEY (question_id) REFERENCES quiz_questions(id)
    );
    CREATE TABLE IF NOT EXISTS quiz_submissions (
      id TEXT PRIMARY KEY, quiz_id TEXT NOT NULL, student_id TEXT NOT NULL,
      score REAL DEFAULT 0, total_points REAL DEFAULT 0,
      submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (quiz_id) REFERENCES quizzes(id), FOREIGN KEY (student_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS quiz_answers (
      id TEXT PRIMARY KEY, submission_id TEXT NOT NULL, question_id TEXT NOT NULL,
      answer TEXT DEFAULT '', is_correct INTEGER DEFAULT 0, points_earned REAL DEFAULT 0,
      FOREIGN KEY (submission_id) REFERENCES quiz_submissions(id),
      FOREIGN KEY (question_id) REFERENCES quiz_questions(id)
    );
    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY, student_id TEXT NOT NULL, enrollment_id TEXT NOT NULL,
      amount REAL NOT NULL, paid_amount REAL DEFAULT 0,
      status TEXT CHECK(status IN ('pending','partial','paid','overpaid')) NOT NULL DEFAULT 'pending',
      due_date TEXT DEFAULT NULL, paid_at DATETIME, notes TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES users(id), FOREIGN KEY (enrollment_id) REFERENCES enrollments(id)
    );
  `);
}

/* ================================================================== */
/*  Persistence                                                        */
/* ================================================================== */

/**
 * Persist the in-memory SQLite database to disk.
 * Called every 5 seconds and on process exit / SIGINT / SIGTERM.
 */
function saveDb() {
  if (db) database.saveDb();
}

// Periodic save so we lose at most 5 seconds of data on a crash
const saveInterval = setInterval(saveDb, 5000);
// Graceful shutdown handlers
process.on('exit', saveDb);
process.on('SIGINT', () => { saveDb(); process.exit(0); });
process.on('SIGTERM', () => { saveDb(); process.exit(0); });

/** Close the periodic save timer (used by tests so the process can exit). */
function closeDb() {
  clearInterval(saveInterval);
}

/* ================================================================== */
/*  Lazy Proxy                                                         */
/* ================================================================== */

/* ================================================================== */
/*  Lazy Proxy                                                         */
/* ================================================================== */

/**
 * The proxy intercepts property access on the exported module and
 * forwards it to the Database instance once initialised.
 *
 * This allows routes to synchronously require this module and use it
 * immediately — the proxy will block (throw) only if the database
 * hasn't been initialised yet, which shouldn't happen because the
 * server waits for db.ready before listening.
 */
const handler = {
  get(target, prop) {
    // Special exports that exist on the proxy itself
    if (prop === 'saveDb') return saveDb;
    if (prop === 'ready')  return ready;
    if (prop === 'type')   return database.type;
    if (prop === 'closeDb') return closeDb;

    if (!db) throw new Error(
      'Database not initialised. Use db.ready.then(() => { ... })'
    );

    if (typeof db[prop] === 'function') return db[prop].bind(db);
    return db[prop];
  },
};

// Kick off async initialisation
initDb().catch(readyReject);

const proxy = new Proxy({}, handler);
module.exports = proxy;
module.exports.saveDb = saveDb;
module.exports.ready = ready;
