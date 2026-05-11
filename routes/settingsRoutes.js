const express = require('express');
const router = express.Router();
const db = require('../config/db');
const verifyToken = require('../middleware/authMiddleware');
const checkRole = require('../middleware/roleMiddleware');

// GET ALL SETTINGS
router.get('/', verifyToken, checkRole('admin'), (req, res) => {
  db.query('SELECT * FROM system_settings ORDER BY category, setting_key', (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });
});

// GET SETTINGS BY CATEGORY
router.get('/category/:cat', verifyToken, checkRole('admin'), (req, res) => {
  db.query('SELECT * FROM system_settings WHERE category = ? ORDER BY setting_key', [req.params.cat], (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });
});

// UPDATE SETTING
router.put('/:id', verifyToken, checkRole('admin'), (req, res) => {
  const { setting_value } = req.body;
  const sql = 'UPDATE system_settings SET setting_value = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
  db.query(sql, [setting_value, req.user.id, req.params.id], (err) => {
    if (err) return res.status(500).json(err);
    res.json({ message: 'Setting updated' });
  });
});

// ADD NEW SETTING
router.post('/', verifyToken, checkRole('admin'), (req, res) => {
  const { setting_key, setting_value, category } = req.body;
  const sql = 'INSERT INTO system_settings (setting_key, setting_value, category, updated_by) VALUES (?, ?, ?, ?)';
  db.query(sql, [setting_key, setting_value, category || 'general', req.user.id], (err) => {
    if (err) {
      if (err.code === '23505') return res.status(400).json({ message: 'Setting key already exists' });
      return res.status(500).json(err);
    }
    res.json({ message: 'Setting added' });
  });
});

// DELETE SETTING
router.delete('/:id', verifyToken, checkRole('admin'), (req, res) => {
  db.query('DELETE FROM system_settings WHERE id = ?', [req.params.id], (err) => {
    if (err) return res.status(500).json(err);
    res.json({ message: 'Setting deleted' });
  });
});

module.exports = router;
