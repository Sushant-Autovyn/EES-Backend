const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({

  host: 'smtp.gmail.com',
  port: 465,
  secure: true,

  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },

  tls: {
    // Workaround for environments where antivirus / corporate proxy
    // intercepts TLS with a self-signed certificate.
    rejectUnauthorized: false
  }

});


const sendEmail = async (
  to,
  subject,
  text
) => {

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    throw new Error('Email service not configured (EMAIL_USER/EMAIL_PASS missing)');
  }

  try {

    await transporter.sendMail({

      from: process.env.EMAIL_USER,
      to,
      subject,
      text

    });

    console.log('Email Sent Successfully');

  } catch (error) {

    console.log('Email send failed:', error.message);
    throw error;

  }

};

module.exports = sendEmail;