const { test, before, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const { app, db, waitForDb, cleanupTestDb } = require('./helpers');
const { ACTIONS, canPerform } = require('../lib/accessControl');

let tokens;
let ids;

async function createUser(role, email) {
  const id = uuidv4();
  await db.prepare('INSERT INTO users (id, name, email, password, role) VALUES (?,?,?,?,?)')
    .run(id, `${role} ${email}`, email, bcrypt.hashSync('secret123', 10), role);
  await db.prepare('INSERT INTO notification_settings (id, user_id) VALUES (?, ?)').run(uuidv4(), id);
  const login = await request(app).post('/api/auth/login').send({ email, password: 'secret123' });
  return { id, token: login.body.token };
}

before(async () => {
  await waitForDb();

  const admin = await createUser('admin', 'admin-security@test.com');
  const instructor = await createUser('instructor', 'instructor-security@test.com');
  const otherInstructor = await createUser('instructor', 'other-instructor-security@test.com');
  const student = await createUser('student', 'student-security@test.com');
  const otherStudent = await createUser('student', 'other-student-security@test.com');

  const programId = uuidv4();
  const enrollmentId = uuidv4();
  const assignmentId = uuidv4();
  const submissionId = uuidv4();
  const paymentId = uuidv4();
  const certificateId = uuidv4();

  await db.prepare('INSERT INTO programs (id, title, slug, description) VALUES (?,?,?,?)')
    .run(programId, 'Security Program', 'security-program', 'Security test program');
  await db.prepare('INSERT INTO enrollments (id, student_id, program_id, status) VALUES (?,?,?,?)')
    .run(enrollmentId, student.id, programId, 'active');
  await db.prepare('INSERT INTO assignments (id, instructor_id, title, description, max_score) VALUES (?,?,?,?,?)')
    .run(assignmentId, instructor.id, 'Private Assignment', 'Should be scoped', 100);
  await db.prepare('INSERT INTO submissions (id, assignment_id, student_id, content, status) VALUES (?,?,?,?,?)')
    .run(submissionId, assignmentId, student.id, 'Private answer', 'submitted');
  await db.prepare('INSERT INTO payments (id, student_id, enrollment_id, amount, paid_amount, status) VALUES (?,?,?,?,?,?)')
    .run(paymentId, student.id, enrollmentId, 100, 0, 'pending');
  await db.prepare('INSERT INTO certificates (id, serial_number, student_id, program_id, status) VALUES (?,?,?,?,?)')
    .run(certificateId, 'JTNG-SECURE', student.id, programId, 'valid');
  await db.saveDb();

  tokens = {
    admin: admin.token,
    instructor: instructor.token,
    otherInstructor: otherInstructor.token,
    student: student.token,
    otherStudent: otherStudent.token,
  };
  ids = { assignmentId, submissionId, paymentId, enrollmentId };
});

after(() => { cleanupTestDb(); });

test('security: login attempts accepts limit=500 and counts only recent failures', async () => {
  const stamp = (hours) => new Date(Date.now() - hours * 3600000).toISOString().slice(0, 19).replace('T', ' ');
  const baseline = await request(app).get('/api/admin/security/login-attempts?limit=500')
    .set('Authorization', `Bearer ${tokens.admin}`);
  assert.strictEqual(baseline.status, 200);
  for (const [success, hours] of [[0, 0.1], [0, 2], [1, 0.1]]) {
    await db.prepare('INSERT INTO login_attempts (id, email, success, created_at) VALUES (?,?,?,?)')
      .run(uuidv4(), 'security-count@test.com', success, stamp(hours));
  }
  const response = await request(app).get('/api/admin/security/login-attempts?limit=500')
    .set('Authorization', `Bearer ${tokens.admin}`);
  assert.strictEqual(response.status, 200);
  assert.ok(Array.isArray(response.body.attempts));
  assert.strictEqual(response.body.failedLastHour, baseline.body.failedLastHour + 1);
  const denied = await request(app).get('/api/admin/security/login-attempts?limit=500')
    .set('Authorization', `Bearer ${tokens.student}`);
  assert.strictEqual(denied.status, 403);
});

test('submissions: students cannot view another student submission', async () => {
  const res = await request(app)
    .get(`/api/submissions/${ids.submissionId}`)
    .set('Authorization', `Bearer ${tokens.otherStudent}`);
  assert.strictEqual(res.status, 403);
});

test('grading: instructors cannot grade submissions they do not own', async () => {
  const res = await request(app)
    .put(`/api/grading/manual/${ids.submissionId}`)
    .set('Authorization', `Bearer ${tokens.otherInstructor}`)
    .send({ score: 80, feedback: 'Nope' });
  assert.strictEqual(res.status, 403);
});

test('payments: students cannot self-record invoice payments', async () => {
  const res = await request(app)
    .put(`/api/payments/${ids.paymentId}/pay`)
    .set('Authorization', `Bearer ${tokens.student}`)
    .send({ amount: 100 });
  assert.strictEqual(res.status, 403);
});

test('policy: central matrix allows owners and rejects unrelated users', async () => {
  const submission = await db.prepare(`
    SELECT s.*, a.instructor_id
    FROM submissions s
    JOIN assignments a ON a.id = s.assignment_id
    WHERE s.id = ?
  `).get(ids.submissionId);
  const enrollment = await db.prepare('SELECT * FROM enrollments WHERE id = ?').get(ids.enrollmentId);

  assert.strictEqual(await canPerform(db, { id: submission.student_id, role: 'student' }, ACTIONS.VIEW_SUBMISSION, submission), true);
  assert.strictEqual(await canPerform(db, { id: 'unrelated-student', role: 'student' }, ACTIONS.VIEW_SUBMISSION, submission), false);
  assert.strictEqual(await canPerform(db, { id: submission.instructor_id, role: 'instructor' }, ACTIONS.GRADE_SUBMISSION, submission), true);
  assert.strictEqual(await canPerform(db, { id: 'unrelated-instructor', role: 'instructor' }, ACTIONS.GRADE_SUBMISSION, submission), false);
  assert.strictEqual(await canPerform(db, { id: 'admin-id', role: 'admin' }, ACTIONS.MANAGE_ENROLLMENT, enrollment), true);
});

test('audit: payment writes persist actor role and action metadata', async () => {
  const res = await request(app)
    .put(`/api/payments/${ids.paymentId}/pay`)
    .set('Authorization', `Bearer ${tokens.admin}`)
    .send({ amount: 25 });

  assert.strictEqual(res.status, 200);
  const auditRow = await db.prepare(`
    SELECT action, entity_type, entity_id, actor_role
    FROM admin_audit_log
    WHERE entity_id = ? AND action = 'payment.record'
  `).get(ids.paymentId);
  assert.strictEqual(auditRow.entity_type, 'payment');
  assert.strictEqual(auditRow.actor_role, 'admin');
});

test('certificates: public verification returns safe certificate fields', async () => {
  const res = await request(app).get('/api/certificates/verify/JTNG-SECURE');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.serial_number, 'JTNG-SECURE');
  assert.strictEqual(res.body.program_title, 'Security Program');
  assert.strictEqual(res.body.student_id, undefined);
});

test('rate limits: users sharing an IP have separate signed-user quotas', async () => {
  const express = require('express');
  const limits = require('../lib/rateLimits');
  const sample = express();
  sample.use(limits.scoped(2));
  sample.get('/', (req,res) => res.json({ok:true}));
  const call = token => request(sample).get('/').set('Authorization', `Bearer ${token}`);
  assert.equal((await call(tokens.admin)).status,200);
  assert.equal((await call(tokens.admin)).status,200);
  const blocked = await call(tokens.admin);
  assert.equal(blocked.status,429);
  assert.ok(Number(blocked.headers['retry-after']) > 0);
  assert.equal((await call(tokens.student)).status,200);
});
