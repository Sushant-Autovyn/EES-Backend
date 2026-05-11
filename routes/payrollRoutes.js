const express = require('express');
const router = express.Router();
const db = require('../config/db');
const verifyToken = require('../middleware/authMiddleware');
const checkRole = require('../middleware/roleMiddleware');


// ============ PAYROLL RECORDS ============

// GET ALL PAYROLL RECORDS
router.get('/', verifyToken, checkRole('admin', 'accountant'), (req, res) => {
  const sql = `
    SELECT 
      pr.id,
      pr.employee_id,
      e.name,
      e.department,
      pr.month,
      pr.year,
      pr.working_days,
      pr.present_days,
      pr.leave_days,
      pr.overtime_hours,
      pr.basic_salary,
      pr.hra,
      pr.da,
      pr.ta,
      pr.bonus,
      pr.gross_salary,
      pr.pf_deduction,
      pr.tax_deduction,
      pr.insurance,
      pr.other_deductions,
      pr.total_deductions,
      pr.net_salary,
      pr.payment_status,
      pr.payment_date,
      pr.created_at
    FROM payroll_records pr
    JOIN employees e ON pr.employee_id = e.id
    ORDER BY pr.year DESC, pr.month DESC, e.name ASC
  `;
  db.query(sql, (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });
});

