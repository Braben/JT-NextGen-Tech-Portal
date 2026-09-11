/**
 * Forums - Categories, topics, replies, likes, ratings
 */


const express = require('express');
const db = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');
const { isAdmin, isInstructor, isStudent } = require('../lib/accessControl');
const { trimString } = require('../lib/validators');
const router = express.Router();

async function canViewCategory(user, category) {
  if (!category) return false;
  if (isAdmin(user) || category.type !== 'cohort') return true;

  // New class discussion rooms are private to the allocated students and
  // the assigned instructor. Legacy cohort forums still fall back to session
  // matching below so older categories remain usable after the migration.
  if (category.class_id) {
    if (isInstructor(user)) {
      const assigned = await db.prepare('SELECT id FROM program_classes WHERE id = ? AND instructor_id = ?').get(category.class_id, user.id);
      return Boolean(assigned);
    }
    if (isStudent(user)) {
      const enrolled = await db.prepare('SELECT id FROM enrollments WHERE student_id = ? AND class_id = ?').get(user.id, category.class_id);
      return Boolean(enrolled);
    }
    return false;
  }

  if (!isStudent(user)) return true;
  const row = await db.prepare(
    'SELECT id FROM enrollments WHERE student_id = ? AND session = ?'
  ).get(user.id, category.session);
  return Boolean(row);
}

