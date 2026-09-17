/**
 * Events - Calendar event CRUD with date-range filtering
 */


const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { authenticate } = require('../middleware/auth');
const db = require('../config/db');
const { cacheMiddleware, invalidate } = require('../middleware/cache');
const { instructorProgramIds, isAdmin, isInstructor, isStudent } = require('../lib/accessControl');
const { trimString } = require('../lib/validators');
const eventInput = require('../lib/eventInput');
const audit = require('../services/audit');

/** Public endpoint — upcoming public events for the landing page (no auth). */
router.get('/public', cacheMiddleware(60), async (req, res, next) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const rows = await db.prepare(`
      SELECT e.*, p.title AS program_name
      FROM events e
      LEFT JOIN programs p ON e.program_id = p.id
      WHERE e.is_public = 1 AND e.event_date >= ?
      ORDER BY e.event_date ASC
      LIMIT 10
    `).all(today);
    res.json(rows);
  } catch (e) { next(e); }
});

router.get('/', authenticate, async (req, res, next) => {
  try {
    const { program_id, month, year, start_date, end_date } = req.query;
    let rows;
    if (isAdmin(req.user)) {
      rows = program_id
        ? await db.prepare('SELECT e.*, p.title AS program_name FROM events e LEFT JOIN programs p ON e.program_id = p.id WHERE e.program_id = ? ORDER BY e.event_date ASC').all(program_id)
        : await db.prepare('SELECT e.*, p.title AS program_name FROM events e LEFT JOIN programs p ON e.program_id = p.id ORDER BY e.event_date ASC').all();
    } else if (isInstructor(req.user)) {
      const programIds = await instructorProgramIds(db, req.user);
      const scope = programIds.length ? ` OR e.program_id IN (${programIds.map(() => '?').join(',')})` : '';
      const params = [req.user.id, ...programIds];
      rows = program_id
        ? await db.prepare(`SELECT e.*, p.title AS program_name FROM events e LEFT JOIN programs p ON e.program_id = p.id WHERE e.program_id = ? AND (e.created_by = ?${scope}) ORDER BY e.event_date ASC`).all(program_id, ...params)
        : await db.prepare(`SELECT e.*, p.title AS program_name FROM events e LEFT JOIN programs p ON e.program_id = p.id WHERE e.created_by = ?${scope} ORDER BY e.event_date ASC`).all(...params);
    } else if (isStudent(req.user)) {
      const enrolledRows = await db.prepare("SELECT program_id FROM enrollments WHERE student_id = ? AND status = 'active'").all(req.user.id);
      const enrolled = enrolledRows.map(r => r.program_id);
      if (!enrolled.length) return res.json([]);
      const placeholders = enrolled.map(() => '?').join(',');
      rows = await db.prepare(`SELECT e.*, p.title AS program_name FROM events e LEFT JOIN programs p ON e.program_id = p.id WHERE e.program_id IN (${placeholders}) ORDER BY e.event_date ASC`).all(...enrolled);
    } else {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    if (month && year) {
      rows = rows.filter(r => {
        const d = new Date(r.event_date);
        return d.getMonth() === parseInt(month) && d.getFullYear() === parseInt(year);
      });
    }
    if (start_date && end_date) {
      rows = rows.filter(r => r.event_date >= start_date && r.event_date <= end_date);
    }
    res.json(rows);
  } catch (e) { next(e); }
});

router.post('/', authenticate, async (req, res, next) => {
  try {
    if (!isInstructor(req.user) && !isAdmin(req.user)) return res.status(403).json({ error: 'Unauthorized' });
    const { program_id, title, description, event_date, start_time, end_time, type, is_public } = await eventInput(req.body, req.user);
    if (!title || !event_date) return res.status(400).json({ error: 'Title and date required' });
    const id = uuidv4();
    await db.prepare('INSERT INTO events (id, program_id, title, description, event_date, start_time, end_time, type, is_public, created_by) VALUES (?,?,?,?,?,?,?,?,?,?)').run(id, program_id || null, trimString(title, 200), trimString(description, 1000), event_date, start_time || '', end_time || '', type || 'other', isAdmin(req.user) && is_public ? 1 : 0, req.user.id);
    await db.saveDb();
    invalidate('/api/events');
    await audit(req.user, 'create', 'event', id, `Created event ${title}`);
    const row = await db.prepare('SELECT e.*, p.title AS program_name FROM events e LEFT JOIN programs p ON e.program_id = p.id WHERE e.id = ?').get(id);
    res.json(row);
  } catch (e) { next(e); }
});

router.put('/:id', authenticate, async (req, res, next) => {
  try {
    const ev = await db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
    if (!ev) return res.status(404).json({ error: 'Event not found' });
    if (!isAdmin(req.user) && (!isInstructor(req.user) || ev.created_by !== req.user.id)) return res.status(403).json({ error: 'Unauthorized' });
    const { program_id, title, description, event_date, start_time, end_time, type, is_public } = await eventInput(req.body, req.user, ev);
    await db.prepare('UPDATE events SET program_id=?, title=COALESCE(?,title), description=COALESCE(?,description), event_date=COALESCE(?,event_date), start_time=COALESCE(?,start_time), end_time=COALESCE(?,end_time), type=COALESCE(?,type), is_public=? WHERE id=?')
      .run(
        program_id,
        title !== undefined ? trimString(title, 200) : undefined,
        description !== undefined ? trimString(description, 1000) : undefined,
        event_date,
        start_time,
        end_time,
        type,
        isAdmin(req.user) && is_public !== undefined ? (is_public ? 1 : 0) : ev.is_public,
        req.params.id
      );
    await db.saveDb();
    invalidate('/api/events');
    await audit(req.user, 'update', 'event', req.params.id, `Updated event ${title}`);
    const row = await db.prepare('SELECT e.*, p.title AS program_name FROM events e LEFT JOIN programs p ON e.program_id = p.id WHERE e.id = ?').get(req.params.id);
    res.json(row);
  } catch (e) { next(e); }
});

router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const ev = await db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
    if (!ev) return res.status(404).json({ error: 'Event not found' });
    if (!isAdmin(req.user) && (!isInstructor(req.user) || ev.created_by !== req.user.id)) return res.status(403).json({ error: 'Unauthorized' });
    await db.prepare('DELETE FROM events WHERE id = ?').run(req.params.id);
    await db.saveDb();
    invalidate('/api/events');
    res.json({ message: 'Event deleted' });
  } catch (e) { next(e); }
});

module.exports = router;
