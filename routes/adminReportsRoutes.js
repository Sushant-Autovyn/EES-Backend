const express = require('express');
const router = express.Router();
const db = require('../config/db');
const verifyToken = require('../middleware/authMiddleware');
const checkRole = require('../middleware/roleMiddleware');

// COMPREHENSIVE ADMIN REPORTS

// EMPLOYEE REPORT
router.get('/employees', verifyToken, checkRole('admin'), (req, res) => {
  const sql = `
    SELECT 
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE status = 'Active') as active,
      COUNT(*) FILTER (WHERE status = 'Inactive') as inactive,
      COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '30 days') as new_this_month,
      COUNT(DISTINCT department) as departments
    FROM employees
  `;
  db.query(sql, (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result[0]);
  });
});

// ATTENDANCE REPORT
router.get('/attendance', verifyToken, checkRole('admin'), (req, res) => {
  const { from, to } = req.query;
  let sql = `
    SELECT 
      check_in::date as date,
      COUNT(*) FILTER (WHERE status = 'Present') as present,
      COUNT(*) FILTER (WHERE status = 'Absent') as absent,
      COUNT(*) FILTER (WHERE status = 'Late') as late
    FROM attendance
  `;
  const params = [];
  if (from && to) {
    sql += ' WHERE check_in::date BETWEEN ? AND ?';
    params.push(from, to);
  } else {
    sql += ' WHERE check_in >= CURRENT_DATE - INTERVAL \'30 days\'';
  }
  sql += ' GROUP BY check_in::date ORDER BY date DESC';
  db.query(sql, params, (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });
});

// PAYROLL REPORT
router.get('/payroll', verifyToken, checkRole('admin'), (req, res) => {
  const sql = `
    SELECT 
      SUM(net_salary) as total_payroll,
      SUM(net_salary) FILTER (WHERE payment_status = 'Paid') as paid,
      SUM(net_salary) FILTER (WHERE payment_status = 'Pending') as pending,
      COUNT(*) as total_records,
      COUNT(DISTINCT employee_id) as unique_employees
    FROM payroll
  `;
  db.query(sql, (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result[0]);
  });
});

// DEPARTMENT REPORT
router.get('/departments', verifyToken, checkRole('admin'), (req, res) => {
  const sql = `
    SELECT 
      COALESCE(e.department, 'Unassigned') as department,
      COUNT(*) as employee_count,
      COUNT(*) FILTER (WHERE e.status = 'Active') as active_count
    FROM employees e
    GROUP BY e.department
    ORDER BY employee_count DESC
  `;
  db.query(sql, (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });
});

// LEAVE REPORT
router.get('/leaves', verifyToken, checkRole('admin'), (req, res) => {
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

// OVERALL SUMMARY
router.get('/summary', verifyToken, checkRole('admin'), (req, res) => {
  const sql = `
    SELECT
      (SELECT COUNT(*) FROM employees) as total_employees,
      (SELECT COUNT(*) FROM employees WHERE status = 'Active') as active_employees,
      (SELECT COUNT(*) FROM users) as total_users,
      (SELECT COUNT(*) FROM departments) as total_departments,
      (SELECT COUNT(*) FROM branches) as total_branches,
      (SELECT COUNT(*) FROM attendance WHERE check_in::date = CURRENT_DATE AND status = 'Present') as present_today,
      (SELECT COUNT(*) FROM leaves_data WHERE status = 'Pending') as pending_leaves,
      (SELECT COALESCE(SUM(net_salary), 0) FROM payroll) as total_payroll,
      (SELECT COUNT(*) FROM recruitment WHERE status = 'Applied') as new_applications,
      (SELECT COUNT(*) FROM announcements) as total_announcements
  `;
  db.query(sql, (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result[0]);
  });
});

module.exports = router;
