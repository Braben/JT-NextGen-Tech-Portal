const express = require('express');
const db = require('../config/db');
const { cacheMiddleware } = require('../middleware/cache');
const router = express.Router();

router.get('/', cacheMiddleware(120), async (req, res, next) => {
  try {
    const rows = await db.prepare('SELECT * FROM testimonials WHERE active = 1 ORDER BY created_at DESC').all();
    res.json(rows);
  } catch (err) {
    try {
      const rows = await db.prepare('SELECT * FROM testimonials ORDER BY created_at DESC').all();
      res.json(rows);
    } catch { res.json([]); }
  }
});

module.exports = router;
