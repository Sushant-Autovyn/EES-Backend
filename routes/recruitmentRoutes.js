const express = require('express');
const router = express.Router();
const db = require('../config/db');
const verifyToken = require('../middleware/authMiddleware');
const checkRole = require('../middleware/roleMiddleware');

// ============ RECRUITMENT ============

// SUMMARY (before /:id)
router.get('/summary', verifyToken, checkRole('admin', 'hr'), (req, res) => {
  const sql = `
    SELECT 
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE status = 'Applied') as applied,
      COUNT(*) FILTER (WHERE status = 'Shortlisted') as shortlisted,
      COUNT(*) FILTER (WHERE status = 'Interview') as interview,
      COUNT(*) FILTER (WHERE status = 'Hired') as hired,
      COUNT(*) FILTER (WHERE status = 'Rejected') as rejected
    FROM recruitment
  `;
  db.query(sql, (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result[0]);
  });
});

// GET ALL CANDIDATES
router.get('/', verifyToken, checkRole('admin', 'hr'), (req, res) => {
  db.query('SELECT * FROM recruitment ORDER BY created_at DESC', (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });
});

// ADD CANDIDATE
router.post('/', verifyToken, checkRole('admin', 'hr'), (req, res) => {
  const { position, department, candidate_name, candidate_email, candidate_phone, notes } = req.body;
  const sql = `INSERT INTO recruitment (position, department, candidate_name, candidate_email, candidate_phone, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)`;
  db.query(sql, [position, department, candidate_name, candidate_email, candidate_phone, notes, req.user.id], (err) => {
    if (err) return res.status(500).json(err);
    res.json({ message: 'Candidate added' });
  });
});

// UPDATE STATUS
router.put('/:id', verifyToken, checkRole('admin', 'hr'), (req, res) => {
  const { status, interview_date, notes } = req.body;
  let sql = 'UPDATE recruitment SET status = ?';
  const params = [status];
  if (interview_date) { sql += ', interview_date = ?'; params.push(interview_date); }
  if (notes) { sql += ', notes = ?'; params.push(notes); }
  sql += ' WHERE id = ?';
  params.push(req.params.id);
  db.query(sql, params, (err) => {
    if (err) return res.status(500).json(err);
    res.json({ message: 'Candidate updated' });
  });
});

// DELETE CANDIDATE
router.delete('/:id', verifyToken, checkRole('admin', 'hr'), (req, res) => {
  db.query('DELETE FROM recruitment WHERE id = ?', [req.params.id], (err) => {
    if (err) return res.status(500).json(err);
    res.json({ message: 'Candidate deleted' });
  });
});

module.exports = router;
