const express = require('express');
const fs = require('fs');
const path = require('path');
const db = require('../config/db');
const { authenticate } = require('../middleware/auth');
const {
  canViewMaterial,
  canViewSubmission,
  getSubmission,
  uploadFilenameFromPath,
} = require('../lib/accessControl');

const router = express.Router();
const uploadsDir = path.join(__dirname, '..', 'uploads');

function sendUpload(res, filePath) {
  const filename = uploadFilenameFromPath(filePath);
  if (!filename) return res.status(404).json({ error: 'File not found' });

  const absolutePath = path.join(uploadsDir, filename);
  const resolved = path.resolve(absolutePath);
  if (!resolved.startsWith(path.resolve(uploadsDir) + path.sep) || !fs.existsSync(resolved)) {
    return res.status(404).json({ error: 'File not found' });
  }

  res.setHeader('Cache-Control', 'private, no-store');
  return res.download(resolved, filename);
}

router.get('/materials/:id', authenticate, async (req, res, next) => {
  try {
    const material = await db.prepare('SELECT * FROM materials WHERE id = ?').get(req.params.id);
    if (!material || !material.file_path) return res.status(404).json({ error: 'File not found' });
    if (!(await canViewMaterial(db, req.user, material))) return res.status(403).json({ error: 'Unauthorized' });
    return sendUpload(res, material.file_path);
  } catch (err) {
    next(err);
  }
});

router.get('/submissions/:id', authenticate, async (req, res, next) => {
  try {
    const submission = await getSubmission(db, req.params.id);
    if (!submission || !submission.file_path) return res.status(404).json({ error: 'File not found' });
    if (!canViewSubmission(req.user, submission)) return res.status(403).json({ error: 'Unauthorized' });
    return sendUpload(res, submission.file_path);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
