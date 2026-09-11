/**
 * Payments - Invoice management and fee recording
 */


const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { authenticate } = require('../middleware/auth');
const db = require('../config/db');
const { isAdmin, isStudent } = require('../lib/accessControl');
const { positiveMoney, trimString } = require('../lib/validators');
const audit = require('../services/audit');

router.get('/', authenticate, async (req, res, next) => {
  try {
    let rows;
    if (isAdmin(req.user)) {
      rows = await db.prepare('SELECT p.*, u.name AS student_name, pr.title AS program_name FROM payments p LEFT JOIN users u ON p.student_id = u.id LEFT JOIN enrollments e ON p.enrollment_id = e.id LEFT JOIN programs pr ON e.program_id = pr.id ORDER BY p.created_at DESC').all();
    } else if (isStudent(req.user)) {
      rows = await db.prepare('SELECT p.*, u.name AS student_name, pr.title AS program_name FROM payments p LEFT JOIN users u ON p.student_id = u.id LEFT JOIN enrollments e ON p.enrollment_id = e.id LEFT JOIN programs pr ON e.program_id = pr.id WHERE p.student_id = ? ORDER BY p.created_at DESC').all(req.user.id);
    } else {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    const outstanding = isAdmin(req.user)
      ? await db.prepare('SELECT SUM(amount - paid_amount) AS total FROM payments WHERE status != ?').get('paid')
      : await db.prepare('SELECT SUM(amount - paid_amount) AS total FROM payments WHERE student_id = ? AND status != ?').get(req.user.id, 'paid');
    res.json({ payments: rows, outstanding: outstanding?.total || 0 });
  } catch (e) { next(e); }
});

router.post('/', authenticate, async (req, res, next) => {
  try {
    if (!isAdmin(req.user)) return res.status(403).json({ error: 'Only admin can create invoices' });
    const { student_id, enrollment_id, amount, due_date, notes } = req.body;
    const invoiceAmount = positiveMoney(amount);
    if (!student_id || !enrollment_id || !invoiceAmount) return res.status(400).json({ error: 'Student, enrollment, and valid amount required' });
    const enrollment = await db.prepare('SELECT * FROM enrollments WHERE id = ? AND student_id = ?').get(enrollment_id, student_id);
    if (!enrollment) return res.status(400).json({ error: 'Enrollment does not belong to this student' });
    const id = uuidv4();
    await db.prepare('INSERT INTO payments (id, student_id, enrollment_id, amount, paid_amount, status, due_date, notes) VALUES (?,?,?,?,0,?,?,?)').run(id, student_id, enrollment_id, invoiceAmount, due_date || null, trimString(notes, 1000));
    await db.saveDb();
    await audit(req.user, 'payment.invoice.create', 'payment', id, `Created invoice for student ${student_id} amount ${invoiceAmount}`);
    const row = await db.prepare('SELECT p.*, u.name AS student_name FROM payments p LEFT JOIN users u ON p.student_id = u.id WHERE p.id = ?').get(id);
    res.json(row);
  } catch (e) { next(e); }
});

router.put('/:id/pay', authenticate, async (req, res, next) => {
  try {
    if (!isAdmin(req.user)) return res.status(403).json({ error: 'Only admins can record payments' });
    const pay = await db.prepare('SELECT * FROM payments WHERE id = ?').get(req.params.id);
    if (!pay) return res.status(404).json({ error: 'Payment not found' });
    const { amount } = req.body;
    const paidAmount = positiveMoney(amount);
    if (!paidAmount) return res.status(400).json({ error: 'Valid amount required' });
    const newPaid = Number(pay.paid_amount || 0) + paidAmount;
    let status = 'pending';
    if (newPaid >= pay.amount) status = newPaid > pay.amount ? 'overpaid' : 'paid';
    else if (newPaid > 0) status = 'partial';
    await db.prepare('UPDATE payments SET paid_amount = ?, status = ?, paid_at = CASE WHEN ? >= amount THEN CURRENT_TIMESTAMP ELSE paid_at END WHERE id = ?').run(newPaid, status, newPaid, req.params.id);
    await db.saveDb();
    await audit(req.user, 'payment.record', 'payment', req.params.id, `Recorded payment ${paidAmount}; total paid ${newPaid}/${pay.amount}`);
    const row = await db.prepare('SELECT p.*, u.name AS student_name FROM payments p LEFT JOIN users u ON p.student_id = u.id WHERE p.id = ?').get(req.params.id);
    res.json(row);
  } catch (e) { next(e); }
});

router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    if (!isAdmin(req.user)) return res.status(403).json({ error: 'Unauthorized' });
    const existing = await db.prepare('SELECT * FROM payments WHERE id = ?').get(req.params.id);
    await db.prepare('DELETE FROM payments WHERE id = ?').run(req.params.id);
    await db.saveDb();
    if (existing) await audit(req.user, 'payment.invoice.delete', 'payment', req.params.id, `Deleted invoice for student ${existing.student_id}`);
    res.json({ message: 'Invoice deleted' });
  } catch (e) { next(e); }
});

module.exports = router;
