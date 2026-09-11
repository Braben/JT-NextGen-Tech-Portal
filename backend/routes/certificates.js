const express = require('express');
const db = require('../config/db');

const router = express.Router();

router.get('/verify/:serial', async (req, res, next) => {
  try {
    const serial = String(req.params.serial || '').trim().toUpperCase();
    if (!serial) return res.status(400).json({ error: 'Certificate serial number is required' });

    const cert = await db.prepare(`
      SELECT c.serial_number, c.issue_date, c.status,
             u.name AS student_name, p.title AS program_title
      FROM certificates c
      JOIN users u ON c.student_id = u.id
      JOIN programs p ON c.program_id = p.id
      WHERE UPPER(c.serial_number) = ?
    `).get(serial);

    if (!cert) return res.status(404).json({ error: 'Certificate not found' });
    res.json(cert);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
