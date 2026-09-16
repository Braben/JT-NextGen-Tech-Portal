const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { v4: uuid } = require('uuid');
const { app, db, waitForDb, cleanupTestDb } = require('./helpers');

let adminToken;
let instructorToken;
const programA = uuid();
const programB = uuid();
const morning = uuid();
const evening = uuid();
const closed = uuid();

async function user(role = 'student') {
  const id = uuid();
  await db.prepare('INSERT INTO users (id, name, email, password, role) VALUES (?,?,?,?,?)')
    .run(id, 'Placement Test', `${id}@test.com`, 'unused', role);
  return { id, role, name: 'Placement Test' };
}
async function enrollment() {
  const student = await user();
  const id = uuid();
  await db.prepare('INSERT INTO enrollments (id, student_id, program_id, class_id, session, status) VALUES (?,?,?,?,?,?)')
    .run(id, student.id, programA, morning, 'Morning', 'active');
  return { id, student };
}
const update = (id, data, token = adminToken) => request(app).put(`/api/enrollments/${id}`).set('Authorization', `Bearer ${token}`).send(data);

before(async () => {
  await waitForDb();
  adminToken = jwt.sign(await user('admin'), process.env.JWT_SECRET);
  instructorToken = jwt.sign(await user('instructor'), process.env.JWT_SECRET);
  for (const id of [programA, programB]) {
    await db.prepare('INSERT INTO programs (id, title, slug, description) VALUES (?,?,?,?)').run(id, id, id, 'Test program');
  }
  for (const [id, program, session, status] of [[morning, programA, 'Morning', 'active'], [evening, programB, 'Evening', 'active'], [closed, programB, 'Evening', 'archived']]) {
    await db.prepare('INSERT INTO program_classes (id, program_id, name, code, session, capacity, status) VALUES (?,?,?,?,?,?,?)')
      .run(id, program, id, id, session, 100, status);
  }
});
after(cleanupTestDb);

test('admin changes program, class and session together and student sees the new placement', async () => {
  const { id, student } = await enrollment();
  const res = await update(id, { program_id: programB, class_id: evening, session: 'Evening' });
  assert.equal(res.status, 200);
  assert.equal(res.body.program_id, programB);
  assert.equal(res.body.class_id, evening);
  assert.equal(res.body.session, 'Evening');
  assert.equal(res.body.status, 'active');
  const visible = await request(app).get('/api/enrollments').set('Authorization', `Bearer ${jwt.sign(student, process.env.JWT_SECRET)}`);
  assert.equal(visible.body[0].class_name, evening);
  const audit = await db.prepare("SELECT * FROM admin_audit_log WHERE entity_id = ? AND action = 'enrollment.placement'").get(id);
  assert.equal(JSON.parse(audit.details).before.program_id, programA);
});

test('program and session changes clear incompatible old classes; admins can explicitly unallocate', async () => {
  const { id } = await enrollment();
  const changed = await update(id, { program_id: programB });
  assert.equal(changed.status, 200);
  assert.equal(changed.body.class_id, null);
  const assigned = await update(id, { class_id: evening });
  assert.equal(assigned.body.session, 'Evening');
  const sessionOnly = await update(id, { session: 'Morning' });
  assert.equal(sessionOnly.body.class_id, null);
  const unallocated = await update(id, { class_id: null });
  assert.equal(unallocated.status, 200);
  assert.equal(unallocated.body.class_id, null);
});

test('invalid programs, sessions and mismatched classes do not modify enrollment', async () => {
  const { id } = await enrollment();
  for (const data of [{ program_id: 'missing' }, { program_id: null }, { session: 'Weekend' }, { class_id: evening }, { program_id: programB, class_id: evening, session: 'Morning' }, { class_id: {} }]) {
    const res = await update(id, data);
    assert.equal(res.status, 400, JSON.stringify(data));
    const row = await db.prepare('SELECT * FROM enrollments WHERE id = ?').get(id);
    assert.equal(row.program_id, programA);
    assert.equal(row.class_id, morning);
  }
});

test('duplicate enrollment, full class and archived class are rejected', async () => {
  const { id, student } = await enrollment();
  const duplicateId = uuid();
  await db.prepare('INSERT INTO enrollments (id, student_id, program_id) VALUES (?,?,?)').run(duplicateId, student.id, programB);
  assert.equal((await update(id, { program_id: programB })).status, 409);
  const another = await enrollment();
  assert.equal((await update(another.id, { program_id: programB, class_id: closed })).status, 400);
  const full = uuid();
  await db.prepare('INSERT INTO program_classes (id, program_id, name, code, session, capacity, status) VALUES (?,?,?,?,?,?,?)')
    .run(full, programB, 'Full', full, 'Evening', 1, 'active');
  await db.prepare('UPDATE enrollments SET class_id = ?, session = ? WHERE id = ?').run(full, 'Evening', duplicateId);
  assert.equal((await update(another.id, { program_id: programB, class_id: full })).status, 409);
});

test('students and instructors cannot change enrollment placement', async () => {
  const { id, student } = await enrollment();
  assert.equal((await update(id, { session: 'Evening' }, jwt.sign(student, process.env.JWT_SECRET))).status, 403);
  assert.equal((await update(id, { program_id: programB }, instructorToken)).status, 403);
  assert.equal((await request(app).put(`/api/enrollments/${id}`).send({ session: 'Evening' })).status, 401);
});

test('status-only edits retain placement and completed enrollment cannot enter a new class', async () => {
  const { id } = await enrollment();
  const result = await update(id, { status: 'completed' });
  assert.equal(result.status, 200);
  assert.equal(result.body.class_id, morning);
  assert.equal((await update(id, { program_id: programB, class_id: evening })).status, 400);
});
