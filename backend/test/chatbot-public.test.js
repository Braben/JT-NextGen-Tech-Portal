process.env.OPENROUTER_API_KEY = '';

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const { v4: uuidv4 } = require('uuid');

const { app, db, waitForDb, cleanupTestDb } = require('./helpers');

before(async () => {
  await waitForDb();

  await db.prepare(`
    INSERT INTO programs (id, title, slug, description, duration, level, audience, outcomes)
    VALUES (?,?,?,?,?,?,?,?)
  `).run(
    uuidv4(),
    'Frontend Foundations',
    'frontend-foundations',
    'Learn HTML, CSS, JavaScript, responsive design, and deployment through practical website projects.',
    '3 Months',
    'Beginner',
    'Beginners, students, and job seekers',
    JSON.stringify(['Responsive websites', 'JavaScript fundamentals', 'Portfolio project']),
  );
  await db.saveDb();
});

after(() => { cleanupTestDb(); });

test('chatbot public: answers landing page questions without auth', async () => {
  const res = await request(app)
    .post('/api/chatbot/ask-public')
    .send({ question: 'Where is JT NextGen located?' });

  assert.strictEqual(res.status, 200);
  assert.match(res.body.answer, /Kpongunor/i);
  assert.strictEqual(res.body.model, 'local-retrieval');
  assert.ok(res.body.sources.some((source) => source.source === 'contact'));
});

test('chatbot public: retrieves matching program context', async () => {
  const res = await request(app)
    .post('/api/chatbot/ask-public')
    .send({ question: 'Do you have a beginner frontend website program?' });

  assert.strictEqual(res.status, 200);
  assert.match(res.body.answer, /Frontend Foundations/i);
  assert.ok(res.body.sources.some((source) => source.title === 'Frontend Foundations'));
});

test('chatbot public: validates empty questions', async () => {
  const res = await request(app)
    .post('/api/chatbot/ask-public')
    .send({ question: '   ' });

  assert.strictEqual(res.status, 400);
});
