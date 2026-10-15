const crypto = require('crypto');
const OtpModel = require('../models/otpModel');
const { eventBus, EVENTS } = require('../events/eventBus');
const { normalizeEmail } = require('../utils/emailValidator');

const OTP_SECRET = process.env.OTP_HMAC_SECRET || (() => {
  if (process.env.NODE_ENV === 'production') throw new Error('OTP_HMAC_SECRET must be set in production');
  return 'dev_otp_secret';
})();
const OTP_LENGTH = 6;
const OTP_TTL_MINUTES = parseInt(process.env.OTP_TTL_MINUTES || '10', 10);
const OTP_RESEND_COOLDOWN_SEC = parseInt(process.env.OTP_RESEND_COOLDOWN_SEC || '60', 10);
const OTP_MAX_ATTEMPTS = parseInt(process.env.OTP_MAX_ATTEMPTS || '5', 10);

const OTP_PURPOSES = Object.freeze({
  REGISTER: 'REGISTER',
  PASSWORD_RESET: 'PASSWORD_RESET',
});

const httpError = (msg, statusCode, extra = {}) => Object.assign(new Error(msg), { statusCode, ...extra });

// HMAC (keyed) because a 6-digit OTP is trivially brute-forceable from a plain SHA-256 if the DB leaks.
const hashOtp = (email, purpose, otp) =>
  crypto.createHmac('sha256', OTP_SECRET).update(`${email}:${purpose}:${otp}`).digest('hex');

class OtpService {
  /**
   * Generate + store an OTP, then hand delivery off to the event bus (async, non-blocking).
   * The HTTP request never waits for SMTP.
   */
  static async request(rawEmail, purpose, meta = {}) {
    const email = normalizeEmail(rawEmail);

    const last = await OtpModel.lastCreatedAt(email, purpose);
    if (last) {
      const waitSec = Math.ceil((last.getTime() + OTP_RESEND_COOLDOWN_SEC * 1000 - Date.now()) / 1000);
      if (waitSec > 0) {
        throw httpError(`Please wait ${waitSec}s before requesting another code.`, 429, { retryAfter: waitSec });
      }
    }

    const otp = crypto.randomInt(0, 10 ** OTP_LENGTH).toString().padStart(OTP_LENGTH, '0');
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

    await OtpModel.invalidateActive(email, purpose);
    await OtpModel.create({ email, purpose, codeHash: hashOtp(email, purpose, otp), expiresAt });

    // Fire-and-forget: mailer subscribes to this event
    eventBus.publish(EVENTS.OTP_REQUESTED, {
      email, purpose, otp, expiresAt: expiresAt.toISOString(), ttlMinutes: OTP_TTL_MINUTES, ...meta,
    }).catch((err) => console.error('[OtpService] publish failed:', err.message));

    return { expiresAt, resendAfterSec: OTP_RESEND_COOLDOWN_SEC };
  }

  /** Throws 400 on any failure (generic message: no hints about which check failed). */
  static async verify(rawEmail, purpose, otp) {
    const email = normalizeEmail(rawEmail);
    const fail = () => httpError('Invalid or expired verification code.', 400);

    if (!/^\d{6}$/.test(String(otp || ''))) throw fail();

    const record = await OtpModel.claimAttempt(email, purpose, OTP_MAX_ATTEMPTS);
    if (!record) throw fail();

    const expected = Buffer.from(record.code_hash, 'hex');
    const actual = Buffer.from(hashOtp(email, purpose, otp), 'hex');
    if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) throw fail();

    if (!(await OtpModel.consume(record.id))) throw fail(); // lost a race → already used
    return true;
  }
}

module.exports = { OtpService, OTP_PURPOSES };
