const express = require('express');
const router = express.Router();
const db = require('../config/db');
const verifyToken = require('../middleware/authMiddleware');
const checkRole = require('../middleware/roleMiddleware');

// GET AUDIT LOGS
router.get('/', verifyToken, checkRole('admin'), (req, res) => {
  const { limit, action, user_email } = req.query;
  let sql = 'SELECT * FROM audit_logs';
  const params = [];
  const conditions = [];

  if (action) { conditions.push('action ILIKE ?'); params.push('%' + action + '%'); }
  if (user_email) { conditions.push('user_email ILIKE ?'); params.push('%' + user_email + '%'); }
  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY created_at DESC LIMIT ?';
  params.push(parseInt(limit) || 100);

  db.query(sql, params, (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });
});

// HELPER: LOG AN ACTION (used by other routes)
router.logAction = function(userId, email, action, details, ip) {
  const sql = 'INSERT INTO audit_logs (user_id, user_email, action, details, ip_address) VALUES (?, ?, ?, ?, ?)';
  db.query(sql, [userId, email, action, details, ip || ''], () => {});
};

// CLEAR OLD LOGS (older than 90 days)
router.delete('/clear-old', verifyToken, checkRole('admin'), (req, res) => {
  const sql = "DELETE FROM audit_logs WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '90 days'";
  db.query(sql, (err, result) => {
    if (err) return res.status(500).json(err);
    res.json({ message: 'Old logs cleared', deleted: result.affectedRows || 0 });
  });
});

module.exports = router;
