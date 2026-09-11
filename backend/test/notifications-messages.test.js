const { test, before, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const { app, db, waitForDb, cleanupTestDb } = require('./helpers');

let studentToken;
let instructorToken;
let adminToken;
let studentId;
let instructorId;
let adminId;

before(async () => {
  await waitForDb();

  studentId = uuidv4();
  instructorId = uuidv4();
  adminId = uuidv4();

  await db.prepare('INSERT INTO users (id, name, email, password, role) VALUES (?,?,?,?,?)')
    .run(studentId, 'Message Student', 'message-student@test.com', bcrypt.hashSync('secret123', 10), 'student');
  await db.prepare('INSERT INTO users (id, name, email, password, role) VALUES (?,?,?,?,?)')
    .run(instructorId, 'Message Instructor', 'message-instructor@test.com', bcrypt.hashSync('secret123', 10), 'instructor');
  await db.prepare('INSERT INTO users (id, name, email, password, role) VALUES (?,?,?,?,?)')
    .run(adminId, 'Message Admin', 'message-admin@test.com', bcrypt.hashSync('secret123', 10), 'admin');
  await db.saveDb();

  const studentLogin = await request(app)
    .post('/api/auth/login')
    .send({ email: 'message-student@test.com', password: 'secret123' });
  studentToken = studentLogin.body.token;

  const instructorLogin = await request(app)
    .post('/api/auth/login')
    .send({ email: 'message-instructor@test.com', password: 'secret123' });
  instructorToken = instructorLogin.body.token;

  const adminLogin = await request(app)
    .post('/api/auth/login')
    .send({ email: 'message-admin@test.com', password: 'secret123' });
  adminToken = adminLogin.body.token;
});

after(() => { cleanupTestDb(); });

test('messages: students and instructors can contact admins', async () => {
  for (const token of [studentToken, instructorToken]) {
    const response = await request(app).post(`/api/messages/${adminId}`)
      .set('Authorization', `Bearer ${token}`).send({ content: 'Admissions question' });
    assert.strictEqual(response.status, 200);
  }
});

test('messages: rejects self messages and oversized content', async () => {
  for (const [recipient, content] of [[studentId, 'Hello'], [adminId, 'a'.repeat(4001)]]) {
    const response = await request(app).post(`/api/messages/${recipient}`)
      .set('Authorization', `Bearer ${studentToken}`).send({ content });
    assert.strictEqual(response.status, 400);
  }
});

test('messages: conversations expose unread badge counts', async () => {
  const send = await request(app)
    .post(`/api/messages/${instructorId}`)
    .set('Authorization', `Bearer ${studentToken}`)
    .send({ content: 'Hello, please review my onboarding question.' });

  assert.strictEqual(send.status, 200);

  const conversations = await request(app)
    .get('/api/messages/conversations')
    .set('Authorization', `Bearer ${instructorToken}`);

  assert.strictEqual(conversations.status, 200);
  const row = conversations.body.find((item) => item.id === studentId);
  assert.ok(row);
  assert.strictEqual(row.unread, 1);
});

test('notifications: message notifications include safe target urls', async () => {
  const notifications = await request(app)
    .get('/api/notifications')
    .set('Authorization', `Bearer ${instructorToken}`);

  assert.strictEqual(notifications.status, 200);
  const messageNotification = notifications.body.find((item) => item.type === 'message');
  assert.ok(messageNotification);
  assert.strictEqual(messageNotification.target_url, `/messages/${studentId}`);
});

test('messages: opening a thread clears unread badge count', async () => {
  const thread = await request(app)
    .get(`/api/messages/${studentId}`)
    .set('Authorization', `Bearer ${instructorToken}`);

  assert.strictEqual(thread.status, 200);
  assert.ok(Array.isArray(thread.body.messages));

  const unreadCounts = await request(app)
    .get('/api/messages/conversations/unread-counts')
    .set('Authorization', `Bearer ${instructorToken}`);

  assert.strictEqual(unreadCounts.status, 200);
  assert.strictEqual(unreadCounts.body[studentId] || 0, 0);
  const bell = await request(app).get('/api/notifications/unread-count')
    .set('Authorization', `Bearer ${instructorToken}`);
  assert.strictEqual(Number(bell.body.count), 0);
});

test('announcements: admin broadcasts to selected audience with target urls', async () => {
  const broadcast = await request(app)
    .post('/api/admin/broadcasts')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      audience: 'students',
      title: 'Orientation Reminder',
      message: 'Please check your dashboard before orientation.',
      type: 'info',
    });

  assert.strictEqual(broadcast.status, 201);
  assert.strictEqual(broadcast.body.recipient_count, 1);

  const notifications = await request(app)
    .get('/api/notifications')
    .set('Authorization', `Bearer ${studentToken}`);

  assert.strictEqual(notifications.status, 200);
  const announcement = notifications.body.find((item) => item.type === 'announcement');
  assert.ok(announcement);
  assert.strictEqual(announcement.target_url, '/student/messages?tab=announcements');
});
