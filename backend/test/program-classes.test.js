const { test, before, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const { app, db, waitForDb, cleanupTestDb } = require('./helpers');

let adminToken;
let instructorToken;
let studentToken;
let outsiderToken;
let instructorId;
let studentId;
let outsiderId;
let programId;
let otherProgramId;
let enrollmentId;
let otherEnrollmentId;
let classId;
let forumCategoryId;

before(async () => {
  await waitForDb();

  const adminId = uuidv4();
  instructorId = uuidv4();
  studentId = uuidv4();
  outsiderId = uuidv4();
  programId = uuidv4();
  otherProgramId = uuidv4();
  enrollmentId = uuidv4();
  otherEnrollmentId = uuidv4();

  await db.prepare('INSERT INTO users (id, name, email, password, role) VALUES (?,?,?,?,?)')
    .run(adminId, 'Class Admin', 'class-admin@test.com', bcrypt.hashSync('secret123', 10), 'admin');
  await db.prepare('INSERT INTO users (id, name, email, password, role) VALUES (?,?,?,?,?)')
    .run(instructorId, 'Class Instructor', 'class-instructor@test.com', bcrypt.hashSync('secret123', 10), 'instructor');
  await db.prepare('INSERT INTO users (id, name, email, password, role) VALUES (?,?,?,?,?)')
    .run(studentId, 'Class Student', 'class-student@test.com', bcrypt.hashSync('secret123', 10), 'student');
  await db.prepare('INSERT INTO users (id, name, email, password, role) VALUES (?,?,?,?,?)')
    .run(outsiderId, 'Outside Student', 'outside-student@test.com', bcrypt.hashSync('secret123', 10), 'student');
  await db.prepare('INSERT INTO programs (id, title, slug, description) VALUES (?,?,?,?)')
    .run(programId, 'Frontend Engineering', 'frontend-engineering', 'Frontend test programme');
  await db.prepare('INSERT INTO programs (id, title, slug, description) VALUES (?,?,?,?)')
    .run(otherProgramId, 'Backend Engineering', 'backend-engineering', 'Backend test programme');
  await db.prepare('INSERT INTO enrollments (id, student_id, program_id, session, status) VALUES (?,?,?,?,?)')
    .run(enrollmentId, studentId, programId, 'Morning', 'active');
  await db.prepare('INSERT INTO enrollments (id, student_id, program_id, session, status) VALUES (?,?,?,?,?)')
    .run(otherEnrollmentId, outsiderId, otherProgramId, 'Morning', 'active');
  await db.saveDb();

  const adminLogin = await request(app).post('/api/auth/login').send({ email: 'class-admin@test.com', password: 'secret123' });
  const instructorLogin = await request(app).post('/api/auth/login').send({ email: 'class-instructor@test.com', password: 'secret123' });
  const studentLogin = await request(app).post('/api/auth/login').send({ email: 'class-student@test.com', password: 'secret123' });
  const outsiderLogin = await request(app).post('/api/auth/login').send({ email: 'outside-student@test.com', password: 'secret123' });

  adminToken = adminLogin.body.token;
  instructorToken = instructorLogin.body.token;
  studentToken = studentLogin.body.token;
  outsiderToken = outsiderLogin.body.token;
});

after(() => { cleanupTestDb(); });

test('program classes: admin creates class with linked discussion forum', async () => {
  const created = await request(app)
    .post('/api/program-classes')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      program_id: programId,
      instructor_id: instructorId,
      name: 'Frontend Morning Cohort',
      code: 'fe morning 01',
      session: 'Morning',
      capacity: 20,
      status: 'active',
    });

  assert.strictEqual(created.status, 201);
  assert.strictEqual(created.body.code, 'FE-MORNING-01');
  assert.ok(created.body.forum_category_id);

  classId = created.body.id;
  forumCategoryId = created.body.forum_category_id;

  const forum = await db.prepare('SELECT * FROM forum_categories WHERE id = ?').get(forumCategoryId);
  assert.strictEqual(forum.class_id, classId);
  assert.strictEqual(forum.program_id, programId);
});

test('program classes: allocation enforces programme match and capacity', async () => {
  const crossProgram = await request(app)
    .post(`/api/program-classes/${classId}/allocate`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ enrollment_ids: [otherEnrollmentId] });

  assert.strictEqual(crossProgram.status, 400);
  assert.match(crossProgram.body.error, /same program/i);

  const allocated = await request(app)
    .post(`/api/program-classes/${classId}/allocate`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ enrollment_ids: [enrollmentId] });

  assert.strictEqual(allocated.status, 200);
  assert.strictEqual(allocated.body.class.allocated_count, 1);
});

test('program classes: instructor can message assigned class and student gets class target', async () => {
  const sent = await request(app)
    .post(`/api/program-classes/${classId}/message`)
    .set('Authorization', `Bearer ${instructorToken}`)
    .send({ content: 'Please prepare for the first class discussion.' });

  assert.strictEqual(sent.status, 201);
  assert.strictEqual(sent.body.sent, 1);

  const notifications = await request(app)
    .get('/api/notifications')
    .set('Authorization', `Bearer ${studentToken}`);

  assert.strictEqual(notifications.status, 200);
  const assigned = notifications.body.find((item) => item.type === 'class');
  assert.ok(assigned);
  assert.strictEqual(assigned.target_url, '/student/classes');
});

test('program classes: class forum visibility follows allocation', async () => {
  const allowed = await request(app)
    .get(`/api/forums/categories/${forumCategoryId}`)
    .set('Authorization', `Bearer ${studentToken}`);

  assert.strictEqual(allowed.status, 200);
  assert.strictEqual(allowed.body.id, forumCategoryId);

  const denied = await request(app)
    .get(`/api/forums/categories/${forumCategoryId}`)
    .set('Authorization', `Bearer ${outsiderToken}`);

  assert.strictEqual(denied.status, 403);
});
