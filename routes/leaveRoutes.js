const express = require('express');
const router = express.Router();
const db = require('../config/db');
const verifyToken = require('../middleware/authMiddleware');
const checkRole = require('../middleware/roleMiddleware');


// GET LEAVES (FIXED)
router.get('/', verifyToken, checkRole('admin', 'hr', 'employee'), (req, res) => {

  let sql = `
    SELECT 
      leaves_data.id,
      leaves_data.employee_id,
      employees.name,
      leaves_data.leave_type,
      leaves_data.from_date,
      leaves_data.to_date,
      leaves_data.reason,
      leaves_data.status,
      leaves_data.created_at
    FROM leaves_data
    JOIN employees 
    ON leaves_data.employee_id = employees.id
  `;

  const params = [];

  // Employee can only see their own leaves
  if (req.user.role === 'employee') {
    sql += ` WHERE leaves_data.employee_id = (SELECT id FROM employees WHERE user_id = ? LIMIT 1)`;
    params.push(req.user.id);
  }

  sql += ` ORDER BY leaves_data.id DESC`;

  db.query(sql, params, (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });

});


// APPLY LEAVE
router.post('/', verifyToken, (req, res) => {

  let { employee_id, leave_type, from_date, to_date, reason } = req.body;

  if (!leave_type || !from_date || !to_date) {
    return res.status(400).json({ message: 'Please fill all required fields (leave type, from date, to date)' });
  }

  const doInsert = (empId) => {
    const sql = `
      INSERT INTO leaves_data (employee_id, leave_type, from_date, to_date, reason, status)
      VALUES (?, ?, ?, ?, ?, 'Pending')
    `;
    db.query(sql, [empId, leave_type, from_date, to_date, reason], (err, result) => {
      if (err) {
        console.log('Leave apply error:', err);
        return res.status(500).json({ message: 'Failed to apply leave' });
      }
      res.json({ message: "Leave applied successfully" });
    });
  };

  if (req.user.role === 'employee') {
    db.query('SELECT id FROM employees WHERE user_id = ? LIMIT 1', [req.user.id], (err, empResult) => {
      if (err) return res.status(500).json({ message: 'Server error' });
      if (!empResult.length) return res.status(404).json({ message: 'Employee profile not found' });
      doInsert(empResult[0].id);
    });
  } else {
    if (!employee_id) return res.status(400).json({ message: 'Please select an employee' });
    doInsert(employee_id);
  }

});


// APPROVE LEAVE
router.put('/approve/:id', verifyToken, checkRole('admin', 'hr'), (req, res) => {

  const { id } = req.params;

  const sql = `
    UPDATE leaves_data
    SET status='Approved'
    WHERE id=?
  `;

  db.query(sql, [id], (err, result) => {
    if (err) return res.status(500).json(err);

    // Get leave details for notification
    db.query('SELECT l.*, e.name FROM leaves_data l JOIN employees e ON l.employee_id = e.id WHERE l.id = ?', [id], (err2, leaveData) => {
      if (!err2 && leaveData.length > 0) {
        const leave = leaveData[0];
        const approvedBy = req.user.role.toUpperCase();
        const notifSql = `INSERT INTO notifications (user_role, title, message) VALUES (?, ?, ?)`;
        
        // Notify admin
        if (req.user.role === 'hr') {
          db.query(notifSql, ['admin', 'Leave Approved by HR', `${leave.name}'s ${leave.leave_type} leave has been approved by HR.`], () => {});
        }
        // Notify the employee
        // We use 'employee' role but in real app you'd target specific user
      }
    });

    res.json({
      message: "Leave approved"
    });
  });

});


// GET LEAVE BALANCE FOR EMPLOYEE
router.get('/balance', verifyToken, (req, res) => {
  const employeeId = req.user.id;
  const year = new Date().getFullYear();

  // Total allocation per year
  const allocation = {
    Sick: 6,
    Casual: 6,
    Emergency: 3,
    Special: 2
  };

  // Count approved leaves by type for current year
  const sql = `
    SELECT leave_type, COUNT(*) as used
    FROM leaves_data
    WHERE employee_id = ?
      AND status = 'Approved'
      AND EXTRACT(YEAR FROM from_date) = ?
    GROUP BY leave_type
  `;

  db.query(sql, [employeeId, year], (err, result) => {
    if (err) return res.status(500).json(err);

    const usedMap = {};
    result.forEach(r => { usedMap[r.leave_type] = parseInt(r.used); });

    const balance = Object.keys(allocation).map(type => ({
      type,
      total: allocation[type],
      used: usedMap[type] || 0,
      remaining: allocation[type] - (usedMap[type] || 0)
    }));

    res.json(balance);
  });
});


// REJECT LEAVE
router.put('/reject/:id', verifyToken, checkRole('admin', 'hr'), (req, res) => {

  const { id } = req.params;

  const sql = `
    UPDATE leaves_data
    SET status='Rejected'
    WHERE id=?
  `;

  db.query(sql, [id], (err, result) => {
    if (err) return res.status(500).json(err);

    // Get leave details for notification
    db.query('SELECT l.*, e.name FROM leaves_data l JOIN employees e ON l.employee_id = e.id WHERE l.id = ?', [id], (err2, leaveData) => {
      if (!err2 && leaveData.length > 0) {
        const leave = leaveData[0];
        const notifSql = `INSERT INTO notifications (user_role, title, message) VALUES (?, ?, ?)`;
        
        if (req.user.role === 'hr') {
          db.query(notifSql, ['admin', 'Leave Rejected by HR', `${leave.name}'s ${leave.leave_type} leave has been rejected by HR.`], () => {});
        }
      }
    });

    res.json({
      message: "Leave rejected"
    });
  });

});

module.exports = router;