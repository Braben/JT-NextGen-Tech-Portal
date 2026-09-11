/**
 * Programs - Course catalog with public and admin CRUD
 */


const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const { cacheMiddleware, invalidate } = require('../middleware/cache');

const router = express.Router();

// Validate both create and partial update payloads before database writes.
router.use(async (req, res, next) => {
  if (!['POST', 'PUT'].includes(req.method)) return next();
  const errors = {};
  for (const key of ['title', 'slug', 'description', 'duration', 'level', 'audience', 'icon']) {
    if (req.body[key] !== undefined) {
      if (typeof req.body[key] !== 'string') errors[key] = 'Must be text';
      else req.body[key] = req.body[key].trim();
    }
  }
  for (const key of ['title', 'slug', 'description']) {
    if ((req.method === 'POST' || req.body[key] !== undefined) && !req.body[key]) errors[key] = 'Required';
  }
  if (typeof req.body.slug === 'string') {
    req.body.slug = req.body.slug.toLowerCase();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(req.body.slug)) errors.slug = 'Use lowercase words separated by hyphens';
  }
  if (req.body.outcomes !== undefined && (!Array.isArray(req.body.outcomes) || req.body.outcomes.some(value => typeof value !== 'string'))) errors.outcomes = 'Must be a list of text outcomes';
  if (Object.keys(errors).length) return res.status(400).json({ error: 'Please check the programme fields', fieldErrors: errors });
  next();
});

router.get('/', cacheMiddleware(60), async (req, res, next) => {
  try {
    const rows = await db.prepare('SELECT * FROM programs ORDER BY created_at ASC').all();
    rows.forEach((r) => {
      try { r.outcomes = JSON.parse(r.outcomes || '[]'); } catch { r.outcomes = []; }
    });
    res.json(rows);
  } catch (err) { next(err); }
});

router.get('/:slug', cacheMiddleware(60), async (req, res, next) => {
  try {
    const program = await db.prepare('SELECT * FROM programs WHERE slug = ?').get(req.params.slug);
    if (!program) return res.status(404).json({ error: 'Program not found' });
    try { program.outcomes = JSON.parse(program.outcomes || '[]'); } catch { program.outcomes = []; }
    res.json(program);
  } catch (err) { next(err); }
});

router.post('/', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const { title, slug, description, duration, level, audience, outcomes, icon } = req.body;
    if (!title || !slug || !description) return res.status(400).json({ error: 'Title, slug, and description required' });
    const id = uuidv4();
    if (await db.prepare('SELECT id FROM programs WHERE slug = ?').get(slug)) return res.status(409).json({ error: 'A programme already uses this slug. Choose another.' });
    await db.prepare('INSERT INTO programs (id, title, slug, description, duration, level, audience, outcomes, icon) VALUES (?,?,?,?,?,?,?,?,?)')
      .run(id, title, slug, description, duration || '3 Months', level || 'Beginner', audience || '', JSON.stringify(outcomes || []), icon || '');
    invalidate('/api/programs');
    await db.saveDb();
    res.status(201).json(await db.prepare('SELECT * FROM programs WHERE id = ?').get(id));
  } catch (err) { next(err); }
});

router.put('/:id', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const existing = await db.prepare('SELECT * FROM programs WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Program not found' });
    const { title, slug, description, duration, level, audience, outcomes, icon } = req.body;
    const duplicate = slug && await db.prepare('SELECT id FROM programs WHERE slug = ? AND id <> ?').get(slug, req.params.id);
    if (duplicate) return res.status(409).json({ error: 'A programme already uses this slug. Choose another.' });
    await db.prepare('UPDATE programs SET title=?, slug=?, description=?, duration=?, level=?, audience=?, outcomes=?, icon=? WHERE id=?')
      .run(title || existing.title, slug || existing.slug, description || existing.description,
        duration ?? existing.duration, level ?? existing.level, audience ?? existing.audience,
        outcomes !== undefined ? JSON.stringify(outcomes) : existing.outcomes, icon !== undefined ? icon : existing.icon, req.params.id);
    await db.saveDb();
    invalidate('/api/programs');
    res.json(await db.prepare('SELECT * FROM programs WHERE id = ?').get(req.params.id));
  } catch (err) { next(err); }
});

router.delete('/:id', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    if (!await db.prepare('SELECT id FROM programs WHERE id = ?').get(req.params.id)) return res.status(404).json({ error: 'Program not found' });
    // Preserve linked learning records instead of leaving orphaned data.
    for (const table of ['enrollments', 'program_classes', 'assignments', 'materials', 'quizzes', 'certificates', 'events', 'attendance_sessions', 'attendance', 'forum_categories']) {
      if (await db.prepare(`SELECT id FROM ${table} WHERE program_id = ? LIMIT 1`).get(req.params.id)) return res.status(409).json({ error: 'This programme has linked classes or learning records and cannot be deleted.' });
    }
    await db.prepare('DELETE FROM programs WHERE id = ?').run(req.params.id);
    await db.saveDb();
    invalidate('/api/programs');
    res.json({ message: 'Program deleted' });
  } catch (err) { next(err); }
});

module.exports = router;

