const { test } = require('node:test');
const assert = require('node:assert/strict');

const { validateRuntimeEnv } = require('../lib/env');

const ENV_KEYS = ['NODE_ENV', 'JWT_SECRET', 'DATABASE_URL', 'CORS_ORIGIN'];

function withEnv(values, callback) {
  const previous = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
  ENV_KEYS.forEach((key) => {
    if (values[key] === undefined) delete process.env[key];
    else process.env[key] = values[key];
  });

  try {
    callback();
  } finally {
    ENV_KEYS.forEach((key) => {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    });
  }
}

test('production environment accepts explicit PostgreSQL and CORS configuration', () => {
  withEnv({
    NODE_ENV: 'production',
    JWT_SECRET: 'a'.repeat(64),
    DATABASE_URL: 'postgresql://user:password@example.com/portal',
    CORS_ORIGIN: 'https://portal.example.com',
  }, () => assert.doesNotThrow(() => validateRuntimeEnv()));
});

test('production environment rejects SQLite and wildcard CORS', () => {
  withEnv({
    NODE_ENV: 'production',
    JWT_SECRET: 'a'.repeat(64),
    DATABASE_URL: 'sqlite://./portal.db',
    CORS_ORIGIN: '*',
  }, () => assert.throws(() => validateRuntimeEnv(), /PostgreSQL/));

  withEnv({
    NODE_ENV: 'production',
    JWT_SECRET: 'a'.repeat(64),
    DATABASE_URL: 'postgresql://user:password@example.com/portal',
    CORS_ORIGIN: '*',
  }, () => assert.throws(() => validateRuntimeEnv(), /explicit origins/));
});

test('production environment rejects malformed CORS origins', () => {
  withEnv({
    NODE_ENV: 'production',
    JWT_SECRET: 'a'.repeat(64),
    DATABASE_URL: 'postgresql://user:password@example.com/portal',
    CORS_ORIGIN: 'portal.example.com/login',
  }, () => assert.throws(() => validateRuntimeEnv(), /invalid origin/));
});
