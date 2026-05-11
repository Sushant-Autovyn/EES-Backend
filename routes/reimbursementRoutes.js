const express = require('express');
const router = express.Router();
const db = require('../config/db');
const verifyToken = require('../middleware/authMiddleware');
const checkRole = require('../middleware/roleMiddleware');

// GET ALL REIMBURSEMENTS
router.get('/', verifyToken, checkRole('admin', 'accountant'), (req, res) => {
  const sql = `
    SELECT r.*, e.name, e.department
    FROM reimbursements r
    JOIN employees e ON r.employee_id = e.id
    ORDER BY r.created_at DESC
  `;
  db.query(sql, (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });
});

// GET MY REIMBURSEMENTS (employee)
router.get('/my', verifyToken, (req, res) => {
  const sql = `
    SELECT r.*, e.name
    FROM reimbursements r
    JOIN employees e ON r.employee_id = e.id
    WHERE r.employee_id = ?
    ORDER BY r.created_at DESC
  `;
  db.query(sql, [req.user.id], (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });
});

// SUBMIT REIMBURSEMENT
router.post('/', verifyToken, (req, res) => {
  const { employee_id, type, amount, description } = req.body;
  const sql = `
    INSERT INTO reimbursements (employee_id, type, amount, description)
    VALUES (?, ?, ?, ?)
  `;
  db.query(sql, [employee_id || req.user.id, type, amount, description], (err, result) => {
    if (err) return res.status(500).json(err);
    res.json({ message: 'Reimbursement submitted' });
  });
});

// APPROVE REIMBURSEMENT
router.put('/approve/:id', verifyToken, checkRole('admin', 'accountant'), (req, res) => {
  const sql = `UPDATE reimbursements SET status = 'Approved', approved_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
  db.query(sql, [req.user.id, req.params.id], (err) => {
    if (err) return res.status(500).json(err);
    res.json({ message: 'Reimbursement approved' });
  });
});

// REJECT REIMBURSEMENT
router.put('/reject/:id', verifyToken, checkRole('admin', 'accountant'), (req, res) => {
  const sql = `UPDATE reimbursements SET status = 'Rejected', approved_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
  db.query(sql, [req.user.id, req.params.id], (err) => {
    if (err) return res.status(500).json(err);
    res.json({ message: 'Reimbursement rejected' });
  });
});

// GET REIMBURSEMENT SUMMARY
router.get('/summary', verifyToken, checkRole('admin', 'accountant'), (req, res) => {
  const sql = `
    SELECT 
      COALESCE(SUM(amount) FILTER (WHERE status = 'Approved'), 0) as total_approved,
      COALESCE(SUM(amount) FILTER (WHERE status = 'Pending'), 0) as total_pending,
      COALESCE(SUM(amount) FILTER (WHERE status = 'Rejected'), 0) as total_rejected,
      COUNT(*) FILTER (WHERE status = 'Pending') as pending_count,
      COUNT(*) as total_count
    FROM reimbursements
  `;
  db.query(sql, (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result[0]);
  });
});

module.exports = router;