// GENERATE MONTHLY PAYROLL FOR AN EMPLOYEE
router.post('/generate', verifyToken, checkRole('admin', 'accountant'), (req, res) => {
  const { employee_id, month, year } = req.body;

  // 1. Get salary structure
  db.query('SELECT * FROM salary_structure WHERE employee_id = ?', [employee_id], (err, salaryRows) => {
    if (err) return res.status(500).json(err);
    if (salaryRows.length === 0) return res.status(400).json({ message: 'No salary structure found. Please set up salary first.' });

    const sal = salaryRows[0];

    // 2. Count attendance for that month
    const attendSql = `
      SELECT 
        COUNT(*) FILTER (WHERE status = 'Present') as present_days,
        COUNT(*) FILTER (WHERE status = 'Absent') as absent_days
      FROM attendance
      WHERE employee_id = ?
        AND EXTRACT(MONTH FROM check_in) = ?
        AND EXTRACT(YEAR FROM check_in) = ?
    `;
    db.query(attendSql, [employee_id, month, year], (err2, attendRows) => {
      if (err2) return res.status(500).json(err2);

      // 3. Count approved leaves
      const leaveSql = `
        SELECT COUNT(*) as leave_count
        FROM leaves_data
        WHERE employee_id = ?
          AND status = 'Approved'
          AND EXTRACT(MONTH FROM from_date) = ?
          AND EXTRACT(YEAR FROM from_date) = ?
      `;
      db.query(leaveSql, [employee_id, month, year], (err3, leaveRows) => {
        if (err3) return res.status(500).json(err3);

        const presentDays = parseInt(attendRows[0].present_days) || 0;
        const leaveDays = parseInt(leaveRows[0].leave_count) || 0;
        const workingDays = 22; // standard working days

        const basic = parseFloat(sal.basic_salary) || 0;
        const hra = parseFloat(sal.hra) || 0;
        const da = parseFloat(sal.da) || 0;
        const ta = parseFloat(sal.ta) || 0;
        const bonus = parseFloat(sal.bonus) || 0;

        const gross = basic + hra + da + ta + bonus;

        const pf = parseFloat(sal.pf_deduction) || 0;
        const tax = parseFloat(sal.tax_deduction) || 0;
        const insurance = parseFloat(sal.insurance) || 0;
        const otherDed = parseFloat(sal.other_deductions) || 0;
        const totalDeductions = pf + tax + insurance + otherDed;

        const net = gross - totalDeductions;

        const insertSql = `
          INSERT INTO payroll_records 
          (employee_id, month, year, working_days, present_days, leave_days, overtime_hours,
           basic_salary, hra, da, ta, bonus, gross_salary,
           pf_deduction, tax_deduction, insurance, other_deductions, total_deductions, net_salary)
          VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        db.query(insertSql, [
          employee_id, month, year, workingDays, presentDays, leaveDays,
          basic, hra, da, ta, bonus, gross,
          pf, tax, insurance, otherDed, totalDeductions, net
        ], (err4, result) => {
          if (err4) {
            if (err4.code === '23505') return res.status(400).json({ message: 'Payroll already generated for this month' });
            return res.status(500).json(err4);
          }
          res.json({ message: 'Payroll generated successfully', net_salary: net });
        });
      });
    });
  });
});

// PROCESS PAYMENT (mark as paid)
router.put('/pay/:id', verifyToken, checkRole('admin', 'accountant'), (req, res) => {
  const sql = `UPDATE payroll_records SET payment_status = 'Paid', payment_date = CURRENT_TIMESTAMP WHERE id = ?`;
  db.query(sql, [req.params.id], (err, result) => {
    if (err) return res.status(500).json(err);
    res.json({ message: 'Payment processed' });
  });
});


// ============ SALARY STRUCTURE ============

// GET ALL SALARY STRUCTURES
router.get('/salary', verifyToken, checkRole('admin', 'accountant'), (req, res) => {
  const sql = `
    SELECT ss.*, e.name, e.department, e.designation
    FROM salary_structure ss
    JOIN employees e ON ss.employee_id = e.id
    ORDER BY e.name ASC
  `;
  db.query(sql, (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });
});

// GET SALARY BY EMPLOYEE
router.get('/salary/:employeeId', verifyToken, checkRole('admin', 'accountant'), (req, res) => {
  const sql = `
    SELECT ss.*, e.name, e.department, e.designation
    FROM salary_structure ss
    JOIN employees e ON ss.employee_id = e.id
    WHERE ss.employee_id = ?
  `;
  db.query(sql, [req.params.employeeId], (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result[0] || null);
  });
});

// ADD / UPDATE SALARY STRUCTURE
router.post('/salary', verifyToken, checkRole('admin', 'accountant'), (req, res) => {
  const { employee_id, basic_salary, hra, da, ta, bonus, pf_deduction, tax_deduction, insurance, other_deductions } = req.body;

  // Check if exists
  db.query('SELECT id FROM salary_structure WHERE employee_id = ?', [employee_id], (err, rows) => {
    if (err) return res.status(500).json(err);

    if (rows.length > 0) {
      const sql = `
        UPDATE salary_structure SET 
          basic_salary=?, hra=?, da=?, ta=?, bonus=?,
          pf_deduction=?, tax_deduction=?, insurance=?, other_deductions=?,
          updated_at=CURRENT_TIMESTAMP
        WHERE employee_id=?
      `;
      db.query(sql, [basic_salary, hra, da, ta, bonus, pf_deduction, tax_deduction, insurance, other_deductions, employee_id], (err2) => {
        if (err2) return res.status(500).json(err2);
        res.json({ message: 'Salary structure updated' });
      });
    } else {
      const sql = `
        INSERT INTO salary_structure (employee_id, basic_salary, hra, da, ta, bonus, pf_deduction, tax_deduction, insurance, other_deductions)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      db.query(sql, [employee_id, basic_salary, hra, da, ta, bonus, pf_deduction, tax_deduction, insurance, other_deductions], (err2) => {
        if (err2) return res.status(500).json(err2);
        res.json({ message: 'Salary structure added' });
      });
    }
  });
});


// ============ PAYSLIP ============

// GET PAYSLIP DATA
router.get('/payslip/:id', verifyToken, checkRole('admin', 'accountant'), (req, res) => {
  const sql = `
    SELECT 
      pr.*,
      e.name, e.email, e.department, e.designation, e.phone
    FROM payroll_records pr
    JOIN employees e ON pr.employee_id = e.id
    WHERE pr.id = ?
  `;
  db.query(sql, [req.params.id], (err, result) => {
    if (err) return res.status(500).json(err);
    if (result.length === 0) return res.status(404).json({ message: 'Payslip not found' });
    res.json(result[0]);
  });
});


// ============ ATTENDANCE-BASED SALARY VIEW ============

// GET ATTENDANCE SUMMARY FOR PAYROLL
router.get('/attendance-summary', verifyToken, checkRole('admin', 'accountant'), (req, res) => {
  const { month, year } = req.query;
  const m = month || (new Date().getMonth() + 1);
  const y = year || new Date().getFullYear();

  const sql = `
    SELECT 
      e.id as employee_id,
      e.name,
      e.department,
      COUNT(a.id) FILTER (WHERE a.status = 'Present') as present_days,
      COUNT(a.id) FILTER (WHERE a.status = 'Absent') as absent_days,
      COALESCE(SUM(
        CASE WHEN a.check_out IS NOT NULL 
          THEN GREATEST(EXTRACT(EPOCH FROM (a.check_out - a.check_in))/3600 - 8, 0)
          ELSE 0 
        END
      ), 0) as overtime_hours,
      (SELECT COUNT(*) FROM leaves_data l 
       WHERE l.employee_id = e.id 
       AND l.status = 'Approved' 
       AND EXTRACT(MONTH FROM l.from_date) = ?
       AND EXTRACT(YEAR FROM l.from_date) = ?) as approved_leaves
    FROM employees e
    LEFT JOIN attendance a ON e.id = a.employee_id 
      AND EXTRACT(MONTH FROM a.check_in) = ?
      AND EXTRACT(YEAR FROM a.check_in) = ?
    WHERE e.status = 'Active'
    GROUP BY e.id, e.name, e.department
    ORDER BY e.name ASC
  `;
  db.query(sql, [m, y, m, y], (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });
});


// ============ FINANCIAL REPORTS ============

router.get('/reports/summary', verifyToken, checkRole('admin', 'accountant'), (req, res) => {
  const { month, year } = req.query;
  const m = month || (new Date().getMonth() + 1);
  const y = year || new Date().getFullYear();

  const sql = `
    SELECT 
      COALESCE(SUM(net_salary), 0) as total_payroll,
      COALESCE(SUM(gross_salary), 0) as total_gross,
      COALESCE(SUM(total_deductions), 0) as total_deductions,
      COALESCE(SUM(bonus), 0) as total_bonus,
      COUNT(*) as employee_count,
      COUNT(*) FILTER (WHERE payment_status = 'Paid') as paid_count,
      COUNT(*) FILTER (WHERE payment_status = 'Pending') as pending_count
    FROM payroll_records
    WHERE month = ? AND year = ?
  `;
  db.query(sql, [m, y], (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result[0]);
  });
});

router.get('/reports/department', verifyToken, checkRole('admin', 'accountant'), (req, res) => {
  const { month, year } = req.query;
  const m = month || (new Date().getMonth() + 1);
  const y = year || new Date().getFullYear();

  const sql = `
    SELECT 
      e.department,
      COUNT(pr.id) as employee_count,
      COALESCE(SUM(pr.gross_salary), 0) as total_gross,
      COALESCE(SUM(pr.net_salary), 0) as total_net,
      COALESCE(SUM(pr.total_deductions), 0) as total_deductions
    FROM payroll_records pr
    JOIN employees e ON pr.employee_id = e.id
    WHERE pr.month = ? AND pr.year = ?
    GROUP BY e.department
    ORDER BY total_net DESC
  `;
  db.query(sql, [m, y], (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });
});


// ============ EMPLOYEES LIST (for dropdowns) ============

router.get('/employees/list', verifyToken, checkRole('admin', 'accountant'), (req, res) => {
  db.query('SELECT id, name, department, designation FROM employees WHERE status = ? ORDER BY name', ['Active'], (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });
});


module.exports = router;