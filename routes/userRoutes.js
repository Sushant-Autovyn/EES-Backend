const express = require('express');
const router = express.Router();
const db = require('../config/db');
const bcrypt = require('bcryptjs');
const verifyToken = require('../middleware/authMiddleware');
const checkRole = require('../middleware/roleMiddleware');

// GET ALL USERS
router.get('/', verifyToken, checkRole('admin'), (req, res) => {
  db.query('SELECT id, name, email, role, created_at FROM users ORDER BY id DESC', (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });
});

// CREATE USER
router.post('/', verifyToken, checkRole('admin'), async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const sql = 'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)';
    db.query(sql, [name, email, hashedPassword, role], (err) => {
      if (err) {
        if (err.code === '23505') return res.status(400).json({ message: 'Email already exists' });
        return res.status(500).json(err);
      }
      res.json({ message: 'User created successfully' });
    });
  } catch (e) {
    res.status(500).json(e);
  }
});

// UPDATE USER
router.put('/:id', verifyToken, checkRole('admin'), (req, res) => {
  const { name, email, role } = req.body;
  const sql = 'UPDATE users SET name = ?, email = ?, role = ? WHERE id = ?';
  db.query(sql, [name, email, role, req.params.id], (err) => {
    if (err) return res.status(500).json(err);
    res.json({ message: 'User updated successfully' });
  });
});

// DEACTIVATE USER (soft - change role to 'inactive')
router.put('/deactivate/:id', verifyToken, checkRole('admin'), (req, res) => {
  if (parseInt(req.params.id) === req.user.id) {
    return res.status(400).json({ message: 'Cannot deactivate yourself' });
  }
  const sql = "UPDATE users SET role = 'inactive' WHERE id = ?";
  db.query(sql, [req.params.id], (err) => {
    if (err) return res.status(500).json(err);
    res.json({ message: 'User deactivated' });
  });
});

// ACTIVATE USER
router.put('/activate/:id', verifyToken, checkRole('admin'), (req, res) => {
  const { role } = req.body;
  const sql = 'UPDATE users SET role = ? WHERE id = ?';
  db.query(sql, [role || 'employee', req.params.id], (err) => {
    if (err) return res.status(500).json(err);
    res.json({ message: 'User activated' });
  });
});

// RESET PASSWORD
router.put('/reset-password/:id', verifyToken, checkRole('admin'), async (req, res) => {
  try {
    const { newPassword } = req.body;
    const hashedPassword = await bcrypt.hash(newPassword || 'Password@123', 10);
    const sql = 'UPDATE users SET password = ? WHERE id = ?';
    db.query(sql, [hashedPassword, req.params.id], (err) => {
      if (err) return res.status(500).json(err);
      res.json({ message: 'Password reset successfully' });
    });
  } catch (e) {
    res.status(500).json(e);
  }
});

// DELETE USER
router.delete('/:id', verifyToken, checkRole('admin'), (req, res) => {
  if (parseInt(req.params.id) === req.user.id) {
    return res.status(400).json({ message: 'Cannot delete yourself' });
  }
  db.query('DELETE FROM users WHERE id = ?', [req.params.id], (err) => {
    if (err) return res.status(500).json(err);
    res.json({ message: 'User deleted' });
  });
});

module.exports = router;
