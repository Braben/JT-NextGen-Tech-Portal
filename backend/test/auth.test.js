/**
 * Auth API Integration Tests
 *
 * Covers the /api/auth endpoints:
 *   - POST /register        (success, duplicate email, invalid input)
 *   - POST /login           (success, bad credentials)
 *   - GET  /me              (with + without token)
 *   - PUT  /change-password (valid + wrong current password)
 *
 * Uses an isolated SQLite database (see helpers.js).
 */

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');

const { app, db, waitForDb, cleanupTestDb } = require('./helpers');

let programId;

before(async () => {
  await waitForDb();
  programId = 'auth-test-program';
  await db.prepare('INSERT INTO programs (id, title, slug, description) VALUES (?,?,?,?)')
    .run(programId, 'Registration Program', 'registration-program', 'Program used by registration tests.');
  await db.saveDb();
});
after(() => { cleanupTestDb(); });

const testUser = {
  name: 'Test Student',
  email: 'student@test.com',
  password: 'secret123',
  role: 'student',
  phone: '+233 555 0100',
  program_id: 'auth-test-program',
  session: 'Morning',
  consent: true,
  profile: {
    date_of_birth: '2004-03-12',
    gender: 'Prefer not to say',
    education_level: 'SHS Graduate',
    computing_experience: 'Yes',
  },
};

test('register: creates a user and returns a token', async () => {
  const res = await request(app).post('/api/auth/register').send(testUser);
  assert.strictEqual(res.status, 201);
  assert.ok(res.body.token);
  assert.strictEqual(res.body.user.email, testUser.email);
  assert.strictEqual(res.body.user.role, 'student');
  assert.strictEqual(res.body.user.password, undefined); // never leak password
});

test('register: stores applicant intake and pending enrollment without aptitude assessment', async () => {
  const user = await db.prepare('SELECT * FROM users WHERE email = ?').get(testUser.email);
  const enrollment = await db.prepare('SELECT * FROM enrollments WHERE student_id = ? AND program_id = ?').get(user.id, testUser.program_id);
  const assessment = await db.prepare('SELECT * FROM onboarding_assessments WHERE student_id = ?').get(user.id);

  assert.strictEqual(user.education_level, 'SHS Graduate');
  assert.strictEqual(user.computing_experience, 'Yes');
  assert.strictEqual(enrollment.status, 'pending');
  assert.strictEqual(enrollment.session, 'Morning');
  assert.strictEqual(assessment, undefined);
});

test('register: requires consent for onboarding data processing', async () => {
  const res = await request(app).post('/api/auth/register').send({
    ...testUser,
    email: 'no-consent@test.com',
    consent: false,
  });
  assert.strictEqual(res.status, 400);
  assert.match(res.body.error, /Consent is required/);
  assert.match(res.body.fieldErrors.consent, /Consent is required/);
});

test('register: requires applicant profile fields', async () => {
  const res = await request(app).post('/api/auth/register').send({
    ...testUser,
    email: 'missing-profile@test.com',
    profile: { ...testUser.profile, education_level: '' },
  });
  assert.strictEqual(res.status, 400);
  assert.match(res.body.error, /education/i);
  assert.match(res.body.fieldErrors.education_level, /education/i);
});

test('register: ignores elevated role requests', async () => {
  const res = await request(app).post('/api/auth/register').send({
    name: 'Role Escalation',
    email: 'role-escalation@test.com',
    password: 'secret123',
    role: 'admin',
    phone: '+233 555 0102',
    program_id: programId,
    session: 'Evening',
    consent: true,
    profile: testUser.profile,
  });
  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.body.user.role, 'student');
});

test('register: duplicate email returns 409', async () => {
  const res = await request(app).post('/api/auth/register').send(testUser);
  assert.strictEqual(res.status, 409);
  assert.match(res.body.error, /Email already registered/);
  assert.match(res.body.fieldErrors.email, /Email already registered/);
});

test('register: missing password returns 400 (validation)', async () => {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name: 'X', email: 'x@test.com', password: '' });
  assert.strictEqual(res.status, 400);
  assert.match(res.body.error, /password/i);
  assert.match(res.body.fieldErrors.password, /password/i);
});

test('login: returns token with valid credentials', async () => {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: testUser.email, password: testUser.password });
  assert.strictEqual(res.status, 200);
  assert.ok(res.body.token);
  assert.strictEqual(res.body.user.email, testUser.email);
});

test('login: wrong password returns 401 without revealing cause', async () => {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: testUser.email, password: 'wrongpass' });
  assert.strictEqual(res.status, 401);
  assert.match(res.body.error, /Invalid email or password/);
});

test('me: rejects requests without a token', async () => {
  const res = await request(app).get('/api/auth/me');
  assert.strictEqual(res.status, 401);
  assert.match(res.body.error, /token/i);
});

test('me: returns profile for authenticated user', async () => {
  const login = await request(app)
    .post('/api/auth/login')
    .send({ email: testUser.email, password: testUser.password });
  const token = login.body.token;

  const res = await request(app)
    .get('/api/auth/me')
    .set('Authorization', `Bearer ${token}`);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.email, testUser.email);
  assert.ok(Array.isArray(res.body.enrollments));
});

test('change-password: wrong current password returns 401', async () => {
  const login = await request(app)
    .post('/api/auth/login')
    .send({ email: testUser.email, password: testUser.password });
  const token = login.body.token;

  const res = await request(app)
    .put('/api/auth/change-password')
    .set('Authorization', `Bearer ${token}`)
    .send({ current_password: 'nope', new_password: 'newsecret123' });
  assert.strictEqual(res.status, 401);
});

test('change-password: valid change succeeds, new password works', async () => {
  const login = await request(app)
    .post('/api/auth/login')
    .send({ email: testUser.email, password: testUser.password });
  const token = login.body.token;

  const change = await request(app)
    .put('/api/auth/change-password')
    .set('Authorization', `Bearer ${token}`)
    .send({ current_password: testUser.password, new_password: 'newsecret123' });
  assert.strictEqual(change.status, 200);

  // Old password should now fail
  const oldLogin = await request(app)
    .post('/api/auth/login')
    .send({ email: testUser.email, password: testUser.password });
  assert.strictEqual(oldLogin.status, 401);

  // New password should work
  const newLogin = await request(app)
    .post('/api/auth/login')
    .send({ email: testUser.email, password: 'newsecret123' });
  assert.strictEqual(newLogin.status, 200);
});
