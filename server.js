const express = require('express');
const cors = require('cors');
const http = require('http');

const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '.env') });

const db = require('./config/db');

const employeeRoutes = require('./routes/employeeRoutes');
const authRoutes = require('./routes/authRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const leaveRoutes = require('./routes/leaveRoutes');
const payrollRoutes = require('./routes/payrollRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const departmentRoutes = require('./routes/departmentRoutes');
const roleRoutes = require('./routes/roleRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const reimbursementRoutes = require('./routes/reimbursementRoutes');
const recruitmentRoutes = require('./routes/recruitmentRoutes');
const documentRoutes = require('./routes/documentRoutes');
const onboardingRoutes = require('./routes/onboardingRoutes');
const hrReportsRoutes = require('./routes/hrReportsRoutes');
const userRoutes = require('./routes/userRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const announcementRoutes = require('./routes/announcementRoutes');
const auditRoutes = require('./routes/auditRoutes');
const backupRoutes = require('./routes/backupRoutes');
const branchRoutes = require('./routes/branchRoutes');
const adminReportsRoutes = require('./routes/adminReportsRoutes');
const complaintRoutes = require('./routes/complaintRoutes');

const app = express();

const server = http.createServer(app);

const io = require('socket.io')(server, {
  cors: {
    origin: '*'
  }
});


// SOCKET CONNECTION
io.on('connection', (socket) => {

  console.log('User Connected');

  socket.on('disconnect', () => {

    console.log('User Disconnected');

  });

});


app.use(cors());
app.use(express.json());

app.use('/uploads', express.static('uploads'));

app.get('/', (req, res) => {
  res.send('Employee Backend Running...');
});


// ROUTES
app.use('/api/employees', employeeRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/leaves', leaveRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/reimbursements', reimbursementRoutes);
app.use('/api/recruitment', recruitmentRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/hr-reports', hrReportsRoutes);
app.use('/api/users', userRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/backup', backupRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/admin-reports', adminReportsRoutes);
app.use('/api/complaints', complaintRoutes);


// MIGRATION: ensure users table has phone column
// BOOTSTRAP: run database/setup.sql on startup so a fresh DB
// (e.g. Railway Postgres) gets all tables created automatically.
// All statements use CREATE TABLE IF NOT EXISTS so this is safe on every boot.
(async () => {
  try {
    const fs = require('fs');
    const setupPath = path.join(__dirname, 'database', 'setup.sql');
    if (fs.existsSync(setupPath)) {
      const sql = fs.readFileSync(setupPath, 'utf8');
      const { Pool } = require('pg');
      const pool = process.env.DATABASE_URL
        ? new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: { rejectUnauthorized: false }
          })
        : new Pool({
            host: process.env.DB_HOST,
            port: process.env.DB_PORT || 5432,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME
          });

      // pg supports multiple statements in a single query when separated by ;
      await pool.query(sql);
      await pool.end();
      console.log('Database schema bootstrap complete');
    }
  } catch (err) {
    console.log('Database schema bootstrap error:', err.message);
  }

  // Run migrations AFTER bootstrap so tables exist
  db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20)`, (err) => {
    if (err) console.log('users.phone migration error:', err.message);
  });

  // BACKFILL: ensure every user with role 'employee' has a row in employees table
  const backfillSql = `
    INSERT INTO employees (name, email, status)
    SELECT u.name, u.email, 'Active'
    FROM users u
    WHERE LOWER(u.role) = 'employee'
      AND u.email IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM employees e WHERE e.email = u.email
      )
  `;
  db.query(backfillSql, (err, result) => {
    if (err) {
      console.log('Employee backfill error:', err.message);
    } else if (result && result.rowCount) {
      console.log(`Backfilled ${result.rowCount} employee record(s) from users table`);
    }
  });
})();

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Employee Backend Server running on port ${PORT}`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`Port ${PORT} is busy. Please close the other process and retry.`);
    process.exit(1);
  } else {
    console.error('Server error:', err);
    process.exit(1);
  }
});


module.exports = io;