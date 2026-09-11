/**
 * Programs API Integration Tests
 *
 * Covers /api/programs:
 *   - GET / (public, no auth required)
 *   - POST / (admin-only)
 *   - GET /:slug
 *
 * Uses the same isolated test database as auth.test.js.
 */

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const { app, db, waitForDb, cleanupTestDb } = require('./helpers');

before(async () => { await waitForDb(); });
after(() => { cleanupTestDb(); });

/** Create an admin user and return their JWT. */
async function createAdminToken() {
  await db.prepare('INSERT INTO users (id, name, email, password, role) VALUES (?,?,?,?,?)')
    .run(uuidv4(), 'Admin', 'admin@test.com', bcrypt.hashSync('adminpass123', 10), 'admin');
  const login = await request(app)
    .post('/api/auth/login')
    .send({ email: 'admin@test.com', password: 'adminpass123' });
  return login.body.token;
}

test('programs: list is public (200, no auth)', async () => {
  const res = await request(app).get('/api/programs');
  assert.strictEqual(res.status, 200);
  assert.ok(Array.isArray(res.body));
});

test('programs: admin can create a program', async () => {
  const token = await createAdminToken();
  const res = await request(app)
    .post('/api/programs')
    .set('Authorization', `Bearer ${token}`)
    .send({ title: 'Test Program', slug: 'test-program', description: 'A test program' });
  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.body.slug, 'test-program');
});

test('programs: get by slug returns the program', async () => {
  const res = await request(app).get('/api/programs/test-program');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.title, 'Test Program');
});

test('programs: updates and deletes invalidate public cache and duplicate slugs return 409', async () => {
  const login = await request(app).post('/api/auth/login').send({ email: 'admin@test.com', password: 'adminpass123' });
  const auth = `Bearer ${login.body.token}`;
  const created = await request(app).post('/api/programs').set('Authorization', auth).send({ title: 'CRUD', slug: 'crud', description: 'Test', audience: 'Everyone' });
  assert.strictEqual(created.status, 201);
  await request(app).get('/api/programs/crud');
  const updated = await request(app).put(`/api/programs/${created.body.id}`).set('Authorization', auth).send({ title: 'Updated', audience: '', outcomes: [] });
  assert.strictEqual(updated.status, 200);
  assert.strictEqual(updated.body.audience, '');
  assert.strictEqual((await request(app).get('/api/programs/crud')).body.title, 'Updated');
  const duplicate = await request(app).post('/api/programs').set('Authorization', auth).send({ title: 'Duplicate', slug: 'crud', description: 'Test' });
  assert.strictEqual(duplicate.status, 409);
  assert.strictEqual((await request(app).delete(`/api/programs/${created.body.id}`).set('Authorization', auth)).status, 200);
  assert.strictEqual((await request(app).get('/api/programs/crud')).status, 404);
});

test('programs: unauthenticated cannot create (401)', async () => {
  const res = await request(app)
    .post('/api/programs')
    .send({ title: 'Hacked', slug: 'hacked', description: 'no auth' });
  assert.strictEqual(res.status, 401);
});
