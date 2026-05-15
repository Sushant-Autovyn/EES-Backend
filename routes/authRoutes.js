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
      phone,
      password,
      role
    } = req.body;

    // HASH PASSWORD
    const hashedPassword = await bcrypt.hash(password, 10);

    const sql = `
      INSERT INTO users
      (name, email, phone, password, role)
      VALUES (?, ?, ?, ?, ?)
    `;

    db.query(
      sql,
      [name, email, phone || null, hashedPassword, role],
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


// FORGOT PASSWORD - Generate OTP and send via Twilio SMS
// Keyed by phone number (the user identifier for password reset).
const otpStore = {};

router.post('/forgot-password', (req, res) => {

  const { phone, channel } = req.body;
  // channel: 'whatsapp' (default) | 'sms'
  const useWhatsapp = (channel || 'whatsapp').toLowerCase() === 'whatsapp';

  if (!phone) {
    return res.status(400).json({ message: 'Phone number is required' });
  }

  // Look up user by phone, falling back to the employees table so
  // accounts created before the users.phone column existed still work.
  const sql = `
    SELECT u.*
    FROM users u
    LEFT JOIN employees e ON e.email = u.email
    WHERE u.phone = ? OR e.phone = ?
    LIMIT 1
  `;

  db.query(sql, [phone, phone], (err, result) => {

    if (err) return res.status(500).json(err);

    if (result.length === 0) {
      return res.status(404).json({ message: 'No account found for this phone number' });
    }

    const user = result[0];

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore[phone] = {
      otp,
      email: user.email,
      expires: Date.now() + 10 * 60 * 1000
    };

    const { sendSms, sendWhatsapp } = require('../utils/sendSms');
    const sender = useWhatsapp ? sendWhatsapp : sendSms;
    const channelLabel = useWhatsapp ? 'WhatsApp' : 'SMS';

    sender(phone, `Your password reset OTP is: ${otp}. Valid for 10 minutes.`)
      .then(() => {
        res.json({ message: `OTP sent to your phone via ${channelLabel}` });
      })
      .catch((sendErr) => {
        console.log(`Twilio ${channelLabel} error:`, sendErr.message);
        console.log(`[DEV] OTP for ${phone}: ${otp}`);
        // Fallback: delivery failed (e.g. Twilio not configured or
        // recipient not opted-in to WhatsApp sandbox).
        // Return the OTP so the user can still complete the reset in dev.
        res.json({
          message: `${channelLabel} service unavailable. Use the OTP shown below.`,
          otp,
          devMode: true
        });
      });

  });

});


// RESET PASSWORD
router.post('/reset-password', async (req, res) => {

  const { phone, otp, newPassword } = req.body;

  const stored = otpStore[phone];

  if (!stored) {
    return res.status(400).json({ message: 'No OTP requested for this phone number' });
  }

  if (stored.otp !== otp) {
    return res.status(400).json({ message: 'Invalid OTP' });
  }

  if (Date.now() > stored.expires) {
    delete otpStore[phone];
    return res.status(400).json({ message: 'OTP expired' });
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  const sql = 'UPDATE users SET password=? WHERE email=?';

  db.query(sql, [hashedPassword, stored.email], (err, result) => {

    if (err) return res.status(500).json(err);

    delete otpStore[phone];
    res.json({ message: 'Password reset successful' });

  });

});


// SEND CUSTOM MESSAGE - admin/hr utility to send any message via WhatsApp or SMS
// Body: { phone: string | string[], message: string, channel?: 'whatsapp' | 'sms' }
// Accepts a single phone or an array of phones for bulk sending.
const verifyToken = require('../middleware/authMiddleware');

router.post('/send-message', verifyToken, async (req, res) => {

  const { phone, message, channel } = req.body;
  const useWhatsapp = (channel || 'whatsapp').toLowerCase() === 'whatsapp';

  // Normalize phone input into a deduped array of trimmed non-empty strings
  let phones = [];
  if (Array.isArray(phone)) {
    phones = phone;
  } else if (typeof phone === 'string') {
    // Allow comma / newline / semicolon separated input
    phones = phone.split(/[,\n;]+/);
  }
  phones = [...new Set(phones.map(p => (p || '').trim()).filter(Boolean))];

  if (phones.length === 0 || !message) {
    return res.status(400).json({ message: 'At least one phone and a message are required' });
  }

  // Restrict to admin / hr roles
  const role = (req.user?.role || '').toLowerCase();
  if (role !== 'admin' && role !== 'hr') {
    return res.status(403).json({ message: 'Not authorized to send messages' });
  }

  const { sendSms, sendWhatsapp } = require('../utils/sendSms');
  const sender = useWhatsapp ? sendWhatsapp : sendSms;
  const channelLabel = useWhatsapp ? 'WhatsApp' : 'SMS';

  // Send in parallel and collect per-recipient results
  const results = await Promise.all(phones.map(async (p) => {
    try {
      const r = await sender(p, message);
      return { phone: p, success: true, sid: r.sid, status: r.status };
    } catch (err) {
      console.log(`send-message error to ${p}:`, err.message);
      return { phone: p, success: false, error: err.message };
    }
  }));

  const sent = results.filter(r => r.success).length;
  const failed = results.length - sent;

  res.json({
    message: `Sent ${sent}/${results.length} via ${channelLabel}` + (failed ? ` (${failed} failed)` : ''),
    channel: channelLabel,
    total: results.length,
    sent,
    failed,
    results
  });

});


module.exports = router;