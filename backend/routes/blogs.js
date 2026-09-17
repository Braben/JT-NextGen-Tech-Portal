const express = require('express');
const { v4: uuid } = require('uuid');
const sanitize = require('sanitize-html');
const { authenticate, authorize } = require('../middleware/auth');
const db = require('../config/db');
const audit = require('../services/audit');
const { cacheMiddleware, invalidate } = require('../middleware/cache');
const router = express.Router();
const SELECT = 'SELECT b.*, u.name AS author_name FROM blogs b LEFT JOIN users u ON u.id = b.author_id';
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
function editable(row, user) {
  if (!row) fail('Post not found', 404);
  if (user.role !== 'admin' && (row.author_id !== user.id || row.content_type !== 'article')) fail('You can only manage your own articles', 403);
}
function input(body, user, existing = {}) {
  const merged = { ...existing, ...body };
  const type = merged.content_type || (user.role === 'admin' ? 'blog' : 'article');
  if (!['blog','article'].includes(type)) fail('Select blog or article');
  if (user.role !== 'admin' && type !== 'article') fail('Instructors can create articles only', 403);
  if (existing.id && type !== existing.content_type) fail('The content type cannot be changed');
  const title = typeof merged.title === 'string' ? merged.title.trim() : '';
  if (!title || title.length > 200) fail('Enter a title of 1–200 characters');
  if (typeof merged.content !== 'string' || merged.content.length > 100000) fail('Content is required and must be under 100,000 characters');
  const content = sanitize(merged.content, { allowedTags: ['p','br','strong','b','em','i','u','h2','h3','h4','ul','ol','li','blockquote','pre','code','a'], allowedAttributes: { a: ['href','title'] }, allowedSchemes: ['https','http','mailto'] });
  if (!sanitize(content, { allowedTags: [], allowedAttributes: {} }).trim()) fail('Post content is required');
  let status = body.review_status || (body.published !== undefined ? (body.published === true || body.published === 1 ? 'published' : 'draft') : existing.review_status || 'draft');
  if (!['draft','pending','published'].includes(status)) fail('Select a valid publication status');
  if (user.role !== 'admin') {
    if (body.review_status === 'published' || body.published) fail('Only admins can publish articles', 403);
    status = body.review_status === 'pending' ? 'pending' : 'draft';
  }
  const cover = typeof merged.cover_image === 'string' ? merged.cover_image.trim() : '';
  if (cover) { try { const url = new URL(cover); if (!['http:','https:'].includes(url.protocol) || url.username || url.password) fail('Use an HTTP or HTTPS cover image URL'); } catch { fail('Use an HTTP or HTTPS cover image URL'); } }
  return { title, content, excerpt: typeof merged.excerpt === 'string' ? merged.excerpt.trim().slice(0,500) : '', cover_image: cover || null, content_type: type, review_status: status, published: status === 'published' ? 1 : 0 };
}
for (const path of ['/manage','/admin']) {
  const permission = path === '/admin' ? authorize('admin') : authorize('admin','instructor');
  router.get(path, authenticate, permission, async (req,res,next) => {
    try { res.json(await db.prepare(`${SELECT} ${req.user.role === 'admin' ? '' : "WHERE b.author_id = ? AND b.content_type = 'article'"} ORDER BY b.created_at DESC`).all(...(req.user.role === 'admin' ? [] : [req.user.id]))); } catch(e) { next(e); }
  });
  router.post(path, authenticate, permission, async (req,res,next) => {
    try {
      const v = input(req.body, req.user), id = uuid();
      const slug = `${v.title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,70) || 'post'}-${id.slice(0,8)}`;
      await db.prepare('INSERT INTO blogs (id,title,slug,excerpt,content,cover_image,author_id,published,content_type,review_status) VALUES (?,?,?,?,?,?,?,?,?,?)').run(id,v.title,slug,v.excerpt,v.content,v.cover_image,req.user.id,v.published,v.content_type,v.review_status);
      await db.saveDb(); invalidate('/api/blogs');
      await audit(req.user,'create',v.content_type,id,`${v.title}: ${v.review_status}`);
      res.status(201).json(await db.prepare(`${SELECT} WHERE b.id = ?`).get(id));
    } catch(e) { next(e); }
  });
  router.put(`${path}/:id`, authenticate, permission, async (req,res,next) => {
    try {
      const existing = await db.prepare('SELECT * FROM blogs WHERE id = ?').get(req.params.id); editable(existing,req.user);
      const v = input(req.body,req.user,existing);
      await db.prepare('UPDATE blogs SET title=?,excerpt=?,content=?,cover_image=?,published=?,review_status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(v.title,v.excerpt,v.content,v.cover_image,v.published,v.review_status,existing.id);
      await db.saveDb(); invalidate('/api/blogs');
      await audit(req.user,'update',v.content_type,existing.id,`${v.title}: ${v.review_status}`);
      res.json(await db.prepare(`${SELECT} WHERE b.id = ?`).get(existing.id));
    } catch(e) { next(e); }
  });
  router.delete(`${path}/:id`, authenticate, permission, async (req,res,next) => {
    try {
      const row = await db.prepare('SELECT * FROM blogs WHERE id = ?').get(req.params.id); editable(row,req.user);
      await db.prepare('DELETE FROM blogs WHERE id = ?').run(row.id); await db.saveDb(); invalidate('/api/blogs');
      await audit(req.user,'delete',row.content_type,row.id,row.title); res.json({message:'Post deleted'});
    } catch(e) { next(e); }
  });
}
router.get('/', cacheMiddleware(60), async(req,res,next) => {
  try {
    const type = req.query.type || 'blog';
    if (!['blog','article'].includes(type)) fail('Invalid content type');
    res.json(await db.prepare(`${SELECT} WHERE b.published = 1 AND b.content_type = ? ORDER BY b.created_at DESC`).all(type));
  } catch(e) { next(e); }
});
router.get('/:slug', cacheMiddleware(60), async(req,res,next) => {
  try { const row = await db.prepare(`${SELECT} WHERE b.slug = ? AND b.published = 1`).get(req.params.slug); if (!row) fail('Post not found',404); res.json(row); } catch(e) { next(e); }
});
module.exports = router;
