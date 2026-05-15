const express = require('express');
const router = express.Router();

const db = require('../config/db');

const verifyToken = require('../middleware/authMiddleware');
const checkRole = require('../middleware/roleMiddleware');


// DASHBOARD STATS - ADMIN
router.get(
  '/stats',
  verifyToken,
  checkRole('admin'),
  async (req, res) => {

    try {

      // TOTAL EMPLOYEES
      const totalEmployeesQuery =
        'SELECT COUNT(*) AS totalEmployees FROM employees';

      // TOTAL PRESENT
      const presentEmployeesQuery =
        "SELECT COUNT(*) AS presentEmployees FROM attendance WHERE status='Present' AND check_in::date = CURRENT_DATE";

      // PENDING LEAVES
      const pendingLeavesQuery =
        "SELECT COUNT(*) AS pendingLeaves FROM leaves_data WHERE status='Pending'";

      // TOTAL PAYROLL
      const payrollQuery =
        'SELECT SUM(net_salary) AS totalPayroll FROM payroll';

      // TOTAL ROLES
      const rolesQuery =
        'SELECT COUNT(*) AS totalRoles FROM roles';

      // TOTAL USERS
      const usersQuery =
        'SELECT COUNT(*) AS totalUsers FROM users';

      const safeQuery = (sql) => {
        return new Promise((resolve) => {
          db.query(sql, (err, result) => {
            if (err) {
              console.log('Dashboard query warning:', err.message);
              resolve([{}]);
            } else {
              resolve(result);
            }
          });
        });
      };

      const [employeeResult, attendanceResult, leaveResult, payrollResult, rolesResult, usersResult, recentResult] = await Promise.all([
        safeQuery(totalEmployeesQuery),
        safeQuery(presentEmployeesQuery),
        safeQuery(pendingLeavesQuery),
        safeQuery(payrollQuery),
        safeQuery(rolesQuery),
        safeQuery(usersQuery),
        safeQuery('SELECT e.name, a.status, a.check_in FROM attendance a JOIN employees e ON a.employee_id = e.id ORDER BY a.id DESC LIMIT 5')
      ]);

      res.json({
        totalEmployees: employeeResult[0]?.totalEmployees || 0,
        presentEmployees: attendanceResult[0]?.presentEmployees || 0,
        pendingLeaves: leaveResult[0]?.pendingLeaves || 0,
        totalPayroll: payrollResult[0]?.totalPayroll || 0,
        totalRoles: rolesResult[0]?.totalRoles || 0,
        totalUsers: usersResult[0]?.totalUsers || 0,
        recentAttendance: recentResult || []
      });

    } catch (error) {
      res.status(500).json(error);
    }
  }
);


// DASHBOARD STATS - EMPLOYEE
router.get(
  '/stats/employee',
  verifyToken,
  checkRole('employee'),
  async (req, res) => {
    try {
      const userId = req.user.id;

      const myAttendanceQuery =
        "SELECT COUNT(*) AS totalPresent FROM attendance WHERE employee_id=? AND status='Present'";

      const myLeavesQuery =
        "SELECT COUNT(*) AS totalLeaves FROM leaves_data WHERE employee_id=?";

      const myPendingLeavesQuery =
        "SELECT COUNT(*) AS pendingLeaves FROM leaves_data WHERE employee_id=? AND status='Pending'";

      const myApprovedLeavesQuery =
        "SELECT COUNT(*) AS approvedLeaves FROM leaves_data WHERE employee_id=? AND status='Approved'";

      const myRecentAttendanceQuery =
        "SELECT status, check_in, check_out FROM attendance WHERE employee_id=? ORDER BY id DESC LIMIT 5";

      db.query(myAttendanceQuery, [userId], (err1, attendanceResult) => {
        if (err1) return res.status(500).json(err1);

        db.query(myLeavesQuery, [userId], (err2, leavesResult) => {
          if (err2) return res.status(500).json(err2);

          db.query(myPendingLeavesQuery, [userId], (err3, pendingResult) => {
            if (err3) return res.status(500).json(err3);

            db.query(myApprovedLeavesQuery, [userId], (err4, approvedResult) => {
              if (err4) return res.status(500).json(err4);

              db.query(myRecentAttendanceQuery, [userId], (err5, recentResult) => {
                if (err5) return res.status(500).json(err5);

                res.json({
                  totalPresent: attendanceResult[0].totalPresent,
                  totalLeaves: leavesResult[0].totalLeaves,
                  pendingLeaves: pendingResult[0].pendingLeaves,
                  approvedLeaves: approvedResult[0].approvedLeaves,
                  recentAttendance: recentResult
                });
              });
            });
          });
        });
      });
    } catch (error) {
      res.status(500).json(error);
    }
  }
);


