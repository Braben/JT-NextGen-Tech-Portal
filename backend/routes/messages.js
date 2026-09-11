/**
 * Messages - Direct messaging between users
 */


const express = require('express');
const db = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');
const { trimString } = require('../lib/validators');
const router = express.Router();

// Message receipts and bell state must follow the same persisted read action.
async function markConversationRead(userId, partnerId) {
  await db.prepare('UPDATE messages SET is_read = 1 WHERE sender_id = ? AND receiver_id = ?').run(partnerId, userId);
  await db.prepare("UPDATE notifications SET read = 1 WHERE user_id = ? AND type = 'message' AND related_id IN (SELECT id FROM messages WHERE sender_id = ? AND receiver_id = ?)").run(userId, partnerId, userId);
  await db.saveDb();
  const io = require('../services/socket').getIO();
  io?.to(`user:${partnerId}`).emit('messages:read_receipt', { read_by: userId, conversation_with: partnerId });
  io?.to(`user:${userId}`).emit('notifications:updated');
}

router.get('/conversations', authenticate, async (req, res, next) => {
  try {
    const rows = await db.prepare(`
      SELECT DISTINCT u.id, u.name, u.role, u.avatar,
        (SELECT content FROM messages WHERE (sender_id = u.id AND receiver_id = ?) OR (sender_id = ? AND receiver_id = u.id) ORDER BY created_at DESC LIMIT 1) as last_message,
        (SELECT created_at FROM messages WHERE (sender_id = u.id AND receiver_id = ?) OR (sender_id = ? AND receiver_id = u.id) ORDER BY created_at DESC LIMIT 1) as last_message_at,
        (SELECT COUNT(*) FROM messages WHERE sender_id = u.id AND receiver_id = ? AND is_read = 0) as unread
      FROM users u
      WHERE u.id != ? AND (
        EXISTS (SELECT 1 FROM messages WHERE sender_id = u.id AND receiver_id = ?)
        OR EXISTS (SELECT 1 FROM messages WHERE sender_id = ? AND receiver_id = u.id)
      )
      ORDER BY last_message_at DESC
    `).all(req.user.id, req.user.id, req.user.id, req.user.id, req.user.id, req.user.id, req.user.id, req.user.id);
    res.json(rows);
  } catch (err) { next(err); }
});

router.get('/users', authenticate, async (req, res, next) => {
  try {
    let sql = 'SELECT id, name, role, avatar FROM users WHERE id != ?';
    const params = [req.user.id];
    const rows = await db.prepare(sql + ' ORDER BY name ASC').all(...params);
    res.json(rows);
  } catch (err) { next(err); }
});

router.get('/search', authenticate, async (req, res, next) => {
  try {
    const { q, with: withUser } = req.query;
    if (!q?.trim()) return res.json([]);
    const like = `%${q}%`;
    let sql = `
      SELECT m.*, u.name as sender_name, u.avatar as sender_avatar,
        CASE WHEN m.sender_id = ? THEN 'sent' ELSE 'received' END as direction
      FROM messages m
      JOIN users u ON u.id = m.sender_id
      WHERE (m.sender_id = ? OR m.receiver_id = ?) AND m.content LIKE ?
    `;
    const params = [req.user.id, req.user.id, req.user.id, like];
    if (withUser) { sql += ' AND (m.sender_id = ? OR m.receiver_id = ?)'; params.push(withUser, withUser); }
    sql += ' ORDER BY m.created_at DESC LIMIT 30';
    const rows = await db.prepare(sql).all(...params);
    res.json(rows);
  } catch (err) { next(err); }
});

router.get('/conversations/unread-counts', authenticate, async (req, res, next) => {
  try {
    const rows = await db.prepare(`
      SELECT sender_id, COUNT(*) as count FROM messages WHERE receiver_id = ? AND is_read = 0 GROUP BY sender_id
    `).all(req.user.id);
    const map = {};
    rows.forEach(r => { map[r.sender_id] = r.count; });
    res.json(map);
  } catch (err) { next(err); }
});

