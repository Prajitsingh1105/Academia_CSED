const nodemailer = require('nodemailer');
const { eventBus, EVENTS } = require('../events/eventBus');
const { OTP_PURPOSES } = require('./otpService');

const MAX_RETRIES = 4;
const queue = [];
let draining = false;

const transporter = process.env.SMTP_HOST
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    })
  : null;

const TEMPLATES = {
  [OTP_PURPOSES.REGISTER]: { subject: 'Verify your Academia account', lead: 'Use this code to complete your registration' },
  [OTP_PURPOSES.PASSWORD_RESET]: { subject: 'Reset your Academia password', lead: 'Use this code to reset your password' },
};

async function send({ email, purpose, otp, ttlMinutes }) {
  const t = TEMPLATES[purpose];

  // DEV ONLY: send every OTP mail to one real inbox so fake student emails can be tested.
  // Ignored in production.
  const redirectTo = process.env.NODE_ENV !== 'production' ? process.env.OTP_DEV_REDIRECT_TO : '';
  const recipient = redirectTo || email;
  const note = redirectTo ? `\n\n[DEV redirect] originally addressed to: ${email}` : '';

  const text = `${t.lead}: ${otp}\n\nIt expires in ${ttlMinutes} minutes. If you didn't request this, ignore this email.${note}`;

  if (!transporter) {
    if (process.env.NODE_ENV === 'production') throw new Error('SMTP not configured');
    console.log(`[DEV-MAIL] to=${email} purpose=${purpose} otp=${otp}`); // dev only
    return;
  }
  await transporter.sendMail({
    from: process.env.MAIL_FROM || 'Academia <no-reply@academia.local>',
    to: recipient,
    subject: t.subject,
    text,
  });
}

async function drain() {
  if (draining) return;
  draining = true;
  while (queue.length) {
    const job = queue.shift();
    try {
      await send(job.data);
    } catch (err) {
      job.attempts += 1;
      if (job.attempts <= MAX_RETRIES) {
        setTimeout(() => { queue.push(job); setImmediate(drain); }, 2 ** job.attempts * 1000); // exponential backoff
      } else {
        console.error(`[OtpMailer] giving up on ${job.data.purpose} mail:`, err.message);
      }
    }
  }
  draining = false;
}

function startOtpMailer() {
  eventBus.on(EVENTS.OTP_REQUESTED, (event) => {
    queue.push({ data: event.data, attempts: 0 });
    setImmediate(drain);
  });
}

module.exports = { startOtpMailer };