// DASHBOARD STATS - HR
router.get(
  '/stats/hr',
  verifyToken,
  checkRole('hr'),
  async (req, res) => {
    try {
      const totalEmployeesQuery =
        'SELECT COUNT(*) AS totalEmployees FROM employees';

      const presentTodayQuery =
        "SELECT COUNT(*) AS presentToday FROM attendance WHERE status='Present' AND check_in::date = CURRENT_DATE";

      const pendingLeavesQuery =
        "SELECT COUNT(*) AS pendingLeaves FROM leaves_data WHERE status='Pending'";

      const absentTodayQuery =
        "SELECT COUNT(*) AS absentToday FROM attendance WHERE status='Absent' AND check_in::date = CURRENT_DATE";

      const recentLeavesQuery =
        "SELECT l.leave_type, l.status, l.from_date, l.to_date, e.name FROM leaves_data l JOIN employees e ON l.employee_id = e.id ORDER BY l.id DESC LIMIT 5";

      db.query(totalEmployeesQuery, (err1, empResult) => {
        if (err1) return res.status(500).json(err1);

        db.query(presentTodayQuery, (err2, presentResult) => {
          if (err2) return res.status(500).json(err2);

          db.query(pendingLeavesQuery, (err3, pendingResult) => {
            if (err3) return res.status(500).json(err3);

            db.query(absentTodayQuery, (err4, absentResult) => {
              if (err4) return res.status(500).json(err4);

              db.query(recentLeavesQuery, (err5, recentResult) => {
                if (err5) return res.status(500).json(err5);

                res.json({
                  totalEmployees: empResult[0].totalEmployees,
                  presentToday: presentResult[0].presentToday,
                  pendingLeaves: pendingResult[0].pendingLeaves,
                  absentToday: absentResult[0].absentToday,
                  recentLeaves: recentResult
                });
              });
            });
          });
        });
      });
    } catch (error) {
      res.status(500).json(error);
    }
  }
);


// DASHBOARD STATS - ACCOUNTANT
router.get(
  '/stats/accountant',
  verifyToken,
  checkRole('accountant'),
  async (req, res) => {
    try {
      const totalPayrollQuery =
        'SELECT SUM(net_salary) AS totalPayroll FROM payroll';

      const paidQuery =
        "SELECT COUNT(*) AS paidCount, SUM(net_salary) AS paidAmount FROM payroll WHERE payment_status='Paid'";

      const pendingQuery =
        "SELECT COUNT(*) AS pendingCount, SUM(net_salary) AS pendingAmount FROM payroll WHERE payment_status='Pending'";

      const totalEmployeesQuery =
        'SELECT COUNT(*) AS totalEmployees FROM employees';

      const recentPayrollQuery =
        "SELECT p.id, e.name, p.net_salary, p.payment_status FROM payroll p JOIN employees e ON p.employee_id = e.id ORDER BY p.id DESC LIMIT 5";

      db.query(totalPayrollQuery, (err1, totalResult) => {
        if (err1) return res.status(500).json(err1);

        db.query(paidQuery, (err2, paidResult) => {
          if (err2) return res.status(500).json(err2);

          db.query(pendingQuery, (err3, pendingResult) => {
            if (err3) return res.status(500).json(err3);

            db.query(totalEmployeesQuery, (err4, empResult) => {
              if (err4) return res.status(500).json(err4);

              db.query(recentPayrollQuery, (err5, recentResult) => {
                if (err5) return res.status(500).json(err5);

                res.json({
                  totalPayroll: totalResult[0].totalPayroll || 0,
                  paidCount: paidResult[0].paidCount,
                  paidAmount: paidResult[0].paidAmount || 0,
                  pendingCount: pendingResult[0].pendingCount,
                  pendingAmount: pendingResult[0].pendingAmount || 0,
                  totalEmployees: empResult[0].totalEmployees,
                  recentPayroll: recentResult
                });
              });
            });
          });
        });
      });
    } catch (error) {
      res.status(500).json(error);
    }
  }
);


module.exports = router;