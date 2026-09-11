/**
 * Blogs — public blog posts + admin management
 *
 * Public routes (no auth):
 *   GET  /          — list published blogs (newest first)
 *   GET  /:slug     — single published blog by slug
 *
 * Admin routes:
 *   GET  /admin     — list ALL blogs (drafts + published)
 *   POST /admin     — create a blog (draft by default)
 *   PUT  /admin/:id — update a blog (title, content, published, etc.)
 *   DELETE /admin/:id — delete a blog
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { authenticate, authorize } = require('../middleware/auth');
const db = require('../config/db');
const audit = require('../services/audit');
const { cacheMiddleware, invalidate } = require('../middleware/cache');

/** Slugify a title into a URL-safe unique slug */
function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'post';
}

/** Attach author_name to blog rows */
const SELECT_BLOG = `
  SELECT b.*, u.name as author_name
  FROM blogs b
  LEFT JOIN users u ON u.id = b.author_id
`;

/* ---------- Admin (registered BEFORE the :slug route so /admin isn't swallowed) ---------- */

router.get('/admin', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const rows = await db.prepare(`${SELECT_BLOG} ORDER BY b.created_at DESC`).all();
    res.json(rows);
  } catch (e) { next(e); }
});

router.post('/admin', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const { title, excerpt, content, cover_image, published } = req.body;
    if (!title || !content) return res.status(400).json({ error: 'Title and content are required' });

    const id = uuidv4();
    let slug = slugify(title);
    // Ensure unique slug
    const exists = await db.prepare('SELECT id FROM blogs WHERE slug = ?').get(slug);
    if (exists) slug = `${slug}-${Date.now().toString(36)}`;

    await db.prepare('INSERT INTO blogs (id, title, slug, excerpt, content, cover_image, author_id, published) VALUES (?,?,?,?,?,?,?,?)')
      .run(id, title, slug, excerpt || '', content, cover_image || null, req.user.id, published ? 1 : 0);
    await db.saveDb();
    audit(req.user, 'create', 'blog', id, `Created blog "${title}" (${published ? 'published' : 'draft'})`);
    const row = await db.prepare(`${SELECT_BLOG} WHERE b.id = ?`).get(id);
    res.status(201).json(row);
  } catch (e) { next(e); }
});

router.put('/admin/:id', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const existing = await db.prepare('SELECT * FROM blogs WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Blog post not found' });
    const { title, excerpt, content, cover_image, published } = req.body;

    await db.prepare('UPDATE blogs SET title=COALESCE(?,title), excerpt=COALESCE(?,excerpt), content=COALESCE(?,content), cover_image=COALESCE(?,cover_image), published=?, updated_at=CURRENT_TIMESTAMP WHERE id=?')
      .run(title, excerpt, content, cover_image, published !== undefined ? (published ? 1 : 0) : existing.published, req.params.id);
    await db.saveDb();
    audit(req.user, 'update', 'blog', req.params.id, `Updated blog "${title || existing.title}"`);
    const row = await db.prepare(`${SELECT_BLOG} WHERE b.id = ?`).get(req.params.id);
    res.json(row);
  } catch (e) { next(e); }
});

router.delete('/admin/:id', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const existing = await db.prepare('SELECT id, title FROM blogs WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Blog post not found' });
    audit(req.user, 'delete', 'blog', req.params.id, `Deleted blog "${existing.title}"`);
    await db.prepare('DELETE FROM blogs WHERE id = ?').run(req.params.id);
    await db.saveDb();
    res.json({ message: 'Blog post deleted' });
  } catch (e) { next(e); }
});

/* ---------- Public (must come AFTER admin routes so /admin isn't caught by :slug) ---------- */

router.get('/', cacheMiddleware(60), async (req, res, next) => {
  try {
    const rows = await db.prepare(`${SELECT_BLOG} WHERE b.published = 1 ORDER BY b.created_at DESC LIMIT 20`).all();
    res.json(rows);
  } catch (e) { next(e); }
});

router.get('/:slug', cacheMiddleware(60), async (req, res, next) => {
  try {
    const blog = await db.prepare(`${SELECT_BLOG} WHERE b.slug = ? AND b.published = 1`).get(req.params.slug);
    if (!blog) return res.status(404).json({ error: 'Blog post not found' });
    res.json(blog);
  } catch (e) { next(e); }
});

module.exports = router;
