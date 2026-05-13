const express = require('express');
const router = express.Router();

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const db = require('../config/db');


// REGISTER
router.post('/register', async (req, res) => {

  try {

    const {
      name,
      email,
      password,
      role
    } = req.body;

    // HASH PASSWORD
    const hashedPassword = await bcrypt.hash(password, 10);

    const sql = `
      INSERT INTO users
      (name, email, password, role)
      VALUES (?, ?, ?, ?)
    `;

    db.query(
      sql,
      [name, email, hashedPassword, role],
      (err, result) => {

        if (err) {
          return res.status(500).json(err);
        }

        // If the registered user is an employee, also create a record
        // in the employees table so they appear in the Employees section.
        if ((role || '').toLowerCase() === 'employee') {

          const empSql = `
            INSERT INTO employees (name, email, status)
            VALUES (?, ?, 'Active')
            ON CONFLICT (email) DO NOTHING
          `;

          db.query(empSql, [name, email], (empErr) => {
            if (empErr) {
              console.log('Employee record creation error:', empErr);
            }
            res.json({
              message: 'User Registered Successfully'
            });
          });

          return;
        }

        res.json({
          message: 'User Registered Successfully'
        });

      }
    );

  } catch (error) {

    res.status(500).json(error);

  }

});


// LOGIN
router.post('/login', (req, res) => {

  const { email, password } = req.body;

  const sql = 'SELECT * FROM users WHERE email=?';

  db.query(sql, [email], async (err, result) => {

    if (err) {
      return res.status(500).json(err);
    }

    if (result.length === 0) {
      return res.status(401).json({
        message: 'Invalid Email'
      });
    }

    const user = result[0];

    // CHECK PASSWORD
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({
        message: 'Invalid Password'
      });
    }

    // JWT TOKEN
    const token = jwt.sign(
      {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      process.env.JWT_SECRET,
      {
        expiresIn: '1d'
      }
    );

    res.json({
      message: 'Login Successful',
      token,
      user
    });

  });

});


// FORGOT PASSWORD - Generate OTP
const otpStore = {};

router.post('/forgot-password', (req, res) => {

  const { email } = req.body;

  const sql = 'SELECT * FROM users WHERE email=?';

  db.query(sql, [email], (err, result) => {

    if (err) return res.status(500).json(err);

    if (result.length === 0) {
      return res.status(404).json({ message: 'Email not found' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore[email] = { otp, expires: Date.now() + 10 * 60 * 1000 };

    const sendEmail = require('../utils/sendEmail');
    sendEmail(email, 'Password Reset OTP', `Your OTP is: ${otp}. Valid for 10 minutes.`)
      .then(() => {
        res.json({ message: 'OTP sent to your email' });
      })
      .catch((emailErr) => {
        console.log('Email error:', emailErr);
        res.json({ message: 'OTP generated', otp }); // fallback: return otp if email fails
      });

  });

});


// RESET PASSWORD
router.post('/reset-password', async (req, res) => {

  const { email, otp, newPassword } = req.body;

  const stored = otpStore[email];

  if (!stored) {
    return res.status(400).json({ message: 'No OTP requested for this email' });
  }

  if (stored.otp !== otp) {
    return res.status(400).json({ message: 'Invalid OTP' });
  }

  if (Date.now() > stored.expires) {
    delete otpStore[email];
    return res.status(400).json({ message: 'OTP expired' });
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  const sql = 'UPDATE users SET password=? WHERE email=?';

  db.query(sql, [hashedPassword, email], (err, result) => {

    if (err) return res.status(500).json(err);

    delete otpStore[email];
    res.json({ message: 'Password reset successful' });

  });

});


module.exports = router;