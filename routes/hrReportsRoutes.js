const express = require('express');
const router = express.Router();
const db = require('../config/db');
const verifyToken = require('../middleware/authMiddleware');
const checkRole = require('../middleware/roleMiddleware');

// ============ HR REPORTS / ANALYTICS ============

// MAIN SUMMARY
router.get('/summary', verifyToken, checkRole('admin', 'hr'), (req, res) => {
  const sql = `
    SELECT 
      (SELECT COUNT(*) FROM employees WHERE status = 'Active') as total_employees,
      (SELECT COUNT(*) FROM employees WHERE status = 'Inactive') as inactive_employees,
      (SELECT COUNT(DISTINCT department) FROM employees WHERE department IS NOT NULL) as department_count,
      (SELECT COUNT(*) FROM leaves_data WHERE status = 'Pending') as pending_leaves,
      (SELECT COUNT(*) FROM leaves_data WHERE status = 'Approved') as approved_leaves,
      (SELECT COUNT(*) FROM recruitment WHERE status = 'Applied') as new_applications,
      (SELECT COUNT(*) FROM attendance WHERE check_in::date = CURRENT_DATE) as today_present
  `;
  db.query(sql, (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result[0]);
  });
});

// DEPARTMENT DISTRIBUTION
router.get('/departments', verifyToken, checkRole('admin', 'hr'), (req, res) => {
  const sql = `
    SELECT 
      COALESCE(department, 'Unassigned') as department,
      COUNT(*) as count,
      COUNT(*) FILTER (WHERE status = 'Active') as active_count
    FROM employees
    GROUP BY department
    ORDER BY count DESC
  `;
  db.query(sql, (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });
});

// ATTENDANCE TRENDS (last 7 days)
router.get('/attendance-trend', verifyToken, checkRole('admin', 'hr'), (req, res) => {
  const sql = `
    SELECT 
      check_in::date as date,
      COUNT(*) FILTER (WHERE status = 'Present') as present,
      COUNT(*) FILTER (WHERE status = 'Absent') as absent
    FROM attendance
    WHERE check_in >= CURRENT_DATE - INTERVAL '7 days'
    GROUP BY check_in::date
    ORDER BY date ASC
  `;
  db.query(sql, (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });
});

// LEAVE STATISTICS
router.get('/leave-stats', verifyToken, checkRole('admin', 'hr'), (req, res) => {
  const sql = `
    SELECT 
      leave_type,
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE status = 'Approved') as approved,
      COUNT(*) FILTER (WHERE status = 'Pending') as pending,
      COUNT(*) FILTER (WHERE status = 'Rejected') as rejected
    FROM leaves_data
    GROUP BY leave_type
    ORDER BY total DESC
  `;
  db.query(sql, (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });
});

// RECENT JOININGS
router.get('/recent-joinings', verifyToken, checkRole('admin', 'hr'), (req, res) => {
  const sql = `
    SELECT id, name, department, designation, created_at
    FROM employees
    WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
    ORDER BY created_at DESC
    LIMIT 10
  `;
  db.query(sql, (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });
});

module.exports = router;