router.get('/categories', authenticate, async (req, res, next) => {
  try {
    const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    let rows;
    if (user.role === 'student') {
      const enrollments = await db.prepare('SELECT DISTINCT session FROM enrollments WHERE student_id = ?').all(req.user.id);
      const sessions = enrollments.map(e => e.session).filter(Boolean);
      const classes = await db.prepare('SELECT DISTINCT class_id FROM enrollments WHERE student_id = ? AND class_id IS NOT NULL').all(req.user.id);
      const classIds = classes.map((item) => item.class_id).filter(Boolean);
      if (!sessions.length) {
        if (!classIds.length) {
          rows = await db.prepare(`SELECT c.*, (SELECT COUNT(*) FROM forum_topics WHERE category_id = c.id) as topic_count FROM forum_categories c WHERE c.type = 'general' ORDER BY c.type ASC, c.name ASC`).all();
        } else {
          const classPlaceholders = classIds.map(() => '?').join(',');
          rows = await db.prepare(`SELECT c.*, (SELECT COUNT(*) FROM forum_topics WHERE category_id = c.id) as topic_count FROM forum_categories c WHERE c.type = 'general' OR c.class_id IN (${classPlaceholders}) ORDER BY c.type ASC, c.name ASC`).all(...classIds);
        }
      } else {
        const placeholders = sessions.map(() => '?').join(',');
        const classClause = classIds.length ? ` OR c.class_id IN (${classIds.map(() => '?').join(',')})` : '';
        rows = await db.prepare(`SELECT c.*, (SELECT COUNT(*) FROM forum_topics WHERE category_id = c.id) as topic_count FROM forum_categories c WHERE c.type = 'general' OR (c.type = 'cohort' AND c.class_id IS NULL AND c.session IN (${placeholders}))${classClause} ORDER BY c.type ASC, c.name ASC`).all(...sessions, ...classIds);
      }
    } else if (user.role === 'instructor') {
      rows = await db.prepare(`
        SELECT c.*, (SELECT COUNT(*) FROM forum_topics WHERE category_id = c.id) as topic_count
        FROM forum_categories c
        WHERE c.type = 'general'
          OR c.class_id IN (SELECT id FROM program_classes WHERE instructor_id = ?)
          OR (c.type = 'cohort' AND c.class_id IS NULL)
        ORDER BY c.type ASC, c.name ASC
      `).all(req.user.id);
    } else {
      rows = await db.prepare('SELECT c.*, (SELECT COUNT(*) FROM forum_topics WHERE category_id = c.id) as topic_count FROM forum_categories c ORDER BY c.type ASC, c.name ASC').all();
    }
    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/categories', authenticate, authorize('admin', 'instructor'), async (req, res, next) => {
  try {
    const { name, description, type, session, program_id, class_id } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    if (class_id) {
      const classRow = await db.prepare('SELECT * FROM program_classes WHERE id = ?').get(class_id);
      if (!classRow) return res.status(400).json({ error: 'Class not found' });
      if (!isAdmin(req.user) && classRow.instructor_id !== req.user.id) return res.status(403).json({ error: 'Unauthorized' });
    }
    const id = uuidv4();
    await db.prepare('INSERT INTO forum_categories (id, name, description, type, session, program_id, class_id) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(id, name, description || '', type || 'general', session || null, program_id || null, class_id || null);
    await db.saveDb();
    res.json({ id, name });
  } catch (err) { next(err); }
});

router.get('/categories/:categoryId', authenticate, async (req, res, next) => {
  try {
    const category = await db.prepare('SELECT * FROM forum_categories WHERE id = ?').get(req.params.categoryId);
    if (!category) return res.status(404).json({ error: 'Category not found' });
    if (!(await canViewCategory(req.user, category))) return res.status(403).json({ error: 'Unauthorized' });
    const topics = await db.prepare(`
      SELECT t.*, u.name as user_name, u.avatar as user_avatar,
        (SELECT COUNT(*) FROM forum_replies WHERE topic_id = t.id) as reply_count,
        (SELECT COUNT(*) FROM forum_likes WHERE target_type = 'topic' AND target_id = t.id) as likes_count,
        (SELECT created_at FROM forum_replies WHERE topic_id = t.id ORDER BY created_at DESC LIMIT 1) as last_reply_at
      FROM forum_topics t
      JOIN users u ON u.id = t.user_id
      WHERE t.category_id = ?
      ORDER BY t.is_pinned DESC, t.created_at DESC
    `).all(req.params.categoryId);
    res.json({ ...category, topics });
  } catch (err) { next(err); }
});

router.post('/categories/:categoryId/topics', authenticate, async (req, res, next) => {
  try {
    const title = trimString(req.body.title, 200);
    const content = trimString(req.body.content, 5000);
    if (!title?.trim() || !content?.trim()) return res.status(400).json({ error: 'Title and content are required' });
    const category = await db.prepare('SELECT * FROM forum_categories WHERE id = ?').get(req.params.categoryId);
    if (!category) return res.status(404).json({ error: 'Category not found' });
    if (!(await canViewCategory(req.user, category))) return res.status(403).json({ error: 'Unauthorized' });
    const id = uuidv4();
    await db.prepare('INSERT INTO forum_topics (id, category_id, user_id, title, content) VALUES (?, ?, ?, ?, ?)')
      .run(id, req.params.categoryId, req.user.id, title, content);
    await db.saveDb();
    res.json({ id, title });
  } catch (err) { next(err); }
});

router.get('/topics/:topicId', authenticate, async (req, res, next) => {
  try {
    await db.prepare('UPDATE forum_topics SET views = views + 1 WHERE id = ?').run(req.params.topicId);
    const topic = await db.prepare(`
      SELECT t.*, c.name as category_name, c.class_id, c.program_id,
        u.name as user_name, u.avatar as user_avatar, u.role as user_role,
        (SELECT COUNT(*) FROM forum_likes WHERE target_type = 'topic' AND target_id = t.id) as likes_count,
        (SELECT COUNT(*) FROM forum_likes WHERE target_type = 'topic' AND target_id = t.id AND user_id = ?) as user_liked
      FROM forum_topics t
      JOIN forum_categories c ON c.id = t.category_id
      JOIN users u ON u.id = t.user_id
      WHERE t.id = ?
    `).get(req.user.id, req.params.topicId);
    if (!topic) return res.status(404).json({ error: 'Topic not found' });
    const category = await db.prepare('SELECT * FROM forum_categories WHERE id = ?').get(topic.category_id);
    if (!(await canViewCategory(req.user, category))) return res.status(403).json({ error: 'Unauthorized' });
    const replies = await db.prepare(`
      SELECT r.*, u.name as user_name, u.avatar as user_avatar, u.role as user_role,
        (SELECT COUNT(*) FROM forum_likes WHERE target_type = 'reply' AND target_id = r.id) as likes_count,
        (SELECT COUNT(*) FROM forum_likes WHERE target_type = 'reply' AND target_id = r.id AND user_id = ?) as user_liked,
        (SELECT ROUND(AVG(rating), 1) FROM forum_reply_ratings WHERE reply_id = r.id) as rating_avg,
        (SELECT COUNT(*) FROM forum_reply_ratings WHERE reply_id = r.id) as rating_count,
        (SELECT rating FROM forum_reply_ratings WHERE reply_id = r.id AND user_id = ?) as user_rating
      FROM forum_replies r
      JOIN users u ON u.id = r.user_id
      WHERE r.topic_id = ?
      ORDER BY r.created_at ASC
    `).all(req.user.id, req.user.id, req.params.topicId);
    res.json({ ...topic, replies });
  } catch (err) { next(err); }
});

router.post('/topics/:topicId/replies', authenticate, async (req, res, next) => {
  try {
    const content = trimString(req.body.content, 5000);
    if (!content?.trim()) return res.status(400).json({ error: 'Reply content is required' });
    const parent = await db.prepare('SELECT t.*, c.type, c.session, c.class_id, c.program_id FROM forum_topics t JOIN forum_categories c ON c.id = t.category_id WHERE t.id = ?').get(req.params.topicId);
    if (!parent) return res.status(404).json({ error: 'Topic not found' });
    if (parent.is_closed) return res.status(400).json({ error: 'Topic is closed' });
    if (!(await canViewCategory(req.user, parent))) return res.status(403).json({ error: 'Unauthorized' });
    const id = uuidv4();
    await db.prepare('INSERT INTO forum_replies (id, topic_id, user_id, content) VALUES (?, ?, ?, ?)')
      .run(id, req.params.topicId, req.user.id, content);
    await db.prepare('UPDATE forum_topics SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(req.params.topicId);
    const topic = await db.prepare('SELECT t.*, c.name as category_name FROM forum_topics t JOIN forum_categories c ON c.id = t.category_id WHERE t.id = ?').get(req.params.topicId);
    if (topic) {
      const notifyUsers = await db.prepare('SELECT DISTINCT user_id FROM forum_replies WHERE topic_id = ? AND user_id != ? UNION SELECT t.user_id FROM forum_topics t WHERE t.id = ? AND t.user_id != ?')
        .all(req.params.topicId, req.user.id, req.params.topicId, req.user.id);
      for (const nu of notifyUsers) {
        await db.prepare('INSERT INTO notifications (id, user_id, title, message, type, related_id) VALUES (?, ?, ?, ?, ?, ?)')
          .run(uuidv4(), nu.user_id, 'New Forum Reply', `${req.user.name} replied to "${topic.title}" in ${topic.category_name}`, 'forum', req.params.topicId);
      }
    }
    const reply = await db.prepare('SELECT r.*, u.name as user_name, u.role as user_role FROM forum_replies r JOIN users u ON u.id = r.user_id WHERE r.id = ?').get(id);
    await db.saveDb();
    res.json({ ...reply, likes_count: 0, user_liked: 0, rating_avg: null, rating_count: 0, user_rating: null });
  } catch (err) { next(err); }
});

router.put('/topics/:topicId/pin', authenticate, authorize('admin', 'instructor'), async (req, res, next) => {
  try {
    const topic = await db.prepare('SELECT t.*, c.type, c.session, c.class_id, c.program_id FROM forum_topics t JOIN forum_categories c ON c.id = t.category_id WHERE t.id = ?').get(req.params.topicId);
    if (!topic) return res.status(404).json({ error: 'Topic not found' });
    if (!(await canViewCategory(req.user, topic))) return res.status(403).json({ error: 'Unauthorized' });
    await db.prepare('UPDATE forum_topics SET is_pinned = CASE WHEN is_pinned = 1 THEN 0 ELSE 1 END WHERE id = ?').run(req.params.topicId);
    await db.saveDb();
    res.json({ message: 'Toggled pin status' });
  } catch (err) { next(err); }
});

router.put('/topics/:topicId/close', authenticate, authorize('admin', 'instructor'), async (req, res, next) => {
  try {
    const topic = await db.prepare('SELECT t.*, c.type, c.session, c.class_id, c.program_id FROM forum_topics t JOIN forum_categories c ON c.id = t.category_id WHERE t.id = ?').get(req.params.topicId);
    if (!topic) return res.status(404).json({ error: 'Topic not found' });
    if (!(await canViewCategory(req.user, topic))) return res.status(403).json({ error: 'Unauthorized' });
    await db.prepare('UPDATE forum_topics SET is_closed = CASE WHEN is_closed = 1 THEN 0 ELSE 1 END WHERE id = ?').run(req.params.topicId);
    await db.saveDb();
    res.json({ message: 'Toggled close status' });
  } catch (err) { next(err); }
});

router.post('/topics/:topicId/like', authenticate, async (req, res, next) => {
  try {
    const existing = await db.prepare('SELECT id FROM forum_likes WHERE user_id = ? AND target_type = ? AND target_id = ?')
      .get(req.user.id, 'topic', req.params.topicId);
    if (existing) {
      await db.prepare('DELETE FROM forum_likes WHERE id = ?').run(existing.id);
      await db.saveDb();
      res.json({ liked: false });
    } else {
      await db.prepare('INSERT INTO forum_likes (id, user_id, target_type, target_id) VALUES (?, ?, ?, ?)')
        .run(uuidv4(), req.user.id, 'topic', req.params.topicId);
      await db.saveDb();
      res.json({ liked: true });
    }
  } catch (err) { next(err); }
});

router.post('/replies/:replyId/like', authenticate, async (req, res, next) => {
  try {
    const existing = await db.prepare('SELECT id FROM forum_likes WHERE user_id = ? AND target_type = ? AND target_id = ?')
      .get(req.user.id, 'reply', req.params.replyId);
    if (existing) {
      await db.prepare('DELETE FROM forum_likes WHERE id = ?').run(existing.id);
      await db.saveDb();
      res.json({ liked: false });
    } else {
      await db.prepare('INSERT INTO forum_likes (id, user_id, target_type, target_id) VALUES (?, ?, ?, ?)')
        .run(uuidv4(), req.user.id, 'reply', req.params.replyId);
      await db.saveDb();
      res.json({ liked: true });
    }
  } catch (err) { next(err); }
});

router.post('/replies/:replyId/rate', authenticate, async (req, res, next) => {
  try {
    const { rating } = req.body;
    if (!rating || rating < 1 || rating > 5) return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    const existing = await db.prepare('SELECT id FROM forum_reply_ratings WHERE user_id = ? AND reply_id = ?')
      .get(req.user.id, req.params.replyId);
    if (existing) {
      await db.prepare('UPDATE forum_reply_ratings SET rating = ? WHERE id = ?').run(rating, existing.id);
    } else {
      await db.prepare('INSERT INTO forum_reply_ratings (id, user_id, reply_id, rating) VALUES (?, ?, ?, ?)')
        .run(uuidv4(), req.user.id, req.params.replyId, rating);
    }
    await db.saveDb();
    const stats = await db.prepare('SELECT ROUND(AVG(rating), 1) as avg, COUNT(*) as count FROM forum_reply_ratings WHERE reply_id = ?')
      .get(req.params.replyId);
    res.json({ rating_avg: stats.avg, rating_count: stats.count });
  } catch (err) { next(err); }
});

module.exports = router;
