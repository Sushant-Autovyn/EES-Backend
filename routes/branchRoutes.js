const express = require('express');
const router = express.Router();
const db = require('../config/db');
const verifyToken = require('../middleware/authMiddleware');
const checkRole = require('../middleware/roleMiddleware');

// GET ALL BRANCHES
router.get('/', verifyToken, checkRole('admin'), (req, res) => {
  db.query('SELECT * FROM branches ORDER BY id', (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });
});

// ADD BRANCH
router.post('/', verifyToken, checkRole('admin'), (req, res) => {
  const { name, address, city, state, phone, manager_id, status } = req.body;
  const sql = 'INSERT INTO branches (name, address, city, state, phone, manager_id, status) VALUES (?, ?, ?, ?, ?, ?, ?)';
  db.query(sql, [name, address, city, state, phone, manager_id || null, status || 'Active'], (err) => {
    if (err) {
      if (err.code === '23505') return res.status(400).json({ message: 'Branch name already exists' });
      return res.status(500).json(err);
    }
    res.json({ message: 'Branch created' });
  });
});

// UPDATE BRANCH
router.put('/:id', verifyToken, checkRole('admin'), (req, res) => {
  const { name, address, city, state, phone, manager_id, status } = req.body;
  const sql = 'UPDATE branches SET name=?, address=?, city=?, state=?, phone=?, manager_id=?, status=? WHERE id=?';
  db.query(sql, [name, address, city, state, phone, manager_id || null, status, req.params.id], (err) => {
    if (err) return res.status(500).json(err);
    res.json({ message: 'Branch updated' });
  });
});

// DELETE BRANCH
router.delete('/:id', verifyToken, checkRole('admin'), (req, res) => {
  db.query('DELETE FROM branches WHERE id = ?', [req.params.id], (err) => {
    if (err) return res.status(500).json(err);
    res.json({ message: 'Branch deleted' });
  });
});

// GET EMPLOYEES BY BRANCH
router.get('/:id/employees', verifyToken, checkRole('admin'), (req, res) => {
  db.query('SELECT * FROM employees WHERE branch_id = ?', [req.params.id], (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });
});

// ASSIGN EMPLOYEE TO BRANCH
router.put('/assign-employee/:empId', verifyToken, checkRole('admin'), (req, res) => {
  const { branch_id } = req.body;
  db.query('UPDATE employees SET branch_id = ? WHERE id = ?', [branch_id, req.params.empId], (err) => {
    if (err) return res.status(500).json(err);
    res.json({ message: 'Employee assigned to branch' });
  });
});

module.exports = router;
