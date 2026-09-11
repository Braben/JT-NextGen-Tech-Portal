const { test, before, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');

const { app, db, waitForDb, cleanupTestDb } = require('./helpers');

before(async () => { await waitForDb(); });
after(() => { cleanupTestDb(); });

test('contacts: rejects malformed public form submissions', async () => {
  const res = await request(app)
    .post('/api/admin/contacts')
    .send({ name: 'Ada', email: 'not-an-email', message: 'Hello' });

  assert.strictEqual(res.status, 400);
  assert.match(res.body.error, /valid email/i);
});

test('contacts: trims and normalizes public form submissions', async () => {
  const res = await request(app)
    .post('/api/admin/contacts')
    .send({
      name: '  Ada Lovelace  ',
      email: '  ADA@Example.COM  ',
      phone: '  +233 555 0101  ',
      message: '  I want to join the next cohort.  ',
    });

  assert.strictEqual(res.status, 201);

  // The public form should store clean data, not raw browser input.
  const row = await db.prepare('SELECT name, email, phone, message FROM contacts WHERE email = ?').get('ada@example.com');
  assert.strictEqual(row.name, 'Ada Lovelace');
  assert.strictEqual(row.email, 'ada@example.com');
  assert.strictEqual(row.phone, '+233 555 0101');
  assert.strictEqual(row.message, 'I want to join the next cohort.');
});