router.get('/:userId', authenticate, async (req, res, next) => {
  try {
    const offset = Math.max(0, parseInt(req.query.offset) || 0);
    const limit = Math.max(1, Math.min(parseInt(req.query.limit) || 50, 100));
    const partner = await db.prepare('SELECT id, name, role, avatar FROM users WHERE id = ?').get(req.params.userId);
    if (!partner) return res.status(404).json({ error: 'User not found' });
    const result = await db.prepare(`
      SELECT COUNT(*) as count FROM messages
      WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
    `).get(req.user.id, req.params.userId, req.params.userId, req.user.id);
    const total = result.count;
    const rows = await db.prepare(`
      SELECT m.*, u.name as sender_name, u.avatar as sender_avatar
      FROM messages m
      JOIN users u ON u.id = m.sender_id
      WHERE (m.sender_id = ? AND receiver_id = ?) OR (m.sender_id = ? AND receiver_id = ?)
      ORDER BY m.created_at DESC LIMIT ? OFFSET ?
    `).all(req.user.id, req.params.userId, req.params.userId, req.user.id, limit, offset);
    const updated = await db.prepare('UPDATE messages SET is_read = 1 WHERE sender_id = ? AND receiver_id = ? AND is_read = 0')
      .run(req.params.userId, req.user.id);
    if (updated.changes > 0) {
      await db.saveDb();
      try {
        const { getIO } = require('../services/socket');
        const io = getIO();
        if (io) io.to(`user:${req.params.userId}`).emit('messages:read_receipt', { read_by: req.user.id, conversation_with: req.params.userId });
      } catch {}
    }
    await markConversationRead(req.user.id, req.params.userId);
    res.json({ messages: rows.reverse(), total, partner, offset, limit });
  } catch (err) { next(err); }
});

router.post('/:userId', authenticate, async (req, res, next) => {
  try {
    if (typeof req.body.content !== 'string' || req.body.content.length > 4000) return res.status(400).json({ error: 'Message must contain between 1 and 4000 characters' });
    if (req.params.userId === req.user.id) return res.status(400).json({ error: 'Choose another recipient' });
    const content = trimString(req.body.content, 4000);
    if (!content) return res.status(400).json({ error: 'Message content is required' });
    const target = await db.prepare('SELECT id, role FROM users WHERE id = ?').get(req.params.userId);
    if (!target) return res.status(404).json({ error: 'User not found' });
    const id = uuidv4();
    const now = new Date().toISOString();
    await db.prepare('INSERT INTO messages (id, sender_id, receiver_id, content) VALUES (?, ?, ?, ?)')
      .run(id, req.user.id, req.params.userId, content);
    await db.saveDb();
    const payload = { id, content, sender_id: req.user.id, receiver_id: req.params.userId, created_at: now, is_read: 0, sender_name: req.user.name };
    await db.prepare('INSERT INTO notifications (id, user_id, title, message, type, related_id) VALUES (?, ?, ?, ?, ?, ?)')
      .run(uuidv4(), req.params.userId, 'New Message', `${req.user.name} sent you a message`, 'message', id);
    await db.saveDb();
    try {
      const { getIO } = require('../services/socket');
      const io = getIO();
      if (io) {
        io.to(`user:${req.params.userId}`).emit('messages:new', payload);
        io.to(`user:${req.params.userId}`).emit('notifications:new', { title: 'New Message', message: `${req.user.name} sent you a message`, type: 'message', related_id: id });
        io.to(`user:${req.user.id}`).emit('messages:new', payload);
      }
    } catch {}
    res.json(payload);
  } catch (err) { next(err); }
});

router.put('/:userId/read', authenticate, async (req, res, next) => {
  try {
    await markConversationRead(req.user.id, req.params.userId);
    res.json({ message: 'Messages marked as read' });
  } catch (err) { next(err); }
});

router.delete('/:messageId', authenticate, async (req, res, next) => {
  try {
    const msg = await db.prepare('SELECT * FROM messages WHERE id = ?').get(req.params.messageId);
    if (!msg) return res.status(404).json({ error: 'Message not found' });
    if (msg.sender_id !== req.user.id) return res.status(403).json({ error: 'Can only delete your own messages' });
    await db.prepare('DELETE FROM messages WHERE id = ?').run(req.params.messageId);
    await db.saveDb();
    res.json({ message: 'Message deleted' });
  } catch (err) { next(err); }
});

module.exports = router;
