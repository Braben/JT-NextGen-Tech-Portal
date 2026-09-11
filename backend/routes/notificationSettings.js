/**
 * Notification Settings - Email/SMS preferences and log
 */


const express = require('express');
const db = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

router.get('/', authenticate, async (req, res, next) => {
  try {
    let settings = await db.prepare('SELECT * FROM notification_settings WHERE user_id = ?').get(req.user.id);
    if (!settings) {
      const id = uuidv4();
      await db.prepare('INSERT INTO notification_settings (id, user_id) VALUES (?, ?)').run(id, req.user.id);
      await db.saveDb();
      settings = await db.prepare('SELECT * FROM notification_settings WHERE user_id = ?').get(req.user.id);
    }
    res.json(settings);
  } catch (err) { next(err); }
});

router.put('/', authenticate, async (req, res, next) => {
  try {
    const { email_notifications, sms_notifications, phone, notify_assignment, notify_grade, notify_forum, notify_message, notify_attendance } = req.body;
    const existing = await db.prepare('SELECT id FROM notification_settings WHERE user_id = ?').get(req.user.id);
    if (!existing) {
      const id = uuidv4();
      await db.prepare('INSERT INTO notification_settings (id, user_id, email_notifications, sms_notifications, phone, notify_assignment, notify_grade, notify_forum, notify_message, notify_attendance) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(id, req.user.id, email_notifications ?? 1, sms_notifications ?? 0, phone || null, notify_assignment ?? 1, notify_grade ?? 1, notify_forum ?? 1, notify_message ?? 1, notify_attendance ?? 1);
    } else {
      await db.prepare('UPDATE notification_settings SET email_notifications=?, sms_notifications=?, phone=?, notify_assignment=?, notify_grade=?, notify_forum=?, notify_message=?, notify_attendance=? WHERE user_id=?')
        .run(email_notifications ?? 1, sms_notifications ?? 0, phone || null, notify_assignment ?? 1, notify_grade ?? 1, notify_forum ?? 1, notify_message ?? 1, notify_attendance ?? 1, req.user.id);
    }
    await db.saveDb();
    const updated = await db.prepare('SELECT * FROM notification_settings WHERE user_id = ?').get(req.user.id);
    res.json(updated);
  } catch (err) { next(err); }
});

router.get('/log', authenticate, async (req, res, next) => {
  try {
    const rows = await db.prepare('SELECT * FROM notification_log WHERE user_id = ? ORDER BY created_at DESC LIMIT 50').all(req.user.id);
    res.json(rows);
  } catch (err) { next(err); }
});

module.exports = router;


