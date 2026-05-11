const express = require('express');
const router = express.Router();
const db = require('../config/db');
const verifyToken = require('../middleware/authMiddleware');


// GET NOTIFICATIONS FOR USER'S ROLE
router.get('/', verifyToken, (req, res) => {
  const userRole = req.user.role;

  const sql = `
    SELECT * FROM notifications 
    WHERE user_role = ? 
    ORDER BY created_at DESC 
    LIMIT 20
  `;

  db.query(sql, [userRole], (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });
});


// GET UNREAD COUNT
router.get('/unread-count', verifyToken, (req, res) => {
  const userRole = req.user.role;

  const sql = `
    SELECT COUNT(*) AS count FROM notifications 
    WHERE user_role = ? AND is_read = 0
  `;

  db.query(sql, [userRole], (err, result) => {
    if (err) return res.status(500).json(err);
    res.json({ count: result[0].count });
  });
});


// MARK AS READ
router.put('/read/:id', verifyToken, (req, res) => {
  const sql = `UPDATE notifications SET is_read = 1 WHERE id = ?`;

  db.query(sql, [req.params.id], (err, result) => {
    if (err) return res.status(500).json(err);
    res.json({ message: 'Marked as read' });
  });
});


// MARK ALL AS READ
router.put('/read-all', verifyToken, (req, res) => {
  const sql = `UPDATE notifications SET is_read = 1 WHERE user_role = ?`;

  db.query(sql, [req.user.role], (err, result) => {
    if (err) return res.status(500).json(err);
    res.json({ message: 'All marked as read' });
  });
});


module.exports = router;
