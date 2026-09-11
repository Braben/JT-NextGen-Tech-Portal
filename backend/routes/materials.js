/**
 * Materials - Course material uploads and downloads
 *
 * Security hardening:
 *   - file_path is NEVER trusted from req.body. The client can only
 *     provide a link_url or a file_type. A file_path is only accepted
 *     if it points inside the /uploads directory (validated server-side).
 *   - link_url is validated to be http/https only (prevents javascript:
 *     and other scheme injection).
 *   - file_type is validated against an allowlist.
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { authenticate } = require('../middleware/auth');
const db = require('../config/db');
const { isAdmin } = require('../lib/accessControl');
const { trimString } = require('../lib/validators');

/** Allowlisted file types */
const ALLOWED_FILE_TYPES = ['document', 'video', 'slides', 'link', 'other'];

/* File upload config — multiple files, 10 MB each, stored in /uploads */
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'uploads')),
  filename: (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`),
});

const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.doc', '.txt', '.rtf', '.odt', '.ppt', '.pptx', '.mp4', '.mov', '.jpg', '.jpeg', '.png', '.gif', '.zip', '.mp3', '.xlsx', '.xls'];

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_EXTENSIONS.includes(ext)) return cb(null, true);
    const err = new Error('File type not allowed. Allowed: PDF, DOCX, DOC, TXT, RTF, ODT, PPT, PPTX, XLS, XLSX, images, video, audio, ZIP');
    err.status = 400;
    cb(err);
  },
});

/** Map a MIME type or extension to a coarse material category. */
function inferFileType(file) {
  const mime = (file.mimetype || '').toLowerCase();
  const ext = path.extname(file.originalname || '').toLowerCase();
  if (mime.startsWith('image/')) return 'slides';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'other';
  if (['.ppt', '.pptx'].includes(ext)) return 'slides';
  if (['.xls', '.xlsx', '.doc', '.docx', '.pdf', '.txt', '.rtf', '.odt'].includes(ext)) return 'document';
  return 'other';
}

/** Accepted file_type or the sanitized fallback */
function sanitizeFileType(type) {
  return ALLOWED_FILE_TYPES.includes(type) ? type : null;
}

/**
 * Validate a link_url. Returns true only for http/https URLs.
 * Rejects javascript:, data:, file:, and other dangerous schemes.
 */
function isValidUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch (e) {
    return false;
  }
}

/**
 * Sanitize a client-supplied file_path.
 * Only paths that begin with /uploads/ (and contain no .. traversal)
 * are accepted. Everything else is treated as null.
 */
function sanitizeFilePath(filePath) {
  if (!filePath || typeof filePath !== 'string') return null;
  if (filePath.startsWith('/uploads/') && !filePath.includes('..')) return filePath;
  return null;
}

router.get('/', authenticate, async (req, res, next) => {
  try {
    const { program_id } = req.query;
    let rows;

    if (req.user.role === 'instructor') {
      // Instructors see materials they uploaded PLUS system/admin-uploaded ones.
      // Admin-uploaded materials have instructor_id = an admin's user id.
      rows = program_id
        ? await db.prepare(`
            SELECT m.*, u.name AS instructor_name, u.role AS uploader_role, p.title AS program_name
            FROM materials m
            LEFT JOIN users u ON m.instructor_id = u.id
            LEFT JOIN programs p ON m.program_id = p.id
            WHERE m.program_id = ? AND (m.instructor_id = ? OR u.role = 'admin')
            ORDER BY m.created_at DESC
          `).all(program_id, req.user.id)
        : await db.prepare(`
            SELECT m.*, u.name AS instructor_name, u.role AS uploader_role, p.title AS program_name
            FROM materials m
            LEFT JOIN users u ON m.instructor_id = u.id
            LEFT JOIN programs p ON m.program_id = p.id
            WHERE m.instructor_id = ? OR u.role = 'admin'
            ORDER BY m.created_at DESC
          `).all(req.user.id);
    } else if (req.user.role === 'student') {
      // Students see materials for their enrolled programs, but only if the
      // material's audience settings include them:
      //   - 'active' group: student has an active enrollment in the program
      //   - 'alumni' group: student has a completed enrollment in the program,
      //     and if audience_year/audience_month are set, the completion date
      //     must match that cohort.
      const enrollments = await db.prepare('SELECT program_id, status, completed_at FROM enrollments WHERE student_id = ?').all(req.user.id);
      if (!enrollments.length) return res.json([]);

      const activePrograms = enrollments.filter((e) => e.status === 'active').map((e) => e.program_id);
      const alumniPrograms = enrollments.filter((e) => e.status === 'completed').map((e) => ({ program_id: e.program_id, completed_at: e.completed_at }));

      const rowsForGroup = (programIds, audienceGroup) => {
        if (!programIds.length) return [];
        const placeholders = programIds.map(() => '?').join(',');
        return db.prepare(`
          SELECT m.*, u.name AS instructor_name, u.role AS uploader_role, p.title AS program_name
          FROM materials m
          LEFT JOIN users u ON m.instructor_id = u.id
          LEFT JOIN programs p ON m.program_id = p.id
          WHERE m.program_id IN (${placeholders})
            AND m.audience_groups LIKE ?
          ORDER BY m.created_at DESC
        `).all(...programIds, `%${audienceGroup}%`);
      };

      const activeRows = rowsForGroup(activePrograms, 'active');
      let alumniRows = [];
      if (alumniPrograms.length) {
        const progIds = [...new Set(alumniPrograms.map(e => e.program_id))];
        const placeholders = progIds.map(() => '?').join(',');
        const candidates = await db.prepare(`
            SELECT m.*, u.name AS instructor_name, u.role AS uploader_role, p.title AS program_name
            FROM materials m
            LEFT JOIN users u ON m.instructor_id = u.id
            LEFT JOIN programs p ON m.program_id = p.id
            WHERE m.audience_groups LIKE '%alumni%'
              AND m.program_id IN (${placeholders})
            ORDER BY m.created_at DESC
          `).all(...progIds);
        alumniRows = candidates.filter(m => {
          if (!m.audience_year && !m.audience_month) return true;
          return alumniPrograms.some(e => {
            if (e.program_id !== m.program_id) return false;
            const d = new Date(e.completed_at);
            if (isNaN(d)) return false;
            const y = String(d.getFullYear());
            const mo = String(d.getMonth() + 1).padStart(2, '0');
            return y === String(m.audience_year) && mo === String(m.audience_month).padStart(2, '0');
          });
        });
      }

      // De-duplicate by id (a material could match both active and alumni)
      const seen = new Set();
      rows = [...activeRows, ...alumniRows].filter((r) => {
        if (seen.has(r.id)) return false;
        seen.add(r.id);
        return true;
      });
    } else {
      // Admin: view all
      rows = await db.prepare('SELECT m.*, u.name AS instructor_name, u.role AS uploader_role FROM materials m LEFT JOIN users u ON m.instructor_id = u.id ORDER BY m.created_at DESC').all();
    }

    // Parse audience_groups JSON for the client
    rows.forEach((r) => {
      try { r.audience_groups = JSON.parse(r.audience_groups || '["active"]'); } catch { r.audience_groups = ['active']; }
    });

    res.json(rows);
  } catch (e) { next(e); }
});

/**
 * POST / — Create one or more materials in a single request.
 *
 * Accepts multipart/form-data (upload.array('files', 15)) so instructors
 * can add several items at once, each being either a link or a file:
 *
 *   fields:
 *     program_id         — target program (required)
 *     data               — JSON string, array of items:
 *         [{ title, description, file_type, link_url, file_key }]
 *       file_key (optional) — index into req.files[] (defaults to item order
 *       for consecutive files). When a file is attached, link_url is ignored
 *       and file_path is derived SERVER-SIDE from the uploaded file.
 *
 * Returns: array of created material rows.
 */
router.post('/', authenticate, upload.array('files', 15), async (req, res, next) => {
  try {
    if (req.user.role !== 'instructor' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only instructors can add materials' });
    }
    const program_id = req.body.program_id;
    let items;
    if (req.body.data !== undefined) {
      try { items = JSON.parse(req.body.data || '[]'); } catch (e) { return res.status(400).json({ error: 'Invalid items data' }); }
    } else {
      items = [{
        title: req.body.title,
        description: req.body.description,
        file_type: req.body.file_type,
        link_url: req.body.link_url,
        audience_groups: req.body.audience_groups,
        audience_year: req.body.audience_year,
        audience_month: req.body.audience_month,
      }];
    }
    if (!program_id) return res.status(400).json({ error: 'Program ID required' });
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'At least one material is required' });
    if (items.length > 50) return res.status(400).json({ error: 'Too many materials in one request' });

    const files = req.files || [];
    const created = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const title = trimString(item.title, 200);
      if (!title) return res.status(400).json({ error: `Material ${i + 1}: title is required` });

      const file = files[item.file_key ?? i];
      const link_url = item.link_url ? String(item.link_url) : '';
      if (!file && !link_url) {
        return res.status(400).json({ error: `Material ${i + 1}: provide a file or a link` });
      }
      if (link_url && !isValidUrl(link_url)) {
        return res.status(400).json({ error: `Material ${i + 1}: link must be a valid http(s) URL` });
      }

      const id = uuidv4();
      const safeFilePath = file ? `/uploads/${file.filename}` : null;
      const safeFileType = sanitizeFileType(item.file_type) || (file ? inferFileType(file) : 'link');

      // Audience visibility (admin-set): which groups may see this material.
      //   groups — ['active'] | ['alumni'] | both
      //   year/month — completion cohort filter (only meaningful for alumni)
      const groups = isAdmin(req.user) && Array.isArray(item.audience_groups) && item.audience_groups.length
        ? item.audience_groups
        : ['active'];
      const cleanGroups = groups.filter((g) => g === 'active' || g === 'alumni');
      const audienceGroups = JSON.stringify(cleanGroups.length ? cleanGroups : ['active']);
      const audienceYear = cleanGroups.includes('alumni') && item.audience_year ? String(item.audience_year) : null;
      const audienceMonth = cleanGroups.includes('alumni') && item.audience_month ? String(item.audience_month).padStart(2, '0') : null;

      await db.prepare('INSERT INTO materials (id, instructor_id, program_id, title, description, file_path, file_type, link_url, audience_groups, audience_year, audience_month) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
        .run(id, req.user.id, program_id, title, trimString(item.description, 1000), safeFilePath, safeFileType, file ? null : (link_url || null), audienceGroups, audienceYear, audienceMonth);
      created.push(await db.prepare('SELECT m.*, u.name AS instructor_name, p.title AS program_name FROM materials m LEFT JOIN users u ON m.instructor_id = u.id LEFT JOIN programs p ON m.program_id = p.id WHERE m.id = ?').get(id));
    }

    await db.saveDb();
    res.status(201).json({ message: `${created.length} material(s) added`, materials: created });
  } catch (e) { next(e); }
});

router.put('/:id', authenticate, async (req, res, next) => {
  try {
    const mat = await db.prepare('SELECT * FROM materials WHERE id = ?').get(req.params.id);
    if (!mat) return res.status(404).json({ error: 'Material not found' });
    if (req.user.role !== 'admin' && mat.instructor_id !== req.user.id) return res.status(403).json({ error: 'Unauthorized' });
    const { file_path, file_type, link_url, audience_groups, audience_year, audience_month } = req.body;
    const title = req.body.title !== undefined ? trimString(req.body.title, 200) : undefined;
    const description = req.body.description !== undefined ? trimString(req.body.description, 1000) : undefined;
    if (link_url !== undefined && link_url && !isValidUrl(link_url)) return res.status(400).json({ error: 'Link must be a valid http(s) URL' });

    const safeFilePath = file_path !== undefined ? sanitizeFilePath(file_path) : undefined;
    const safeFileType = file_type !== undefined ? sanitizeFileType(file_type) : undefined;

    // Build audience fields if provided
    let audienceSql = '';
    const audienceParams = [];
    if (isAdmin(req.user) && Array.isArray(audience_groups)) {
      const clean = audience_groups.filter((g) => g === 'active' || g === 'alumni');
      audienceSql = ', audience_groups=?, audience_year=?, audience_month=?';
      audienceParams.push(
        JSON.stringify(clean.length ? clean : ['active']),
        clean.includes('alumni') && audience_year ? String(audience_year) : null,
        clean.includes('alumni') && audience_month ? String(audience_month).padStart(2, '0') : null
      );
    }

    await db.prepare(`UPDATE materials SET title=COALESCE(?,title), description=COALESCE(?,description), file_path=COALESCE(?,file_path), file_type=COALESCE(?,file_type), link_url=COALESCE(?,link_url)${audienceSql} WHERE id=?`)
      .run(title, description, safeFilePath, safeFileType, link_url, ...audienceParams, req.params.id);
    await db.saveDb();
    const row = await db.prepare('SELECT m.*, u.name AS instructor_name, u.role AS uploader_role, p.title AS program_name FROM materials m LEFT JOIN users u ON m.instructor_id = u.id LEFT JOIN programs p ON m.program_id = p.id WHERE m.id = ?').get(req.params.id);
    try { row.audience_groups = JSON.parse(row.audience_groups || '["active"]'); } catch { row.audience_groups = ['active']; }
    res.json(row);
  } catch (e) { next(e); }
});

router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const mat = await db.prepare('SELECT * FROM materials WHERE id = ?').get(req.params.id);
    if (!mat) return res.status(404).json({ error: 'Material not found' });
    if (req.user.role !== 'admin' && mat.instructor_id !== req.user.id) return res.status(403).json({ error: 'Unauthorized' });
    await db.prepare('DELETE FROM materials WHERE id = ?').run(req.params.id);
    await db.saveDb();
    res.json({ message: 'Material deleted' });
  } catch (e) { next(e); }
});

module.exports = router;
