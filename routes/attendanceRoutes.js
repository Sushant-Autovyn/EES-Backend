const express = require('express');
const router = express.Router();
const db = require('../config/db');
const verifyToken = require('../middleware/authMiddleware');
const checkRole = require('../middleware/roleMiddleware');


// GET ALL ATTENDANCE (FIXED WITH EMPLOYEE NAME)
router.get('/', verifyToken, checkRole('admin', 'hr', 'employee'), (req, res) => {

  const sql = `
    SELECT 
      attendance.id,
      attendance.employee_id,
      employees.name,
      attendance.status,
      attendance.check_in,
      attendance.check_out
    FROM attendance
    JOIN employees 
    ON attendance.employee_id = employees.id
    ORDER BY attendance.id DESC
  `;

  db.query(sql, (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });

});


// CHECK IN (with once-per-day validation)
router.post('/checkin', verifyToken, checkRole('admin', 'hr', 'employee'), (req, res) => {

  const { employee_id, status } = req.body;

  // Check if already checked in today
  const checkSql = `
    SELECT id FROM attendance 
    WHERE employee_id = ? AND check_in::date = CURRENT_DATE
  `;

  db.query(checkSql, [employee_id], (checkErr, checkResult) => {
    if (checkErr) return res.status(500).json(checkErr);

    if (checkResult.length > 0) {
      return res.status(400).json({ message: 'Already checked in today. Only one check-in per day is allowed.' });
    }

    const sql = `
      INSERT INTO attendance (employee_id, status, check_in)
      VALUES (?, ?, NOW())
    `;

    db.query(sql, [employee_id, status], (err, result) => {
      if (err) return res.status(500).json(err);

      res.json({
        message: "Check-in successful"
      });
    });
  });

});


// CHECK OUT (with once-per-day validation)
router.put('/checkout/:id', verifyToken, checkRole('admin', 'hr', 'employee'), (req, res) => {

  const { id } = req.params;

  // Check if already checked out
  const checkSql = `SELECT check_out FROM attendance WHERE id = ?`;

  db.query(checkSql, [id], (checkErr, checkResult) => {
    if (checkErr) return res.status(500).json(checkErr);

    if (checkResult.length === 0) {
      return res.status(404).json({ message: 'Attendance record not found' });
    }

    if (checkResult[0].check_out) {
      return res.status(400).json({ message: 'Already checked out today. Only one check-out per day is allowed.' });
    }

    const sql = `
      UPDATE attendance
      SET check_out = NOW()
      WHERE id = ?
    `;

    db.query(sql, [id], (err, result) => {
      if (err) return res.status(500).json(err);

      res.json({
        message: "Check-out successful"
      });
    });
  });

});


// MONTHLY REPORT
router.get('/report', verifyToken, checkRole('admin', 'hr'), (req, res) => {

  const { month, year } = req.query;

  const sql = `
    SELECT 
      a.id, a.employee_id, e.name, a.status, a.check_in, a.check_out
    FROM attendance a
    JOIN employees e ON a.employee_id = e.id
    WHERE EXTRACT(MONTH FROM a.check_in) = ? AND EXTRACT(YEAR FROM a.check_in) = ?
    ORDER BY a.check_in DESC
  `;

  db.query(sql, [month, year], (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });

});


// GET MY ATTENDANCE (Employee only)
router.get('/my', verifyToken, (req, res) => {

  const userId = req.user.id;

  const sql = `
    SELECT id, employee_id, status, check_in, check_out
    FROM attendance
    WHERE employee_id = ?
    ORDER BY id DESC
  `;

  db.query(sql, [userId], (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });

});


// GET MY TODAY STATUS (Employee only)
router.get('/my/today', verifyToken, (req, res) => {

  const userId = req.user.id;

  const sql = `
    SELECT id, status, check_in, check_out
    FROM attendance
    WHERE employee_id = ? AND check_in::date = CURRENT_DATE
  `;

  db.query(sql, [userId], (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result.length > 0 ? result[0] : null);
  });

});


// GET CALENDAR DATA (Employee - monthly attendance)
router.get('/calendar', verifyToken, (req, res) => {

  const userId = req.user.id;
  const { month, year } = req.query;

  const sql = `
    SELECT check_in::date AS date, status, check_out
    FROM attendance
    WHERE employee_id = ? 
    AND EXTRACT(MONTH FROM check_in) = ? 
    AND EXTRACT(YEAR FROM check_in) = ?
    ORDER BY check_in ASC
  `;

  db.query(sql, [userId, month, year], (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });

});

module.exports = router;