/**
 * Simple In-Memory Cache with TTL
 *
 * Provides a lightweight key-value store with automatic expiry.
 * Used by the Database layer to memoise frequent read queries,
 * reducing load on the underlying database engine.
 *
 * Features:
 *   - Per-key TTL (default 60 seconds)
 *   - Pattern-based invalidation (e.g. "quiz:*")
 *   - Stats tracking (hits / misses / size)
 *
 * Usage:
 *   const cache = require('./cache');
 *   cache.set('users:42', userData, 30_000);  // TTL 30 s
 *   const u = cache.get('users:42');
 *   cache.invalidate('users:*');               // wildcard
 *   cache.flush();                              // clear all
 */

class Cache {
  constructor() {
    /** @type {Map<string, { value: any, ttl: number }>} */
    this._store = new Map();
    this._stats = { hits: 0, misses: 0 };
  }

  /**
   * Retrieve a cached value.
   * @param {string} key
   * @returns {any|undefined} The value, or undefined if missing/expired.
   */
  get(key) {
    const entry = this._store.get(key);
    if (!entry) {
      this._stats.misses++;
      return undefined;
    }
    // Expired — purge and treat as a miss
    if (entry.ttl && Date.now() > entry.ttl) {
      this._store.delete(key);
      this._stats.misses++;
      return undefined;
    }
    this._stats.hits++;
    return entry.value;
  }

  /**
   * Store a value with an optional TTL.
   * @param {string} key
   * @param {any} value
   * @param {number} [ttlMs=60000] — Time-to-live in ms (0 = no expiry).
   */
  set(key, value, ttlMs = 60000) {
    this._store.set(key, {
      value,
      ttl: ttlMs > 0 ? Date.now() + ttlMs : 0,
    });
  }

  /**
   * Invalidate one or more cache entries.
   * Accepts an exact key, a glob pattern (e.g. "users:*"), or a
   * predicate function for custom matching.
   * @param {string|Function} pattern
   */
  invalidate(pattern) {
    if (typeof pattern === 'string' && pattern.includes('*')) {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      for (const key of this._store.keys()) {
        if (regex.test(key)) this._store.delete(key);
      }
    } else if (typeof pattern === 'function') {
      for (const key of this._store.keys()) {
        if (pattern(key)) this._store.delete(key);
      }
    } else {
      this._store.delete(pattern);
    }
  }

  /** Remove every entry from the cache. */
  flush() { this._store.clear(); }

  /** @returns {number} Number of entries currently cached. */
  get size() { return this._store.size; }

  /** @returns {{ hits: number, misses: number, size: number }} */
  get stats() {
    return { ...this._stats, size: this._store.size };
  }
}

module.exports = new Cache();
