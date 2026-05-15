// Twilio messaging helper - supports SMS and WhatsApp
// Reads credentials from environment variables:
//   TWILIO_ACCOUNT_SID
//   TWILIO_AUTH_TOKEN
//   TWILIO_PHONE_NUMBER       (SMS "from" number, E.164 e.g. +15551234567)
//   TWILIO_WHATSAPP_NUMBER    (WhatsApp "from" number, E.164 e.g. +14155238886
//                              — the Twilio sandbox number)

const normalize = (to) => {
  let dest = (to || '').trim();
  if (/^\d{10}$/.test(dest)) {
    // Default to India country code; change here if needed
    dest = '+91' + dest;
  } else if (!dest.startsWith('+')) {
    dest = '+' + dest.replace(/[^\d]/g, '');
  }
  return dest;
};

const getClient = () => {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) {
    throw new Error('Twilio credentials not configured');
  }
  const twilio = require('twilio');
  return twilio(sid, token);
};

// Send a regular SMS
const sendSms = async (to, body) => {
  const from = process.env.TWILIO_PHONE_NUMBER;
  if (!from) throw new Error('TWILIO_PHONE_NUMBER not configured');

  const client = getClient();
  return client.messages.create({
    body,
    from,
    to: normalize(to)
  });
};

// Send a WhatsApp message via Twilio.
// `to` is a normal phone number; we prefix with `whatsapp:` automatically.
const sendWhatsapp = async (to, body) => {
  const from = process.env.TWILIO_WHATSAPP_NUMBER;
  if (!from) throw new Error('TWILIO_WHATSAPP_NUMBER not configured');

  const client = getClient();
  return client.messages.create({
    body,
    from: `whatsapp:${from}`,
    to: `whatsapp:${normalize(to)}`
  });
};

module.exports = sendSms;
module.exports.sendSms = sendSms;
module.exports.sendWhatsapp = sendWhatsapp;
