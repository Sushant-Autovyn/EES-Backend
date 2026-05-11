const express = require('express');
const router = express.Router();
const db = require('../config/db');
const verifyToken = require('../middleware/authMiddleware');
const checkRole = require('../middleware/roleMiddleware');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// GET BACKUP INFO
router.get('/info', verifyToken, checkRole('admin'), (req, res) => {
  const backupDir = path.join(__dirname, '..', 'backups');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

  const files = fs.readdirSync(backupDir).filter(f => f.endsWith('.sql')).map(f => {
    const stats = fs.statSync(path.join(backupDir, f));
    return { name: f, size: stats.size, date: stats.mtime };
  }).sort((a, b) => new Date(b.date) - new Date(a.date));

  // DB stats
  const sql = `
    SELECT 
      (SELECT COUNT(*) FROM users) as total_users,
      (SELECT COUNT(*) FROM employees) as total_employees,
      (SELECT COUNT(*) FROM attendance) as total_attendance,
      (SELECT COUNT(*) FROM leaves_data) as total_leaves,
      (SELECT COUNT(*) FROM payroll) as total_payroll
  `;
  db.query(sql, (err, result) => {
    if (err) return res.status(500).json(err);
    res.json({ backups: files, dbStats: result[0] });
  });
});

// CREATE BACKUP
router.post('/create', verifyToken, checkRole('admin'), (req, res) => {
  try {
    const backupDir = path.join(__dirname, '..', 'backups');
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup_${timestamp}.sql`;
    const filepath = path.join(backupDir, filename);

    const pgDumpPath = '"C:\\Program Files\\PostgreSQL\\18\\bin\\pg_dump.exe"';
    const cmd = `set PGPASSWORD=${process.env.DB_PASS || '99Sonu@_@3621'}& ${pgDumpPath} -U ${process.env.DB_USER || 'postgres'} -h ${process.env.DB_HOST || 'localhost'} -p ${process.env.DB_PORT || '5432'} ${process.env.DB_NAME || 'employee_db'} > "${filepath}"`;

    execSync(cmd, { shell: 'cmd.exe' });

    const stats = fs.statSync(filepath);
    res.json({ message: 'Backup created', filename, size: stats.size });
  } catch (e) {
    res.status(500).json({ message: 'Backup failed', error: e.message });
  }
});

// DELETE BACKUP FILE
router.delete('/:filename', verifyToken, checkRole('admin'), (req, res) => {
  const filepath = path.join(__dirname, '..', 'backups', req.params.filename);
  // Prevent path traversal
  if (!filepath.startsWith(path.join(__dirname, '..', 'backups'))) {
    return res.status(400).json({ message: 'Invalid filename' });
  }
  if (!fs.existsSync(filepath)) return res.status(404).json({ message: 'File not found' });
  fs.unlinkSync(filepath);
  res.json({ message: 'Backup deleted' });
});

// DOWNLOAD BACKUP
router.get('/download/:filename', verifyToken, checkRole('admin'), (req, res) => {
  const filepath = path.join(__dirname, '..', 'backups', req.params.filename);
  if (!filepath.startsWith(path.join(__dirname, '..', 'backups'))) {
    return res.status(400).json({ message: 'Invalid filename' });
  }
  if (!fs.existsSync(filepath)) return res.status(404).json({ message: 'File not found' });
  res.download(filepath);
});

module.exports = router;
