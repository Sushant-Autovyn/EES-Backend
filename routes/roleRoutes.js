const express = require('express');
const router = express.Router();

const db = require('../config/db');
const authMiddleware = require('../middleware/authMiddleware');
const checkRole = require('../middleware/roleMiddleware');

// GET CURRENT USER'S PERMISSIONS
router.get('/my-permissions', authMiddleware, (req, res) => {
  const userRole = req.user.role;

  const sql = 'SELECT permissions FROM roles WHERE role_name = ? AND status = ?';

  db.query(sql, [userRole, 'Active'], (err, result) => {
    if (err) {
      return res.status(500).json(err);
    }
    if (result.length === 0) {
      return res.json({ permissions: [] });
    }
    const permStr = result[0].permissions || '';
    const permissions = permStr ? permStr.split(',').map(p => p.trim()) : [];
    res.json({ permissions });
  });
});

// GET ALL ROLES
router.get('/', authMiddleware, (req, res) => {
  const sql = 'SELECT * FROM roles ORDER BY id';

  db.query(sql, (err, result) => {
    if (err) {
      return res.status(500).json(err);
    }
    res.json(result);
  });
});

// GET USERS GROUPED BY ROLE
router.get('/users/by-role', authMiddleware, checkRole('admin'), (req, res) => {
  const sql = `SELECT role, COUNT(*) as count FROM users GROUP BY role`;

  db.query(sql, (err, result) => {
    if (err) {
      return res.status(500).json(err);
    }
    res.json(result);
  });
});

// GET ALL USERS (Admin only) - merged with employees
router.get('/users/all', authMiddleware, checkRole('admin'), (req, res) => {
  // Get all users
  const usersSql = `SELECT id, name, email, role, created_at, 'user' as source FROM users ORDER BY id DESC`;
  
  // Get employees that don't have a user account (by email match)
  const unlinkedEmployeesSql = `
    SELECT e.id, e.name, e.email, e.department, e.designation, e.status, e.salary,
           u.id as user_id, u.role as user_role
    FROM employees e
    LEFT JOIN users u ON LOWER(e.email) = LOWER(u.email)
  `;

  db.query(usersSql, (err1, users) => {
    if (err1) return res.status(500).json(err1);

    db.query(unlinkedEmployeesSql, (err2, employees) => {
      if (err2) return res.status(500).json(err2);

      res.json({
        users: users,
        employees: employees
      });
    });
  });
});

// CHANGE USER ROLE (Admin only)
router.put('/users/change-role/:id', authMiddleware, checkRole('admin'), (req, res) => {
  const { role } = req.body;
  const userId = req.params.id;

  if (!role) {
    return res.status(400).json({ message: 'Role is required' });
  }

  const sql = 'UPDATE users SET role = ? WHERE id = ?';

  db.query(sql, [role, userId], (err, result) => {
    if (err) return res.status(500).json(err);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ message: 'Role updated successfully' });
  });
});

// DELETE USER (Admin only)
router.delete('/users/:id', authMiddleware, checkRole('admin'), (req, res) => {
  const userId = req.params.id;

  // Prevent admin from deleting themselves
  if (parseInt(userId) === req.user.id) {
    return res.status(400).json({ message: 'You cannot delete yourself' });
  }

  const sql = 'DELETE FROM users WHERE id = ?';

  db.query(sql, [userId], (err, result) => {
    if (err) return res.status(500).json(err);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ message: 'User deleted successfully' });
  });
});

// GET USERS BY SPECIFIC ROLE
router.get('/users/:roleName', authMiddleware, checkRole('admin'), (req, res) => {
  const sql = 'SELECT id, name, email, role, created_at FROM users WHERE role=?';

  db.query(sql, [req.params.roleName], (err, result) => {
    if (err) {
      return res.status(500).json(err);
    }
    res.json(result);
  });
});

// GET SINGLE ROLE
router.get('/:id', authMiddleware, (req, res) => {
  const sql = 'SELECT * FROM roles WHERE id=?';

  db.query(sql, [req.params.id], (err, result) => {
    if (err) {
      return res.status(500).json(err);
    }
    if (result.length === 0) {
      return res.status(404).json({ message: 'Role not found' });
    }
    res.json(result[0]);
  });
});

// CREATE ROLE (Admin only)
router.post('/', authMiddleware, checkRole('admin'), (req, res) => {
  const { role_name, description, permissions, department_access, status } = req.body;

  if (!role_name) {
    return res.status(400).json({ message: 'Role name is required' });
  }

  const sql = 'INSERT INTO roles (role_name, description, permissions, department_access, status) VALUES (?, ?, ?, ?, ?)';

  db.query(sql, [
    role_name.toLowerCase(),
    description || '',
    permissions || '',
    department_access || '',
    status || 'Active'
  ], (err, result) => {
    if (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ message: 'Role already exists' });
      }
      return res.status(500).json(err);
    }
    res.json({ message: 'Role created successfully', id: result.insertId });
  });
});

// UPDATE ROLE (Admin only)
router.put('/:id', authMiddleware, checkRole('admin'), (req, res) => {
  const { role_name, description, permissions, department_access, status } = req.body;

  if (!role_name) {
    return res.status(400).json({ message: 'Role name is required' });
  }

  const sql = 'UPDATE roles SET role_name=?, description=?, permissions=?, department_access=?, status=? WHERE id=?';

  db.query(sql, [
    role_name.toLowerCase(),
    description || '',
    permissions || '',
    department_access || '',
    status || 'Active',
    req.params.id
  ], (err, result) => {
    if (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ message: 'Role already exists' });
      }
      return res.status(500).json(err);
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Role not found' });
    }
    res.json({ message: 'Role updated successfully' });
  });
});

// DELETE ROLE (Admin only)
router.delete('/:id', authMiddleware, checkRole('admin'), (req, res) => {
  const sql = 'DELETE FROM roles WHERE id=?';

  db.query(sql, [req.params.id], (err, result) => {
    if (err) {
      return res.status(500).json(err);
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Role not found' });
    }
    res.json({ message: 'Role deleted successfully' });
  });
});

module.exports = router;
