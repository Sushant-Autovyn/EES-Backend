const express = require('express');
const router = express.Router();
const db = require('../config/db');
const verifyToken = require('../middleware/authMiddleware');
const checkRole = require('../middleware/roleMiddleware');
const upload = require('../middleware/uploadMiddleware');

// GET ALL DOCUMENTS (admin/hr see all, employee sees own)
router.get('/', verifyToken, (req, res) => {
  let sql, params = [];
  if (req.user.role === 'admin' || req.user.role === 'hr') {
    sql = `SELECT d.*, e.name as employee_name, e.department
           FROM employee_documents d
           JOIN employees e ON d.employee_id = e.id
           ORDER BY d.created_at DESC`;
  } else {
    sql = `SELECT d.*, e.name as employee_name, e.department
           FROM employee_documents d
           JOIN employees e ON d.employee_id = e.id
           WHERE d.employee_id = (SELECT id FROM employees WHERE user_id = ? LIMIT 1)
           ORDER BY d.created_at DESC`;
    params = [req.user.id];
  }
  db.query(sql, params, (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });
});

// GET DOCUMENTS BY EMPLOYEE
router.get('/employee/:id', verifyToken, checkRole('admin', 'hr'), (req, res) => {
  const sql = `SELECT * FROM employee_documents WHERE employee_id = ? ORDER BY created_at DESC`;
  db.query(sql, [req.params.id], (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });
});

// UPLOAD DOCUMENT (admin/hr can upload for any employee, employee uploads own)
router.post('/', verifyToken, upload.single('document'), (req, res) => {
  let { employee_id, doc_type, doc_name } = req.body;
  const file_url = req.file ? req.file.filename : '';

  if (req.user.role === 'employee') {
    // Employee uploads their own — find their employee_id
    const findSql = `SELECT id FROM employees WHERE user_id = ? LIMIT 1`;
    db.query(findSql, [req.user.id], (err, empResult) => {
      if (err) return res.status(500).json(err);
      if (!empResult.length) return res.status(404).json({ message: 'Employee profile not found' });
      employee_id = empResult[0].id;
      const sql = `INSERT INTO employee_documents (employee_id, doc_type, doc_name, file_url, uploaded_by, status) VALUES (?, ?, ?, ?, ?, 'Pending')`;
      db.query(sql, [employee_id, doc_type, doc_name || req.file?.originalname, file_url, req.user.id], (err2) => {
        if (err2) return res.status(500).json(err2);
        res.json({ message: 'Document submitted for review' });
      });
    });
  } else {
    // Admin/HR upload — status is Approved directly
    const sql = `INSERT INTO employee_documents (employee_id, doc_type, doc_name, file_url, uploaded_by, status) VALUES (?, ?, ?, ?, ?, 'Approved')`;
    db.query(sql, [employee_id, doc_type, doc_name || req.file?.originalname, file_url, req.user.id], (err) => {
      if (err) return res.status(500).json(err);
      res.json({ message: 'Document uploaded successfully' });
    });
  }
});

// APPROVE DOCUMENT
router.put('/approve/:id', verifyToken, checkRole('admin', 'hr'), (req, res) => {
  const sql = `UPDATE employee_documents SET status = 'Approved', reviewed_by = ?, reviewed_at = NOW(), remarks = ? WHERE id = ?`;
  db.query(sql, [req.user.id, req.body.remarks || null, req.params.id], (err) => {
    if (err) return res.status(500).json(err);
    res.json({ message: 'Document approved' });
  });
});

// REJECT DOCUMENT
router.put('/reject/:id', verifyToken, checkRole('admin', 'hr'), (req, res) => {
  const sql = `UPDATE employee_documents SET status = 'Rejected', reviewed_by = ?, reviewed_at = NOW(), remarks = ? WHERE id = ?`;
  db.query(sql, [req.user.id, req.body.remarks || null, req.params.id], (err) => {
    if (err) return res.status(500).json(err);
    res.json({ message: 'Document rejected' });
  });
});

// DELETE DOCUMENT
router.delete('/:id', verifyToken, checkRole('admin', 'hr'), (req, res) => {
  db.query('DELETE FROM employee_documents WHERE id = ?', [req.params.id], (err) => {
    if (err) return res.status(500).json(err);
    res.json({ message: 'Document deleted' });
  });
});

module.exports = router;
