const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');
const fs = require('node:fs');
const path = require('node:path');
const securityHeaders = require('../lib/securityHeaders');

test('CSP blocks executable injection and framing while allowing portal assets', async () => {
  const app = express();
  app.use(securityHeaders());
  app.get('/', (req,res) => res.send('<!doctype html><title>Portal</title>'));
  const response = await request(app).get('/');
  const policy = response.headers['content-security-policy'];
  for (const rule of ["script-src 'self'", "script-src-attr 'none'", "object-src 'none'", "frame-ancestors 'none'", "base-uri 'none'"]) {
    assert.ok(policy.split(';').includes(rule), rule);
  }
  assert.ok(!policy.includes('unsafe-eval'));
  assert.ok(policy.includes('wss://jt-nextgen-tech-portal.onrender.com'));
  assert.equal(response.headers['x-frame-options'], 'DENY');
  assert.equal(response.headers['x-content-type-options'], 'nosniff');
  const netlify = fs.readFileSync(path.join(__dirname, '../../netlify.toml'), 'utf8');
  const staticPolicy = netlify.match(/Content-Security-Policy = "([^"]+)"/)[1];
  const rules = s => s.split(';').map(x=>x.trim()).filter(x=>x && x !== 'upgrade-insecure-requests').sort();
  assert.deepEqual(rules(policy), rules(staticPolicy), 'Both hosting paths must enforce the same policy');
});
