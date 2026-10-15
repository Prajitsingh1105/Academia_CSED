const db = require('../config/db');

class OtpModel {
  /** Invalidate any previous active OTP for this email+purpose. */
  static async invalidateActive(email, purpose) {
    await db.query(
      `UPDATE otp_codes SET consumed_at = NOW()
       WHERE email = $1 AND purpose = $2 AND consumed_at IS NULL`,
      [email, purpose]
    );
  }

  static async create({ email, purpose, codeHash, expiresAt }) {
    const { rows } = await db.query(
      `INSERT INTO otp_codes (email, purpose, code_hash, expires_at)
       VALUES ($1, $2, $3, $4) RETURNING id, expires_at`,
      [email, purpose, codeHash, expiresAt]
    );
    return rows[0];
  }

  static async lastCreatedAt(email, purpose) {
    const { rows } = await db.query(
      `SELECT created_at FROM otp_codes
       WHERE email = $1 AND purpose = $2 ORDER BY created_at DESC LIMIT 1`,
      [email, purpose]
    );
    return rows[0] ? new Date(rows[0].created_at) : null;
  }

  /**
   * Atomically bump the attempt counter on the latest active OTP and return it.
   * Row-locking stops parallel guesses from bypassing the attempt limit.
   */
  static async claimAttempt(email, purpose, maxAttempts) {
    const { rows } = await db.query(
      `UPDATE otp_codes SET attempts = attempts + 1
       WHERE id = (
         SELECT id FROM otp_codes
         WHERE email = $1 AND purpose = $2
           AND consumed_at IS NULL AND expires_at > NOW() AND attempts < $3
         ORDER BY created_at DESC LIMIT 1 FOR UPDATE
       )
       RETURNING id, code_hash`,
      [email, purpose, maxAttempts]
    );
    return rows[0] || null;
  }

  /** Single-use: returns true only for the one caller who consumes it. */
  static async consume(id) {
    const { rowCount } = await db.query(
      `UPDATE otp_codes SET consumed_at = NOW() WHERE id = $1 AND consumed_at IS NULL`,
      [id]
    );
    return rowCount === 1;
  }
}

module.exports = OtpModel;
