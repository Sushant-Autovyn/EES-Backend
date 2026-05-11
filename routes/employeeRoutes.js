const express = require('express');
const verifyToken = require('../middleware/authMiddleware');
const checkRole = require('../middleware/roleMiddleware');
const router = express.Router();
const upload = require('../middleware/uploadMiddleware');
const db = require('../config/db');


// GET MEMBERS CONTACTS (for employee role - must be before /:id routes)
router.get(
  '/contacts',
  verifyToken,
  (req, res) => {

    const sql = `
      SELECT id, name, email, phone, department, designation, profile_image
      FROM employees
      WHERE status = 'Active'
      ORDER BY name ASC
    `;

    db.query(sql, (err, result) => {
      if (err) return res.status(500).json(err);
      res.json(result);
    });

  }
);


// GET ALL EMPLOYEES
router.get(
  '/',
  verifyToken,
  checkRole('admin', 'hr'),
  (req, res) => {

    const {
      search = '',
      page = 1,
      limit = 5,
      department,
      status,
      sort = 'id',
      order = 'DESC'
    } = req.query;

    const offset =
      (page - 1) * limit;

    let sql = `
      SELECT *
      FROM employees
      WHERE
      name ILIKE ?
    `;

    let values = [`%${search}%`];



    // FILTER BY DEPARTMENT
    if (department) {

      sql += ' AND department=?';

      values.push(department);

    }


    // FILTER BY STATUS
    if (status) {

      sql += ' AND status=?';

      values.push(status);

    }


    // SORTING
    sql += `
      ORDER BY ${sort} ${order}
      LIMIT ? OFFSET ?
    `;

    values.push(
      Number(limit),
      Number(offset)
    );


    db.query(sql, values, (err, result) => {

      if (err) {
        return res.status(500).json(err);
      }

      res.json(result);

    });

  }
);


// ADD EMPLOYEE
router.post(
  '/',
  verifyToken,
  checkRole('admin', 'hr'),
  (req, res) => {

  const {
    name,
    email,
    phone,
    department,
    designation,
    salary,
    status
  } = req.body;

  const sql = `
    INSERT INTO employees
    (name, email, phone, department, designation, salary, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;

  db.query(
    sql,
    [name, email, phone, department, designation, salary, status],
    (err, result) => {

      if (err) {
        res.status(500).json(err);
      } else {
        res.json({
          message: 'Employee Added Successfully'
        });
      }

    }
  );

});


// UPDATE EMPLOYEE
router.put(
  '/:id',
  verifyToken,
  checkRole('admin', 'hr'),
  (req, res) => {

  const { id } = req.params;

  const {
    name,
    email,
    phone,
    department,
    designation,
    salary,
    status
  } = req.body;

  const sql = `
    UPDATE employees
    SET
    name=?,
    email=?,
    phone=?,
    department=?,
    designation=?,
    salary=?,
    status=?
    WHERE id=?
  `;

  db.query(
    sql,
    [name, email, phone, department, designation, salary, status, id],
    (err, result) => {

      if (err) {
        res.status(500).json(err);
      } else {
        res.json({
          message: 'Employee Updated Successfully'
        });
      }

    }
  );

});


// DELETE EMPLOYEE
router.delete(
  '/:id',
  verifyToken,
  checkRole('admin', 'hr'),
  (req, res) =>{

  const { id } = req.params;

  const sql = 'DELETE FROM employees WHERE id=?';

  db.query(sql, [id], (err, result) => {

    if (err) {
      res.status(500).json(err);
    } else {
      res.json({
        message: 'Employee Deleted Successfully'
      });
    }

  });

});
// UPLOAD EMPLOYEE IMAGE
router.post(
  '/upload/:id',
  verifyToken,
  upload.single('image'),
  (req, res) => {

    const { id } = req.params;

    const image = req.file.filename;

    const sql = `
      UPDATE employees
      SET profile_image=?
      WHERE id=?
    `;

    db.query(sql, [image, id], (err, result) => {

      if (err) {
        return res.status(500).json(err);
      }

      res.json({
        message: 'Image Uploaded Successfully',
        image
      });

    });

  }
);


module.exports = router;