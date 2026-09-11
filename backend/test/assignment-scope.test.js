const { test, before, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const { app, db, waitForDb, cleanupTestDb } = require('./helpers');

let ids;
let tokens;

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

  const instructor = await createUser('instructor', 'assignment-instructor@test.com');
  const classStudent = await createUser('student', 'assignment-class-student@test.com');
  const programStudent = await createUser('student', 'assignment-program-student@test.com');
  const otherStudent = await createUser('student', 'assignment-other-student@test.com');

  const programId = uuidv4();
  const otherProgramId = uuidv4();
  const classId = uuidv4();

  await db.prepare('INSERT INTO programs (id, title, slug, description) VALUES (?,?,?,?)')
    .run(programId, 'Scoped Assignment Program', 'scoped-assignment-program', 'Program for assignment scope tests');
  await db.prepare('INSERT INTO programs (id, title, slug, description) VALUES (?,?,?,?)')
    .run(otherProgramId, 'Other Assignment Program', 'other-assignment-program', 'Other program');
  await db.prepare('INSERT INTO program_classes (id, program_id, instructor_id, name, code, status) VALUES (?,?,?,?,?,?)')
    .run(classId, programId, instructor.id, 'Morning A', 'MORNING-A', 'active');
  await db.prepare('INSERT INTO enrollments (id, student_id, program_id, class_id, status) VALUES (?,?,?,?,?)')
    .run(uuidv4(), classStudent.id, programId, classId, 'active');
  await db.prepare('INSERT INTO enrollments (id, student_id, program_id, status) VALUES (?,?,?,?)')
    .run(uuidv4(), programStudent.id, programId, 'active');
  await db.prepare('INSERT INTO enrollments (id, student_id, program_id, status) VALUES (?,?,?,?)')
    .run(uuidv4(), otherStudent.id, otherProgramId, 'active');
  await db.saveDb();

  ids = { programId, classId, classStudent: classStudent.id, programStudent: programStudent.id, otherStudent: otherStudent.id };
  tokens = { instructor: instructor.token, classStudent: classStudent.token, programStudent: programStudent.token, otherStudent: otherStudent.token };
});

after(() => { cleanupTestDb(); });

test('assignments: class-scoped work is visible and notified only to the class roster', async () => {
  const created = await request(app)
    .post('/api/assignments')
    .set('Authorization', `Bearer ${tokens.instructor}`)
    .send({
      title: 'Class-only project',
      description: 'Visible to one class',
      program_id: ids.programId,
      class_id: ids.classId,
      max_score: 100,
    });

  assert.strictEqual(created.status, 201);

  const [classList, programList, otherList] = await Promise.all([
    request(app).get('/api/assignments').set('Authorization', `Bearer ${tokens.classStudent}`),
    request(app).get('/api/assignments').set('Authorization', `Bearer ${tokens.programStudent}`),
    request(app).get('/api/assignments').set('Authorization', `Bearer ${tokens.otherStudent}`),
  ]);

  assert.strictEqual(classList.body.some((item) => item.id === created.body.id), true);
  assert.strictEqual(programList.body.some((item) => item.id === created.body.id), false);
  assert.strictEqual(otherList.body.some((item) => item.id === created.body.id), false);

  const notifiedClassStudent = await db.prepare('SELECT id FROM notifications WHERE user_id = ? AND related_id = ?').get(ids.classStudent, created.body.id);
  const notifiedProgramStudent = await db.prepare('SELECT id FROM notifications WHERE user_id = ? AND related_id = ?').get(ids.programStudent, created.body.id);
  assert.ok(notifiedClassStudent);
  assert.strictEqual(notifiedProgramStudent, undefined);
});

test('assignments: program-scoped work allows active programme students and blocks outsiders', async () => {
  const created = await request(app)
    .post('/api/assignments')
    .set('Authorization', `Bearer ${tokens.instructor}`)
    .send({
      title: 'Programme project',
      description: 'Visible to active programme students',
      program_id: ids.programId,
      max_score: 100,
    });

  assert.strictEqual(created.status, 201);

  const allowed = await request(app)
    .post('/api/submissions')
    .set('Authorization', `Bearer ${tokens.programStudent}`)
    .send({ assignment_id: created.body.id, content: 'My work' });
  assert.strictEqual(allowed.status, 201);

  const blocked = await request(app)
    .post('/api/submissions')
    .set('Authorization', `Bearer ${tokens.otherStudent}`)
    .send({ assignment_id: created.body.id, content: 'Out of scope' });
  assert.strictEqual(blocked.status, 403);
});
