const express = require('express');
const router = express.Router();
const db = require('../config/db');
const verifyToken = require('../middleware/authMiddleware');
const checkRole = require('../middleware/roleMiddleware');

// GET ALL ANNOUNCEMENTS
router.get('/', verifyToken, (req, res) => {
  const userRole = req.user.role;
  const sql = `SELECT * FROM announcements WHERE target_role = 'all' OR target_role = ? ORDER BY created_at DESC LIMIT 50`;
  db.query(sql, [userRole], (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });
});

// CREATE ANNOUNCEMENT (admin only)
router.post('/', verifyToken, checkRole('admin'), (req, res) => {
  const { title, message, target_role, priority } = req.body;
  const role = target_role || 'all';
  const sql = 'INSERT INTO announcements (title, message, target_role, priority, created_by) VALUES (?, ?, ?, ?, ?)';
  db.query(sql, [title, message, role, priority || 'Normal', req.user.id], (err) => {
    if (err) return res.status(500).json(err);

    // Also push to notifications so it appears in the bell for targeted users.
    // If target_role is 'all', create a notification for every common role.
    const notifTitle = `[Announcement] ${title}`;
    const notifSql = `INSERT INTO notifications (user_role, title, message) VALUES (?, ?, ?)`;
    const targets = role === 'all'
      ? ['admin', 'hr', 'employee', 'accountant']
      : [role];

    targets.forEach(r => {
      db.query(notifSql, [r, notifTitle, message], (nErr) => {
        if (nErr) console.log('Announcement notification error:', nErr.message);
      });
    });

    res.json({ message: 'Announcement created' });
  });
});

// DELETE ANNOUNCEMENT
router.delete('/:id', verifyToken, checkRole('admin'), (req, res) => {
  db.query('DELETE FROM announcements WHERE id = ?', [req.params.id], (err) => {
    if (err) return res.status(500).json(err);
    res.json({ message: 'Announcement deleted' });
  });
});

module.exports = router;
