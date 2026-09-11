/**
 * Database Abstraction Layer
 *
 * Provides a unified query interface that works with both SQLite
 * (via sql.js, the default) and PostgreSQL (via the `pg` package).
 *
 * Connection is configured through the DATABASE_URL environment variable:
 *   - sqlite://./portal.db          — SQLite file (default)
 *   - postgres://user:pass@host/db  — PostgreSQL
 *
 * Exported as a singleton so the entire application shares one
 * connection pool (PostgreSQL) or one in-memory database (SQLite).
 *
 * Adapter API (returned by .prepare(sql)):
 *   .get(...params)  — Single row (object) or undefined
 *   .all(...params)  — Array of row objects
 *   .run(...params)  — { changes: number } for INSERT/UPDATE/DELETE
 *
 * The SQLite adapter is synchronous (backward compatible with existing
 * route handlers that don't use `await`). The PostgreSQL adapter
 * returns Promises and requires `await`.
 */

const path = require('path');
const fs = require('fs');
const cache = require('./cache');

/* ================================================================== */
/*  Database class — singleton facade                                  */
/* ================================================================== */

class Database {
  constructor() {
    /** @type {'sqlite'|'postgres'|null} */
    this.type = null;
    /** @type {SQLiteAdapter|PostgresAdapter|null} */
    this.adapter = null;
    this._saveInterval = null;
  }

  /**
   * Connect to the database using a connection URL.
   * Automatically selects the correct adapter based on the URL prefix.
   * @param {string} [connectionString] — Defaults to process.env.DATABASE_URL
   * @returns {Promise<Database>} this
   */
  async connect(connectionString) {
    if (this.adapter) return this; // already connected

    const url = (connectionString || process.env.DATABASE_URL || '').trim();

    if (url.startsWith('postgres://') || url.startsWith('postgresql://')) {
      // A connection failure must never silently switch application datasets.
      await this._connectPostgres(url);
    } else {
      await this._connectSQLite(url || 'sqlite://./portal.db');
    }
    return this;
  }

  /* ---- SQLite (sql.js) ----------------------------------------- */

