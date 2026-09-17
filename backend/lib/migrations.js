/**
 * Versioned Database Migrations
 *
 * Replaces ad-hoc inline ALTER TABLE blocks with a proper versioned
 * migration system. Each migration has a unique name and runs exactly
 * once, in order. Applied migrations are tracked in a `migrations`
 * table so restarts never re-run them.
 *
 * Usage:
 *   const migrations = require('../lib/migrations');
 *   migrations.run(db);   // returns Promise; run after connect
 *
 * To add a new migration: append { name, up } to MIGRATIONS below.
 * Never edit an existing migration after it has been applied.
 */

const logger = require('./logger');

/**
 * Each migration object:
 *   name — unique string (used for tracking)
 *   up(db) — async function that performs the schema change.
 *
 * NOTE: The underlying SQLite adapter is synchronous, so `up` may be
 * synchronous too; it is awaited regardless for forward compatibility
 * with the PostgreSQL adapter.
 */
const MIGRATIONS = [
  {
    name: '001-attendance-session_id',
    up: (db) => {
      try { db.prepare('ALTER TABLE attendance ADD COLUMN session_id TEXT REFERENCES attendance_sessions(id)').run(); } catch (e) { /* column exists */ }
    },
  },
  {
    name: '002-attendance-marked_at',
    up: (db) => {
      try { db.prepare('ALTER TABLE attendance ADD COLUMN marked_at DATETIME DEFAULT CURRENT_TIMESTAMP').run(); } catch (e) { /* column exists */ }
    },
  },
  {
    name: '003-users-location',
    up: (db) => {
      try { db.prepare("ALTER TABLE users ADD COLUMN location TEXT DEFAULT ''").run(); } catch (e) { /* column exists */ }
    },
  },
  {
    name: '004-users-goal',
    up: (db) => {
      try { db.prepare("ALTER TABLE users ADD COLUMN goal TEXT DEFAULT ''").run(); } catch (e) { /* column exists */ }
    },
  },
  {
    name: '005-users-mission',
    up: (db) => {
      try { db.prepare("ALTER TABLE users ADD COLUMN mission TEXT DEFAULT ''").run(); } catch (e) { /* column exists */ }
    },
  },
  {
    name: '006-users-objectives',
    up: (db) => {
      try { db.prepare("ALTER TABLE users ADD COLUMN objectives TEXT DEFAULT ''").run(); } catch (e) { /* column exists */ }
    },
  },
  {
    name: '007-events-program_id-nullable',
    up: (db) => {
      // Fix events table if program_id was created with NOT NULL.
      // SQLite can't drop NOT NULL directly, so we recreate the table.
      try {
        const info = db.prepare('PRAGMA table_info(events)').all();
        const col = info.find((c) => c.name === 'program_id');
        if (col && col.notnull) {
          db.exec(
            'CREATE TABLE events_migrate (id TEXT PRIMARY KEY, program_id TEXT, title TEXT NOT NULL, ' +
            "description TEXT DEFAULT '', event_date TEXT NOT NULL, start_time TEXT DEFAULT '', " +
            "end_time TEXT DEFAULT '', type TEXT CHECK(type IN " +
            "('class','deadline','holiday','exam','other')) NOT NULL DEFAULT 'class', " +
            'created_at DATETIME DEFAULT CURRENT_TIMESTAMP)'
          );
          db.exec('INSERT INTO events_migrate SELECT * FROM events');
          db.exec('DROP TABLE events');
          db.exec('ALTER TABLE events_migrate RENAME TO events');
        }
      } catch (e) { /* table doesn't exist yet */ }
    },
  },
  {
    name: '008-materials-visibility',
    up: (db) => {
      // Add audience / visibility controls to materials so admins can
      // choose which groups (active students, alumni, or a specific
      // completion cohort) are allowed to see each uploaded resource.
      //   audience_groups — JSON array: ['active'] | ['alumni'] | ['active','alumni']
      //   audience_year   — completion year filter (NULL = all years)
      //   audience_month  — completion month filter (NULL = all months)
      try { db.prepare("ALTER TABLE materials ADD COLUMN audience_groups TEXT DEFAULT '[\"active\"]'").run(); } catch (e) {}
      try { db.prepare('ALTER TABLE materials ADD COLUMN audience_year TEXT').run(); } catch (e) {}
      try { db.prepare('ALTER TABLE materials ADD COLUMN audience_month TEXT').run(); } catch (e) {}
    },
  },
  {
    name: '009-blogs-and-public-events',
    up: (db) => {
      // Public blog posts shown on the landing page, managed by admins.
      db.exec(`
        CREATE TABLE IF NOT EXISTS blogs (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          slug TEXT UNIQUE NOT NULL,
          excerpt TEXT DEFAULT '',
          content TEXT NOT NULL,
          cover_image TEXT DEFAULT NULL,
          author_id TEXT NOT NULL,
          published INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (author_id) REFERENCES users(id)
        )
      `);
      // Flag on events: 1 = public (shown on landing page), 0 = internal (calendar only)
      try { db.prepare('ALTER TABLE events ADD COLUMN is_public INTEGER DEFAULT 0').run(); } catch (e) {}
    },
  },
  {
    name: '010-superadmin-schema',
    up: (db) => {
      // Admin audit trail — records who did what (create/update/delete)
      // across admin-managed entities, for accountability & investigations.
      db.exec(`
        CREATE TABLE IF NOT EXISTS admin_audit_log (
          id TEXT PRIMARY KEY,
          admin_id TEXT NOT NULL,
          admin_name TEXT DEFAULT '',
          action TEXT NOT NULL,
          entity_type TEXT NOT NULL,
          entity_id TEXT DEFAULT NULL,
          details TEXT DEFAULT '',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (admin_id) REFERENCES users(id)
        )
      `);
      // Login attempts — supports brute-force lockout + security monitoring.
      db.exec(`
        CREATE TABLE IF NOT EXISTS login_attempts (
          id TEXT PRIMARY KEY,
          email TEXT NOT NULL,
          ip TEXT DEFAULT '',
          success INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
    },
  },
  {
    name: '011-profile-extended-fields',
    up: (db) => {
      try { db.prepare("ALTER TABLE users ADD COLUMN phone TEXT DEFAULT ''").run(); } catch (e) {}
      try { db.prepare("ALTER TABLE users ADD COLUMN bio TEXT DEFAULT ''").run(); } catch (e) {}
      try { db.prepare("ALTER TABLE users ADD COLUMN avatar_color TEXT DEFAULT '#16a34a'").run(); } catch (e) {}
      try { db.prepare("ALTER TABLE users ADD COLUMN avatar_url TEXT DEFAULT ''").run(); } catch (e) {}
    },
  },
  {
    name: '012-enrollments-unique',
    up: (db) => {
      try { db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_enrollments_unique ON enrollments(student_id, program_id)'); } catch (e) {}
    },
  },
  {
    name: '013-password-resets',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS password_resets (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          token TEXT NOT NULL UNIQUE,
          expires_at DATETIME NOT NULL,
          used INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);
      try { db.exec('CREATE INDEX IF NOT EXISTS idx_password_resets_token ON password_resets(token)'); } catch {}
      try { db.exec('CREATE INDEX IF NOT EXISTS idx_password_resets_user ON password_resets(user_id)'); } catch {}
    },
  },
  {
    name: '014-events-created-by',
    up: (db) => {
      try { db.prepare('ALTER TABLE events ADD COLUMN created_by TEXT').run(); } catch (e) {}
      try { db.exec('CREATE INDEX IF NOT EXISTS idx_events_created_by ON events(created_by)'); } catch {}
    },
  },
  {
    name: '015-policy-audit-indexes',
    up: (db) => {
      // Index high-traffic authorization joins and security screens. These
      // preserve current behavior while keeping list/detail checks quick as
      // student volume grows.
      try { db.prepare("ALTER TABLE admin_audit_log ADD COLUMN actor_role TEXT DEFAULT ''").run(); } catch (e) {}
      try { db.exec('CREATE INDEX IF NOT EXISTS idx_admin_audit_created_at ON admin_audit_log(created_at)'); } catch {}
      try { db.exec('CREATE INDEX IF NOT EXISTS idx_admin_audit_actor ON admin_audit_log(admin_id, created_at)'); } catch {}
      try { db.exec('CREATE INDEX IF NOT EXISTS idx_login_attempts_email_time ON login_attempts(email, created_at)'); } catch {}
      try { db.exec('CREATE INDEX IF NOT EXISTS idx_submissions_student_time ON submissions(student_id, submitted_at)'); } catch {}
      try { db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_submissions_assignment_student ON submissions(assignment_id, student_id)'); } catch {}
      try { db.exec('CREATE INDEX IF NOT EXISTS idx_assignments_instructor_due ON assignments(instructor_id, due_date)'); } catch {}
      try { db.exec('CREATE INDEX IF NOT EXISTS idx_attendance_session_student ON attendance(session_id, student_id)'); } catch {}
      try { db.exec('CREATE INDEX IF NOT EXISTS idx_materials_program_created ON materials(program_id, created_at)'); } catch {}
      try { db.exec('CREATE INDEX IF NOT EXISTS idx_payments_student_status ON payments(student_id, status)'); } catch {}
      try { db.exec('CREATE INDEX IF NOT EXISTS idx_notifications_user_read_time ON notifications(user_id, read, created_at)'); } catch {}
    },
  },
  {
    name: '016-query-scaling-indexes',
    up: (db) => {
      // Mirrors Prisma @@index metadata for the SQLite runtime used in local
      // and test environments. These are non-unique so they can be applied to
      // existing production-like data without cleanup risk.
      try { db.exec('CREATE INDEX IF NOT EXISTS idx_enrollments_program_status ON enrollments(program_id, status)'); } catch {}
      try { db.exec('CREATE INDEX IF NOT EXISTS idx_certificates_student_status ON certificates(student_id, status)'); } catch {}
      try { db.exec('CREATE INDEX IF NOT EXISTS idx_certificates_program_status ON certificates(program_id, status)'); } catch {}
      try { db.exec('CREATE INDEX IF NOT EXISTS idx_attendance_sessions_instructor_date ON attendance_sessions(instructor_id, date)'); } catch {}
      try { db.exec('CREATE INDEX IF NOT EXISTS idx_attendance_sessions_program_date ON attendance_sessions(program_id, date)'); } catch {}
      try { db.exec('CREATE INDEX IF NOT EXISTS idx_attendance_student_date ON attendance(student_id, date)'); } catch {}
      try { db.exec('CREATE INDEX IF NOT EXISTS idx_materials_instructor_created ON materials(instructor_id, created_at)'); } catch {}
      try { db.exec('CREATE INDEX IF NOT EXISTS idx_events_created_by_date ON events(created_by, event_date)'); } catch {}
      try { db.exec('CREATE INDEX IF NOT EXISTS idx_events_program_date ON events(program_id, event_date)'); } catch {}
      try { db.exec('CREATE INDEX IF NOT EXISTS idx_payments_enrollment_status ON payments(enrollment_id, status)'); } catch {}
    },
  },
  {
    name: '017-onboarding-assessments',
    up: (db) => {
      // Captures the paper registration form's aptitude test as structured
      // onboarding data so admins can score applications before activation.
      db.exec(`
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
          status TEXT CHECK(status IN ('submitted','reviewed','needs_followup')) NOT NULL DEFAULT 'submitted',
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
        )
      `);
      try { db.exec('CREATE INDEX IF NOT EXISTS idx_onboarding_student_created ON onboarding_assessments(student_id, created_at)'); } catch {}
      try { db.exec('CREATE INDEX IF NOT EXISTS idx_onboarding_enrollment ON onboarding_assessments(enrollment_id)'); } catch {}
      try { db.exec('CREATE INDEX IF NOT EXISTS idx_onboarding_status_created ON onboarding_assessments(status, created_at)'); } catch {}
    },
  },
  {
    name: '018-admin-recommended-onboarding',
    up: (db) => {
      // Registration intake belongs to the applicant profile; the aptitude
      // assessment is now created later only when an admin recommends it.
      try { db.prepare("ALTER TABLE users ADD COLUMN date_of_birth TEXT DEFAULT ''").run(); } catch (e) {}
      try { db.prepare("ALTER TABLE users ADD COLUMN gender TEXT DEFAULT ''").run(); } catch (e) {}
      try { db.prepare("ALTER TABLE users ADD COLUMN education_level TEXT DEFAULT ''").run(); } catch (e) {}
      try { db.prepare("ALTER TABLE users ADD COLUMN computing_experience TEXT DEFAULT ''").run(); } catch (e) {}

      const table = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'onboarding_assessments'").get();
      if (table?.sql && !table.sql.includes("'recommended'")) {
        db.exec(`
          CREATE TABLE onboarding_assessments_next (
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
          INSERT INTO onboarding_assessments_next (
            id, student_id, enrollment_id, date_of_birth, gender, education_level,
            computing_experience, strengths, greatest_strength, weaknesses,
            weakness_response, improvement_plan, status, score, max_score, feedback,
            reviewed_by, reviewed_at, created_at, updated_at
          )
          SELECT
            id, student_id, enrollment_id, date_of_birth, gender, education_level,
            computing_experience, strengths, greatest_strength, weaknesses,
            weakness_response, improvement_plan, status, score, max_score, feedback,
            reviewed_by, reviewed_at, created_at, updated_at
          FROM onboarding_assessments;
          DROP TABLE onboarding_assessments;
          ALTER TABLE onboarding_assessments_next RENAME TO onboarding_assessments;
        `);
      }
      try { db.exec('CREATE INDEX IF NOT EXISTS idx_onboarding_student_created ON onboarding_assessments(student_id, created_at)'); } catch {}
      try { db.exec('CREATE INDEX IF NOT EXISTS idx_onboarding_enrollment ON onboarding_assessments(enrollment_id)'); } catch {}
      try { db.exec('CREATE INDEX IF NOT EXISTS idx_onboarding_status_created ON onboarding_assessments(status, created_at)'); } catch {}
    },
  },
  {
    name: '019-program-class-allocation',
    up: (db) => {
      // Programme classes hold the operational cohort: instructor, capacity,
      // dates, and the linked discussion category used by the forum module.
      db.exec(`
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
        )
      `);
      try { db.prepare('ALTER TABLE enrollments ADD COLUMN class_id TEXT DEFAULT NULL REFERENCES program_classes(id)').run(); } catch (e) {}
      try { db.prepare('ALTER TABLE forum_categories ADD COLUMN program_id TEXT DEFAULT NULL REFERENCES programs(id)').run(); } catch (e) {}
      try { db.prepare('ALTER TABLE forum_categories ADD COLUMN class_id TEXT DEFAULT NULL REFERENCES program_classes(id)').run(); } catch (e) {}
      try { db.exec('CREATE INDEX IF NOT EXISTS idx_program_classes_program_status ON program_classes(program_id, status)'); } catch {}
      try { db.exec('CREATE INDEX IF NOT EXISTS idx_program_classes_instructor ON program_classes(instructor_id, status)'); } catch {}
      try { db.exec('CREATE INDEX IF NOT EXISTS idx_enrollments_class_status ON enrollments(class_id, status)'); } catch {}
      try { db.exec('CREATE INDEX IF NOT EXISTS idx_forum_categories_class ON forum_categories(class_id)'); } catch {}
    },
  },
  {
    name: '020-attendance-class-scope',
    up: (db) => {
      // Optional class scope lets attendance use the exact class roster while
      // preserving older program-wide sessions for historical records.
      try { db.prepare('ALTER TABLE attendance_sessions ADD COLUMN class_id TEXT DEFAULT NULL REFERENCES program_classes(id)').run(); } catch (e) {}
      try { db.exec('CREATE INDEX IF NOT EXISTS idx_attendance_sessions_class_date ON attendance_sessions(class_id, date)'); } catch {}
    },
  },
  {
    name: '021-assignments-program-class-scope',
    up: (db) => {
      // Assignments now follow the same programme/class authorization model
      // as attendance, quizzes, materials, and forums. Existing rows remain
      // NULL-scoped so historical assignments stay visible until backfilled.
      try { db.prepare('ALTER TABLE assignments ADD COLUMN program_id TEXT DEFAULT NULL REFERENCES programs(id)').run(); } catch (e) {}
      try { db.prepare('ALTER TABLE assignments ADD COLUMN class_id TEXT DEFAULT NULL REFERENCES program_classes(id)').run(); } catch (e) {}
      try { db.exec('CREATE INDEX IF NOT EXISTS idx_assignments_program_due ON assignments(program_id, due_date)'); } catch {}
      try { db.exec('CREATE INDEX IF NOT EXISTS idx_assignments_class_due ON assignments(class_id, due_date)'); } catch {}
    },
  },
  {
    name: '022-content-publishing-social-links',
    up: (db) => {
      db.exec("ALTER TABLE blogs ADD COLUMN content_type TEXT NOT NULL DEFAULT 'blog'");
      db.exec("ALTER TABLE blogs ADD COLUMN review_status TEXT NOT NULL DEFAULT 'draft'");
      db.exec("UPDATE blogs SET review_status = 'published' WHERE published = 1");
      db.exec("CREATE TABLE social_links (platform TEXT PRIMARY KEY, url TEXT NOT NULL DEFAULT '')");
    },
  },
];

/**
 * Ensure the migrations tracking table exists.
 * @param {Object} db — database proxy
 */
function ensureTable(db) {
  db.exec('CREATE TABLE IF NOT EXISTS migrations (name TEXT PRIMARY KEY, applied_at DATETIME DEFAULT CURRENT_TIMESTAMP)');
}

/**
 * List migrations already applied, in order.
 * @param {Object} db
 * @returns {string[]} applied migration names
 */
function getApplied(db) {
  try {
    return db.prepare('SELECT name FROM migrations').all().map((r) => r.name);
  } catch (e) {
    return [];
  }
}

/**
 * Run all pending migrations.
 * @param {Object} db — database proxy
 * @returns {Promise<string[]>} names of migrations just applied
 */
async function run(db) {
  ensureTable(db);
  const applied = new Set(getApplied(db));
  const executed = [];

  for (const migration of MIGRATIONS) {
    if (applied.has(migration.name)) continue;
    try {
      await migration.up(db);
      db.prepare('INSERT INTO migrations (name) VALUES (?)').run(migration.name);
      db.saveDb();
      executed.push(migration.name);
      logger.info('Migration applied', { migration: migration.name });
    } catch (e) {
      logger.error('Migration failed', { migration: migration.name, ...logger.errMeta(e) });
      throw e;
    }
  }

  if (executed.length === 0) {
    logger.info('No pending migrations');
  }
  return executed;
}

module.exports = { run, MIGRATIONS };
