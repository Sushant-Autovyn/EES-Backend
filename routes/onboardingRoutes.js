const express = require('express');
const router = express.Router();
const db = require('../config/db');
const verifyToken = require('../middleware/authMiddleware');
const checkRole = require('../middleware/roleMiddleware');

// ============ ONBOARDING ============

// GET ONBOARDING TASKS FOR EMPLOYEE
router.get('/employee/:id', verifyToken, checkRole('admin', 'hr'), (req, res) => {
  const sql = `SELECT * FROM onboarding WHERE employee_id = ? ORDER BY created_at ASC`;
  db.query(sql, [req.params.id], (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });
});

// GET ALL RECENT ONBOARDING
router.get('/', verifyToken, checkRole('admin', 'hr'), (req, res) => {
  const sql = `
    SELECT o.*, e.name as employee_name, e.department
    FROM onboarding o
    JOIN employees e ON o.employee_id = e.id
    ORDER BY o.created_at DESC
    LIMIT 50
  `;
  db.query(sql, (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });
});

// ADD ONBOARDING STEP
router.post('/', verifyToken, checkRole('admin', 'hr'), (req, res) => {
  const { employee_id, step } = req.body;
  const sql = `INSERT INTO onboarding (employee_id, step, assigned_by) VALUES (?, ?, ?)`;
  db.query(sql, [employee_id, step, req.user.id], (err) => {
    if (err) return res.status(500).json(err);
    res.json({ message: 'Onboarding step added' });
  });
});

// COMPLETE STEP
router.put('/complete/:id', verifyToken, checkRole('admin', 'hr'), (req, res) => {
  const sql = `UPDATE onboarding SET status = 'Completed', completed_at = CURRENT_TIMESTAMP WHERE id = ?`;
  db.query(sql, [req.params.id], (err) => {
    if (err) return res.status(500).json(err);
    res.json({ message: 'Step completed' });
  });
});

// INITIALIZE DEFAULT ONBOARDING FOR NEW EMPLOYEE
router.post('/init/:employeeId', verifyToken, checkRole('admin', 'hr'), (req, res) => {
  const empId = req.params.employeeId;
  const steps = [
    'Personal Details Collected',
    'Department Assigned',
    'Role Assigned',
    'Bank Details Updated',
    'ID Card Generated',
    'Documents Uploaded',
    'System Access Granted',
    'Welcome Email Sent'
  ];
  const sql = `INSERT INTO onboarding (employee_id, step, assigned_by) VALUES (?, ?, ?)`;
  let completed = 0;
  steps.forEach(step => {
    db.query(sql, [empId, step, req.user.id], () => {
      completed++;
      if (completed === steps.length) {
        res.json({ message: 'Onboarding initialized with ' + steps.length + ' steps' });
      }
    });
  });
});

// DELETE STEP
router.delete('/:id', verifyToken, checkRole('admin', 'hr'), (req, res) => {
  db.query('DELETE FROM onboarding WHERE id = ?', [req.params.id], (err) => {
    if (err) return res.status(500).json(err);
    res.json({ message: 'Step deleted' });
  });
});

module.exports = router;
