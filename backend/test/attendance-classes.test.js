const { test, before, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const { app, db, waitForDb, cleanupTestDb } = require('./helpers');

let adminToken;
let instructorToken;
let classStudentToken;
let otherStudentToken;
let instructorId;
let classStudentId;
let otherStudentId;
let programId;
let classId;
let sessionId;

before(async () => {
  await waitForDb();

  const adminId = uuidv4();
  instructorId = uuidv4();
  classStudentId = uuidv4();
  otherStudentId = uuidv4();
  programId = uuidv4();
  classId = uuidv4();
  const classEnrollmentId = uuidv4();
  const otherEnrollmentId = uuidv4();

  await db.prepare('INSERT INTO users (id, name, email, password, role) VALUES (?,?,?,?,?)')
    .run(adminId, 'Attendance Admin', 'attendance-admin@test.com', bcrypt.hashSync('secret123', 10), 'admin');
  await db.prepare('INSERT INTO users (id, name, email, password, role) VALUES (?,?,?,?,?)')
    .run(instructorId, 'Attendance Instructor', 'attendance-instructor@test.com', bcrypt.hashSync('secret123', 10), 'instructor');
  await db.prepare('INSERT INTO users (id, name, email, password, role) VALUES (?,?,?,?,?)')
    .run(classStudentId, 'Roster Student', 'roster-student@test.com', bcrypt.hashSync('secret123', 10), 'student');
  await db.prepare('INSERT INTO users (id, name, email, password, role) VALUES (?,?,?,?,?)')
    .run(otherStudentId, 'Other Student', 'attendance-other@test.com', bcrypt.hashSync('secret123', 10), 'student');
  await db.prepare('INSERT INTO programs (id, title, slug, description) VALUES (?,?,?,?)')
    .run(programId, 'Attendance Programme', 'attendance-programme', 'Attendance test programme');
  await db.prepare('INSERT INTO program_classes (id, program_id, instructor_id, name, code, session, capacity, status) VALUES (?,?,?,?,?,?,?,?)')
    .run(classId, programId, instructorId, 'Attendance Class', 'ATT-01', 'Morning', 20, 'active');
  await db.prepare('INSERT INTO enrollments (id, student_id, program_id, class_id, session, status) VALUES (?,?,?,?,?,?)')
    .run(classEnrollmentId, classStudentId, programId, classId, 'Morning', 'active');
  await db.prepare('INSERT INTO enrollments (id, student_id, program_id, session, status) VALUES (?,?,?,?,?)')
    .run(otherEnrollmentId, otherStudentId, programId, 'Morning', 'active');
  await db.saveDb();

  const adminLogin = await request(app).post('/api/auth/login').send({ email: 'attendance-admin@test.com', password: 'secret123' });
  const instructorLogin = await request(app).post('/api/auth/login').send({ email: 'attendance-instructor@test.com', password: 'secret123' });
  const classStudentLogin = await request(app).post('/api/auth/login').send({ email: 'roster-student@test.com', password: 'secret123' });
  const otherStudentLogin = await request(app).post('/api/auth/login').send({ email: 'attendance-other@test.com', password: 'secret123' });

  adminToken = adminLogin.body.token;
  instructorToken = instructorLogin.body.token;
  classStudentToken = classStudentLogin.body.token;
  otherStudentToken = otherStudentLogin.body.token;
});

after(() => { cleanupTestDb(); });

test('attendance classes: instructor opens a class-scoped session', async () => {
  const opened = await request(app)
    .post('/api/attendance/sessions')
    .set('Authorization', `Bearer ${instructorToken}`)
    .send({
      program_id: programId,
      class_id: classId,
      date: new Date().toISOString().slice(0, 10),
      closes_at_minutes: 30,
      title: 'Class Roster Check',
    });

  assert.strictEqual(opened.status, 201);
  assert.strictEqual(opened.body.class_id, classId);
  assert.strictEqual(opened.body.class_name, 'Attendance Class');
  sessionId = opened.body.id;
});

test('attendance classes: only allocated students can see and self-mark class sessions', async () => {
  const visible = await request(app)
    .get('/api/attendance/sessions/active')
    .set('Authorization', `Bearer ${classStudentToken}`);

  assert.strictEqual(visible.status, 200);
  assert.ok(visible.body.some((item) => item.id === sessionId));

  const hidden = await request(app)
    .get('/api/attendance/sessions/active')
    .set('Authorization', `Bearer ${otherStudentToken}`);

  assert.strictEqual(hidden.status, 200);
  assert.ok(!hidden.body.some((item) => item.id === sessionId));

  const denied = await request(app)
    .post('/api/attendance/self-mark')
    .set('Authorization', `Bearer ${otherStudentToken}`)
    .send({ session_id: sessionId });

  assert.strictEqual(denied.status, 403);

  const marked = await request(app)
    .post('/api/attendance/self-mark')
    .set('Authorization', `Bearer ${classStudentToken}`)
    .send({ session_id: sessionId });

  assert.strictEqual(marked.status, 200);
  assert.ok(['present', 'late'].includes(marked.body.status));
});

test('attendance classes: close auto-marks only unmarked class roster students', async () => {
  const secondStudentId = uuidv4();
  const secondEnrollmentId = uuidv4();
  await db.prepare('INSERT INTO users (id, name, email, password, role) VALUES (?,?,?,?,?)')
    .run(secondStudentId, 'Second Roster Student', 'second-roster@test.com', bcrypt.hashSync('secret123', 10), 'student');
  await db.prepare('INSERT INTO enrollments (id, student_id, program_id, class_id, session, status) VALUES (?,?,?,?,?,?)')
    .run(secondEnrollmentId, secondStudentId, programId, classId, 'Morning', 'active');
  await db.saveDb();

  const close = await request(app)
    .post(`/api/attendance/sessions/${sessionId}/close`)
    .set('Authorization', `Bearer ${adminToken}`);

  assert.strictEqual(close.status, 200);
  assert.strictEqual(close.body.auto_marked, 1);

  const otherRecord = await db.prepare('SELECT id FROM attendance WHERE session_id = ? AND student_id = ?').get(sessionId, otherStudentId);
  assert.strictEqual(otherRecord, undefined);
});
