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
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const { app, db, waitForDb, cleanupTestDb } = require('./helpers');

const cookieOf = response => response.headers['set-cookie'][0].split(';')[0];
const refresh = cookie => request(app).post('/api/auth/refresh').set('Cookie', cookie).set('X-Portal-CSRF', '1');
async function sessionUser(label) {
  const response = await request(app).post('/api/auth/register').send({ ...testUser, email: `${label}@test.com` });
  assert.equal(response.status, 201, response.body.error);
  return response;
}

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

test('sessions: cookie is HttpOnly, token is short lived and only refresh hashes are stored', async () => {
  const response = await sessionUser('session-cookie');
  const cookie = response.headers['set-cookie'][0];
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Strict/);
  assert.match(cookie, /Path=\/api\/auth/);
  assert.equal(response.headers['cache-control'], 'no-store');
  const claims = jwt.decode(response.body.token);
  assert.equal(claims.exp - claims.iat, 900);
  assert.ok(claims.sid);
  const raw = cookieOf(response).split('=')[1];
  const row = await db.prepare('SELECT * FROM auth_sessions WHERE id = ?').get(claims.sid);
  assert.notEqual(row.current_hash, raw);
  assert.equal(row.current_hash, crypto.createHash('sha256').update(raw).digest('hex'));
});

test('sessions: rotation replaces cookie and replay revokes the whole session', async () => {
  const login = await sessionUser('rotation');
  const rotated = await refresh(cookieOf(login));
  assert.equal(rotated.status, 200);
  assert.notEqual(cookieOf(rotated), cookieOf(login));
  assert.equal((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${rotated.body.token}`)).status, 200);
  assert.equal((await refresh(cookieOf(login))).status, 401);
  assert.equal((await refresh(cookieOf(rotated))).status, 401);
  assert.equal((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${rotated.body.token}`)).status, 401);
});

test('sessions: concurrent reuse cannot create two live successor sessions', async () => {
  const login = await sessionUser('parallel-rotation');
  const results = await Promise.all([refresh(cookieOf(login)), refresh(cookieOf(login))]);
  assert.equal(results.filter(r => r.status === 200).length, 1);
  assert.equal(results.filter(r => r.status === 401).length, 1);
  const winner = results.find(r => r.status === 200);
  assert.equal((await refresh(cookieOf(winner))).status, 401);
});

test('sessions: refresh requires CSRF header and rejects hostile origins', async () => {
  const login = await sessionUser('csrf');
  assert.equal((await request(app).post('/api/auth/refresh').set('Cookie', cookieOf(login))).status, 403);
  assert.equal((await refresh(cookieOf(login)).set('Origin', 'https://attacker.example')).status, 403);
  assert.equal((await refresh(cookieOf(login))).status, 200);
});

test('sessions: logout revokes access and refresh tokens', async () => {
  const login = await sessionUser('logout');
  const result = await request(app).post('/api/auth/logout').set('Cookie', cookieOf(login)).set('X-Portal-CSRF', '1');
  assert.equal(result.status, 200);
  assert.match(result.headers['set-cookie'][0], /Expires=Thu, 01 Jan 1970/);
  assert.equal((await refresh(cookieOf(login))).status, 401);
  assert.equal((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${login.body.token}`)).status, 401);
});

test('sessions: password change revokes every device', async () => {
  const first = await sessionUser('password-revoke');
  const second = await request(app).post('/api/auth/login').send({email:'password-revoke@test.com', password:testUser.password});
  const changed = await request(app).put('/api/auth/change-password').set('Authorization', `Bearer ${first.body.token}`)
    .send({current_password:testUser.password, new_password:'new-secret-789'});
  assert.equal(changed.status,200);
  for (const device of [first,second]) {
    assert.equal((await refresh(cookieOf(device))).status,401);
    assert.equal((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${device.body.token}`)).status,401);
  }
});

test('login: old failures expire, success resets failures and blocked retries do not extend lockout', async () => {
  await sessionUser('lockout');
  const email = 'lockout@test.com';
  const old = new Date(Date.now()-3600000).toISOString().slice(0,19).replace('T',' ');
  for (let i=0;i<6;i++) await db.prepare('INSERT INTO login_attempts (id,email,success,created_at) VALUES (?,?,0,?)').run(crypto.randomUUID(),email,old);
  const login = password => request(app).post('/api/auth/login').send({email,password});
  assert.equal((await login(testUser.password)).status,200);
  for(let i=0;i<4;i++) assert.equal((await login('wrong-password')).status,401);
  assert.equal((await login(testUser.password)).status,200);
  assert.equal((await db.prepare('SELECT COUNT(*) AS c FROM login_attempts WHERE email=? AND success=0').get(email)).c,0);
  for(let i=0;i<5;i++) assert.equal((await login('wrong-password')).status,401);
  const blocked = await login(testUser.password);
  assert.equal(blocked.status,429);
  assert.ok(Number(blocked.headers['retry-after'])>0);
  assert.ok(blocked.body.retryAfter<=900);
  await login(testUser.password);
  assert.equal((await db.prepare('SELECT COUNT(*) AS c FROM login_attempts WHERE email=? AND success=0').get(email)).c,5);
  await db.prepare('UPDATE login_attempts SET created_at=? WHERE email=? AND success=0').run(old,email);
  assert.equal((await login(testUser.password)).status,200);
});

test('sessions: expired sessions and legacy access tokens are rejected', async () => {
  const login = await sessionUser('expired-session');
  const claims = jwt.decode(login.body.token);
  await db.prepare('UPDATE auth_sessions SET expires_at=? WHERE id=?').run(Date.now()-1,claims.sid);
  assert.equal((await refresh(cookieOf(login))).status,401);
  const legacy = jwt.sign({id:claims.id,role:'student'},process.env.JWT_SECRET,{expiresIn:'24h'});
  assert.equal((await request(app).get('/api/auth/me').set('Authorization',`Bearer ${legacy}`)).status,401);
});

test('rate limits: successful login does not consume failed-login allowance', async () => {
  await sessionUser('successful-logins');
  for (let i = 0; i < 22; i++) {
    const response = await request(app).post('/api/auth/login').send({email:'successful-logins@test.com',password:testUser.password});
    assert.equal(response.status,200);
  }
});
