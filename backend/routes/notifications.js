/**
 * Notifications - In-app notification list and read status
 *
 * Routes:
 *   GET   /             - List user's notifications (newest first)
 *   GET   /unread-count - Count of unread notifications
 *   PUT   /:id/read     - Mark single notification as read
 *   PUT   /read-all     - Mark all notifications as read
 */

const express = require('express');
const db = require('../config/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticate, async (req, res, next) => {
  try {
    const rows = await db.prepare(`
      SELECT n.*, m.sender_id as message_sender_id, m.receiver_id as message_receiver_id
      FROM notifications n
      LEFT JOIN messages m ON n.type = 'message' AND m.id = n.related_id
      WHERE n.user_id = ?
      ORDER BY n.created_at DESC
      LIMIT 50
    `).all(req.user.id);

    // Keep navigation decisions on the server where notification type and
    // related entity semantics are known. The client renders target_url only;
    // it does not need to guess whether related_id is a message, enrollment,
    // submission, or another entity.
    const withTargets = rows.map((row) => {
      let target_url = null;
      if (row.type === 'message') {
        const partnerId = row.message_sender_id === req.user.id ? row.message_receiver_id : row.message_sender_id;
        target_url = req.user.role === 'admin' ? '/admin/messages' : (partnerId ? `/messages/${partnerId}` : '/messages');
      } else if (['submission', 'grade', 'assignment'].includes(row.type) && row.related_id) {
        target_url = row.type === 'assignment' ? `/student/submit/${row.related_id}` : `/submission/${row.related_id}`;
      } else if (row.type === 'enrollment') {
        target_url = req.user.role === 'student' ? '/student' : '/admin/enrollments';
      } else if (row.type === 'class') {
        if (req.user.role === 'admin') target_url = '/admin/classes';
        else if (req.user.role === 'instructor') target_url = '/instructor/classes';
        else target_url = '/student/classes';
      } else if (row.type === 'onboarding') {
        target_url = req.user.role === 'student' && row.related_id ? `/student/aptitude/${row.related_id}` : '/admin/enrollments?assessment=recommended';
      } else if (row.type === 'announcement') {
        if (req.user.role === 'admin') target_url = '/admin/system-messages';
        else if (req.user.role === 'instructor') target_url = '/instructor/messages?tab=announcements';
        else target_url = '/student/messages?tab=announcements';
      } else if (row.type === 'attendance') {
        target_url = req.user.role === 'student' ? '/student/attendance' : '/instructor/attendance';
      } else if (row.type === 'forum') {
        target_url = '/forums';
      }
      const { message_sender_id, message_receiver_id, ...notification } = row;
      return { ...notification, target_url };
    });

    res.json(withTargets);
  } catch (err) { next(err); }
});

router.get('/unread-count', authenticate, async (req, res, next) => {
  try {
    const row = await db.prepare("SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read = 0").get(req.user.id);
    res.json({ count: row.count });
  } catch (err) { next(err); }
});

router.put('/read-all', authenticate, async (req, res, next) => {
  try {
    await db.prepare('UPDATE notifications SET read = 1 WHERE user_id = ?').run(req.user.id);
    await db.saveDb?.();
    require('../services/socket').getIO()?.to(`user:${req.user.id}`).emit('notifications:updated');
    res.json({ message: 'All marked as read' });
  } catch (err) { next(err); }
});

router.put('/:id/read', authenticate, async (req, res, next) => {
  try {
    await db.prepare('UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
    await db.saveDb?.();
    require('../services/socket').getIO()?.to(`user:${req.user.id}`).emit('notifications:updated');
    res.json({ message: 'Marked as read' });
  } catch (err) { next(err); }
});

module.exports = router;



