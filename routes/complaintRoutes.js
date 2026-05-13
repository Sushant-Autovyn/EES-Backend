const express = require('express');
const router = express.Router();
const db = require('../config/db');
const verifyToken = require('../middleware/authMiddleware');
const checkRole = require('../middleware/roleMiddleware');
const upload = require('../middleware/uploadMiddleware');

// Ensure table exists (auto-create on first request)
const ensureTable = `
  CREATE TABLE IF NOT EXISTS complaints (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL,
    subject VARCHAR(200) NOT NULL,
    category VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    attachment VARCHAR(255),
    status VARCHAR(20) DEFAULT 'Pending',
    admin_response TEXT,
    resolved_by INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`;
db.query(ensureTable, (err) => {
  if (err) console.error('complaints table create error:', err.message);
  // Seed permissions: 'my-complaints' for employees, 'complaints' for admin/hr
  const seed = `
    UPDATE roles
    SET permissions = CASE
      WHEN role_name IN ('admin','hr') AND permissions NOT LIKE '%complaints%'
        THEN permissions || ',complaints'
      WHEN role_name = 'employee' AND permissions NOT LIKE '%my-complaints%'
        THEN permissions || ',my-complaints'
      ELSE permissions
    END
    WHERE role_name IN ('admin','hr','employee')
  `;
  db.query(seed, (e) => {
    if (e) console.error('complaints permission seed error:', e.message);
  });
});

// GET ALL (admin/hr)
router.get('/', verifyToken, checkRole('admin', 'hr'), (req, res) => {
  const sql = `
    SELECT c.*, e.name AS employee_name, e.department, e.email
    FROM complaints c
    JOIN employees e ON c.employee_id = e.id
    ORDER BY c.created_at DESC
  `;
  db.query(sql, (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });
});

// GET MY (current user)
router.get('/my', verifyToken, (req, res) => {
  const sql = `
    SELECT c.*, e.name AS employee_name
    FROM complaints c
    JOIN employees e ON c.employee_id = e.id
    WHERE c.employee_id = ?
    ORDER BY c.created_at DESC
  `;
  db.query(sql, [req.user.id], (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });
});

// SUBMIT (with optional attachment)
router.post('/', verifyToken, upload.single('attachment'), (req, res) => {
  const { subject, category, description } = req.body;
  if (!subject || !category || !description) {
    return res.status(400).json({ message: 'subject, category and description are required' });
  }
  const attachment = req.file ? req.file.filename : null;
  const sql = `
    INSERT INTO complaints (employee_id, subject, category, description, attachment)
    VALUES (?, ?, ?, ?, ?)
  `;
  db.query(sql, [req.user.id, subject, category, description, attachment], (err) => {
    if (err) return res.status(500).json(err);
    res.json({ message: 'Complaint submitted' });
  });
});

// UPDATE STATUS (admin/hr) — Resolved / Rejected / In Progress
router.put('/status/:id', verifyToken, checkRole('admin', 'hr'), (req, res) => {
  const { status, admin_response } = req.body;
  const allowed = ['Pending', 'In Progress', 'Resolved', 'Rejected'];
  if (!allowed.includes(status)) {
    return res.status(400).json({ message: 'Invalid status' });
  }
  const sql = `
    UPDATE complaints
    SET status = ?, admin_response = ?, resolved_by = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `;
  db.query(sql, [status, admin_response || null, req.user.id, req.params.id], (err) => {
    if (err) return res.status(500).json(err);
    res.json({ message: 'Status updated' });
  });
});

// DELETE OWN (only if Pending) or admin can delete any
router.delete('/:id', verifyToken, (req, res) => {
  const findSql = `SELECT employee_id, status FROM complaints WHERE id = ?`;
  db.query(findSql, [req.params.id], (err, rows) => {
    if (err) return res.status(500).json(err);
    if (!rows.length) return res.status(404).json({ message: 'Not found' });
    const c = rows[0];
    const isOwner = c.employee_id === req.user.id;
    const isAdmin = req.user.role === 'admin' || req.user.role === 'hr';
    if (!isAdmin && !(isOwner && c.status === 'Pending')) {
      return res.status(403).json({ message: 'Not allowed' });
    }
    db.query(`DELETE FROM complaints WHERE id = ?`, [req.params.id], (e) => {
      if (e) return res.status(500).json(e);
      res.json({ message: 'Complaint deleted' });
    });
  });
});

module.exports = router;
