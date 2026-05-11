const express = require('express');
const router = express.Router();
const db = require('../config/db');
const verifyToken = require('../middleware/authMiddleware');
const checkRole = require('../middleware/roleMiddleware');


// GET ALL DEPARTMENTS (names only - for dropdowns)
router.get('/', verifyToken, (req, res) => {

  const sql = 'SELECT DISTINCT department FROM employees WHERE department IS NOT NULL ORDER BY department';

  db.query(sql, (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result.map(r => r.department));
  });

});

// GET ALL DEPARTMENTS (full records)
router.get('/all', verifyToken, checkRole('admin', 'hr'), (req, res) => {
  db.query('SELECT * FROM departments ORDER BY name ASC', (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });
});

// ADD DEPARTMENT
router.post('/', verifyToken, checkRole('admin', 'hr'), (req, res) => {
  const { name, head_id, description, status } = req.body;
  const sql = `INSERT INTO departments (name, head_id, description, status) VALUES (?, ?, ?, ?)`;
  db.query(sql, [name, head_id || null, description, status || 'Active'], (err) => {
    if (err) {
      if (err.code === '23505') return res.status(400).json({ message: 'Department already exists' });
      return res.status(500).json(err);
    }
    res.json({ message: 'Department created' });
  });
});

// UPDATE DEPARTMENT
router.put('/:id', verifyToken, checkRole('admin', 'hr'), (req, res) => {
  const { name, head_id, description, status } = req.body;
  const sql = `UPDATE departments SET name = ?, head_id = ?, description = ?, status = ? WHERE id = ?`;
  db.query(sql, [name, head_id || null, description, status, req.params.id], (err) => {
    if (err) return res.status(500).json(err);
    res.json({ message: 'Department updated' });
  });
});

// DELETE DEPARTMENT
router.delete('/:id', verifyToken, checkRole('admin', 'hr'), (req, res) => {
  db.query('DELETE FROM departments WHERE id = ?', [req.params.id], (err) => {
    if (err) return res.status(500).json(err);
    res.json({ message: 'Department deleted' });
  });
});

module.exports = router;
