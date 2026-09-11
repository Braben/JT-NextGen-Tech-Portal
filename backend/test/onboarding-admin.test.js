const { test, before, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const { app, db, waitForDb, cleanupTestDb } = require('./helpers');

let token;
let assessmentId;
let recommendEnrollmentId;
let recommendedAssessmentId;

before(async () => {
  await waitForDb();

  const adminId = uuidv4();
  const studentId = uuidv4();
  const programId = uuidv4();
  const enrollmentId = uuidv4();
  const recommendStudentId = uuidv4();
  assessmentId = uuidv4();
  recommendEnrollmentId = uuidv4();

  await db.prepare('INSERT INTO users (id, name, email, password, role, phone) VALUES (?,?,?,?,?,?)')
    .run(adminId, 'Admin Reviewer', 'onboarding-admin@test.com', bcrypt.hashSync('secret123', 10), 'admin', '');
  await db.prepare('INSERT INTO users (id, name, email, password, role, phone) VALUES (?,?,?,?,?,?)')
    .run(studentId, 'Applicant One', 'applicant@test.com', bcrypt.hashSync('secret123', 10), 'student', '+233 555 0101');
  await db.prepare(`
    INSERT INTO users (id, name, email, password, role, phone, date_of_birth, gender, education_level, computing_experience)
    VALUES (?,?,?,?,?,?,?,?,?,?)
  `).run(
    recommendStudentId,
    'Applicant Two',
    'applicant-two@test.com',
    bcrypt.hashSync('secret123', 10),
    'student',
    '+233 555 0102',
    '2005-02-02',
    'Male',
    'SHS Student',
    'No',
  );
  await db.prepare('INSERT INTO programs (id, title, slug, description) VALUES (?,?,?,?)')
    .run(programId, 'Web Design', 'web-design-admin-test', 'Build practical websites.');
  await db.prepare('INSERT INTO enrollments (id, student_id, program_id, session, status) VALUES (?,?,?,?,?)')
    .run(enrollmentId, studentId, programId, 'Morning', 'pending');
  await db.prepare('INSERT INTO enrollments (id, student_id, program_id, session, status) VALUES (?,?,?,?,?)')
    .run(recommendEnrollmentId, recommendStudentId, programId, 'Evening', 'pending');
  await db.prepare(`
    INSERT INTO onboarding_assessments (
      id, student_id, enrollment_id, date_of_birth, gender, education_level,
      computing_experience, strengths, greatest_strength, weaknesses,
      weakness_response, improvement_plan, status
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    assessmentId,
    studentId,
    enrollmentId,
    '2004-01-01',
    'Female',
    'SHS Graduate',
    'Yes',
    'Communication, teamwork, curiosity',
    'Persistence helps me complete difficult tasks.',
    'Time management, confidence, typing speed',
    'I improved by planning earlier and practicing daily.',
    'I use feedback, weekly practice, and reflection.',
    'submitted',
  );
  await db.saveDb();

  const login = await request(app)
    .post('/api/auth/login')
    .send({ email: 'onboarding-admin@test.com', password: 'secret123' });
  token = login.body.token;
});

after(() => { cleanupTestDb(); });

test('onboarding admin: lists submitted aptitude assessments', async () => {
  const res = await request(app)
    .get('/api/admin/onboarding-assessments')
    .set('Authorization', `Bearer ${token}`);

  assert.strictEqual(res.status, 200);
  assert.ok(res.body.some((row) => row.id === assessmentId && row.student_name === 'Applicant One'));
});

test('onboarding admin: grades an aptitude assessment', async () => {
  const res = await request(app)
    .put(`/api/admin/onboarding-assessments/${assessmentId}/grade`)
    .set('Authorization', `Bearer ${token}`)
    .send({ score: 82, max_score: 100, feedback: 'Strong readiness. Needs typing practice.', status: 'reviewed' });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.status, 'reviewed');
  assert.strictEqual(res.body.score, 82);
  assert.strictEqual(res.body.feedback, 'Strong readiness. Needs typing practice.');
  assert.ok(res.body.reviewed_at);
});

test('onboarding admin: recommends an aptitude assessment for an enrollment', async () => {
  const res = await request(app)
    .post('/api/admin/onboarding-assessments/recommend')
    .set('Authorization', `Bearer ${token}`)
    .send({ enrollment_id: recommendEnrollmentId });

  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.body.status, 'recommended');
  assert.strictEqual(res.body.enrollment_id, recommendEnrollmentId);
  assert.strictEqual(res.body.education_level, 'SHS Student');
  recommendedAssessmentId = res.body.id;
});

test('onboarding admin: cannot grade a recommended assessment before student submission', async () => {
  const res = await request(app)
    .put(`/api/admin/onboarding-assessments/${recommendedAssessmentId}/grade`)
    .set('Authorization', `Bearer ${token}`)
    .send({ score: 70, max_score: 100, feedback: '', status: 'reviewed' });

  assert.strictEqual(res.status, 400);
  assert.match(res.body.error, /not been submitted/i);
});

test('onboarding admin: rejects scores above maximum', async () => {
  const res = await request(app)
    .put(`/api/admin/onboarding-assessments/${assessmentId}/grade`)
    .set('Authorization', `Bearer ${token}`)
    .send({ score: 120, max_score: 100, feedback: '', status: 'reviewed' });

  assert.strictEqual(res.status, 400);
  assert.match(res.body.error, /cannot exceed/i);
});