  async _connectSQLite(url) {
    const filePath = path.resolve(url.replace(/^sqlite:\/\//, ''));
    const initSqlJs = require('sql.js');
    const SQL = await initSqlJs();

    // Load existing database file, or start fresh
    const data = fs.existsSync(filePath) ? fs.readFileSync(filePath) : null;
    const sqlDb = new SQL.Database(data);

    this.type = 'sqlite';
    this.adapter = new SQLiteAdapter(sqlDb, filePath);

    // Auto-persist every 5 seconds so we lose at most 5 s of data on crash
    this._saveInterval = setInterval(() => {
      try { this.saveDb(); } catch (e) { /* disk-full or permission errors */ }
    }, 5000);
  }

  /* ---- PostgreSQL (Prisma ORM) -------------------------------- */

  async _connectPostgres(url) {
    let PrismaClient, prisma;
    try {
      ({ PrismaClient } = require('@prisma/client'));
    } catch (e) {
      throw new Error(
        'Prisma adapter requires "@prisma/client".\n' +
        'Install it: npm install @prisma/client\n' +
        'Generate the client: npx prisma generate\n' +
        'Set DATABASE_URL in your .env file.'
      );
    }

    // If a global Prisma client already exists (e.g. in lib/prisma.js),
    // reuse it so we don't exhaust connection pools on hot reloads.
    prisma = require('./prisma');

    try {
      // Verify the connection immediately (fail-fast on misconfiguration)
      await prisma.$connect();
    } catch (e) {
      throw new Error(`Failed to connect to database (${url.split('@').pop()}): ${e.message}`);
    }

    this.type = 'postgres';
    this.adapter = new PrismaAdapter(prisma);
  }

  /* ---- Unified API --------------------------------------------- */

  /**
   * Prepare and parameterise a SQL statement.
   * @param {string} sql — SQL with ? placeholders
   * @returns {{ get: Function, all: Function, run: Function }}
   */
  prepare(sql) {
    if (!this.adapter) throw new Error('Database not initialised');
    return this.adapter.prepare(sql);
  }

  /**
   * Execute raw SQL (used for schema migrations, DDL).
   * @param {string} sql
   */
  exec(sql) {
    if (!this.adapter) throw new Error('Database not initialised');
    return this.adapter.exec(sql);
  }

  /**
   * Wrap a function in an SQL transaction (BEGIN / COMMIT / ROLLBACK).
   * @param {Function} fn
   * @returns {Function} Wrapped function that auto-commits on success
   */
  transaction(fn) {
    if (!this.adapter) throw new Error('Database not initialised');
    return this.adapter.transaction(fn);
  }

  /** Persist SQLite database to disk (no-op for PostgreSQL). */
  saveDb() {
    if (this.adapter && typeof this.adapter.saveDb === 'function') {
      this.adapter.saveDb();
    }
  }

  /** Gracefully close all connections (called on shutdown). */
  async close() {
    if (this._saveInterval) clearInterval(this._saveInterval);
    if (this.adapter) await this.adapter.close();
    this.adapter = null;
    this.type = null;
  }

  /**
   * Return a health-check object.
   * @returns {Promise<{ status: string, type: string, poolSize?: number }>}
   */
  async health() {
    if (!this.adapter) return { status: 'disconnected', type: null };
    try {
      return await this.adapter.health();
    } catch (e) {
      return { status: 'error', message: e.message, type: this.type };
    }
  }
}

/* ================================================================== */
/*  SQLite Adapter (uses sql.js in-process DB)                         */
/* ================================================================== */

class SQLiteAdapter {
  /**
   * @param {any} sqlDb — sql.js Database instance
   * @param {string} filePath — Path to the .db file on disk
   */
  constructor(sqlDb, filePath) {
    this.sqlDb = sqlDb;
    this.filePath = filePath;
  }

  /**
   * Return an object with .run(), .get(), .all() methods.
   * Methods accept variadic params OR a single array of params.
   * All methods are synchronous (sql.js is in-process).
   */
  prepare(sql) {
    const self = this;
    return {
      run(...params) {
        if (params.length === 1 && Array.isArray(params[0])) params = params[0];
        try {
          self.sqlDb.run(sql, params);
        } catch (e) {
          // Gracefully skip operations on tables that don't yet exist
          if (e.message.includes('no such table')) return { changes: 0 };
          throw e;
        }
        return { changes: self.sqlDb.getRowsModified() };
      },

      get(...params) {
        if (params.length === 1 && Array.isArray(params[0])) params = params[0];
        const stmt = self.sqlDb.prepare(sql);
        try {
          if (params.length > 0) stmt.bind(params);
          if (stmt.step()) return stmt.getAsObject();
          return undefined;
        } finally {
          stmt.free(); // release sql.js internal memory
        }
      },

      all(...params) {
        if (params.length === 1 && Array.isArray(params[0])) params = params[0];
        const stmt = self.sqlDb.prepare(sql);
        try {
          if (params.length > 0) stmt.bind(params);
          const results = [];
          while (stmt.step()) results.push(stmt.getAsObject());
          return results;
        } finally {
          stmt.free();
        }
      },
    };
  }

  exec(sql) { return this.sqlDb.exec(sql); }

  /**
   * Wraps a function in BEGIN/COMMIT/ROLLBACK.
   * If the function throws, the transaction is rolled back.
   */
  transaction(fn) {
    const self = this;
    return (...args) => {
      self.sqlDb.run('BEGIN TRANSACTION');
      try {
        const result = fn(...args);
        self.sqlDb.run('COMMIT');
        return result;
      } catch (e) {
        self.sqlDb.run('ROLLBACK');
        throw e;
      }
    };
  }

  /** Serialize the in-memory DB to the .db file on disk. */
  saveDb() {
    const data = this.sqlDb.export();
    fs.writeFileSync(this.filePath, Buffer.from(data));
  }

  async close() { this.saveDb(); this.sqlDb.close(); }

  async health() {
    this.sqlDb.run('SELECT 1');
    return { status: 'ok', type: 'sqlite' };
  }
}

/* ================================================================== */
/*  PostgreSQL Adapter (uses Prisma ORM)                               */
/* ================================================================== */

class PrismaAdapter {
  /**
   * @param {import('@prisma/client').PrismaClient} prisma
   */
  constructor(prisma) {
    this.prisma = prisma;
  }

  /**
   * Convert sql.js ? placeholders to PostgreSQL $1, $2, ... syntax.
   * @private
   */
  _convert(sql, params) {
    if (!params || params.length === 0) return { text: sql, params: [] };
    let idx = 0;
    // Bind full ISO datetime strings (e.g. 2026-08-17T18:39:23.389Z) as Date
    // so PostgreSQL timestamp columns accept them. Date-only strings are left
    // as text because those columns are TEXT (events.event_date, attendance.date).
    const ISODATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
    const bound = params.map((p) => (typeof p === 'string' && ISODATETIME.test(p) ? new Date(p) : p));
    return {
      text: sql.replace(/\?/g, () => `$${++idx}`),
      params: bound,
    };
  }

  /**
   * PostgreSQL returns BIGINT columns / aggregates as JS BigInt, which
   * JSON.stringify cannot serialize. Convert bigint -> number recursively
   * so routes can compare (e.g. count === 0) and res.json(row) works.
   * @private
   */
  _normalize(value) {
    if (typeof value === 'bigint') return Number(value);
    if (Array.isArray(value)) return value.map((v) => this._normalize(v));
    if (value && typeof value === 'object') {
      for (const k of Object.keys(value)) value[k] = this._normalize(value[k]);
      return value;
    }
    return value;
  }

  /**
   * Return an object with .run(), .get(), .all() methods.
   * All methods return Promises (PostgreSQL is async).
   * Prisma's $queryRawUnsafe / $executeRawUnsafe accept $1-style params.
   */
  prepare(sql) {
    const self = this;
    return {
      async run(...params) {
        if (params.length === 1 && Array.isArray(params[0])) params = params[0];
        const { text, params: p } = self._convert(sql, params);
        const count = await self.prisma.$executeRawUnsafe(text, ...p);
        return { changes: count };
      },

      async get(...params) {
        if (params.length === 1 && Array.isArray(params[0])) params = params[0];
        const { text, params: p } = self._convert(sql, params);
        const rows = await self.prisma.$queryRawUnsafe(text, ...p);
        return self._normalize(rows[0]) || undefined;
      },

      async all(...params) {
        if (params.length === 1 && Array.isArray(params[0])) params = params[0];
        const { text, params: p } = self._convert(sql, params);
        const rows = await self.prisma.$queryRawUnsafe(text, ...p);
        return self._normalize(rows);
      },
    };
  }

  /** Execute raw DDL (used during schema initialisation). */
  async exec(sql) {
    await this.prisma.$executeRawUnsafe(sql);
  }

  /**
   * Wraps a function in a PostgreSQL transaction.
   *
   * The existing route API prepares statements BEFORE the transaction and
   * reuses them inside the callback (e.g. assignements.js notifInsert).
   * To keep that working, we swap this adapter's client to the Prisma
   * transaction client (`tx`) while the callback runs, so already-prepared
   * statements execute inside the transaction, then restore afterwards.
   *
   * NOTE: A single shared adapter means only one transaction should run at
   * a time. This matches the app's current usage (notification batch-inserts).
   */
  transaction(fn) {
    const self = this;
    return (...args) =>
      self.prisma.$transaction(async (tx) => {
        const original = self.prisma;
        self.prisma = tx;
        try {
          return await fn(...args);
        } finally {
          self.prisma = original;
        }
      });
  }

  /** No-op: PostgreSQL persists itself. */
  saveDb() {}

  async close() {
    await this.prisma.$disconnect();
  }

  async health() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: 'ok', type: 'postgres' };
  }
}

/* ================================================================== */
/*  Singleton export                                                   */
/* ================================================================== */

const database = new Database();
module.exports = database;
