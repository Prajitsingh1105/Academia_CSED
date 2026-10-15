const db = require('../config/db');

class UserModel {
  static async create({ email, passwordHash, firstName, lastName, role, department, isVerified = false }) {
    const query = `
      INSERT INTO users (email, password_hash, first_name, last_name, role, department, is_verified)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, email, first_name, last_name, role, department, is_verified, created_at, updated_at;
    `;
    const values = [email.toLowerCase(), passwordHash, firstName, lastName, role, department || null, isVerified];
    const { rows } = await db.query(query, values);
    return rows[0];
  }

  static async findByEmail(email) {
    const query = `
      SELECT id, email, password_hash, first_name, last_name, role, department, is_verified, created_at, updated_at
      FROM users
      WHERE email = $1;
    `;
    const { rows } = await db.query(query, [email.toLowerCase()]);
    return rows[0] || null;
  }

  static async findById(id) {
    const query = `
      SELECT id, email, first_name, last_name, role, department, is_verified, created_at, updated_at
      FROM users
      WHERE id = $1;
    `;
    const { rows } = await db.query(query, [id]);
    return rows[0] || null;
  }

  static async updateProfile(id, { firstName, lastName, department }) {
    const query = `
      UPDATE users
      SET first_name = COALESCE($1, first_name),
          last_name = COALESCE($2, last_name),
          department = COALESCE($3, department),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING id, email, first_name, last_name, role, department, is_verified, created_at, updated_at;
    `;
    const { rows } = await db.query(query, [firstName, lastName, department, id]);
    return rows[0] || null;
  }

  static async updatePassword(id, passwordHash) {
    const query = `
      UPDATE users
      SET password_hash = $1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id, email;
    `;
    const { rows } = await db.query(query, [passwordHash, id]);
    return rows[0] || null;
  }
}

class TokenBlacklistModel {
  static async addToken(tokenHash, expiresAt) {
    const query = `
      INSERT INTO token_blacklist (token_hash, expires_at)
      VALUES ($1, $2)
      ON CONFLICT (token_hash) DO NOTHING;
    `;
    await db.query(query, [tokenHash, expiresAt]);
  }

  static async isBlacklisted(tokenHash) {
    const query = `
      SELECT 1 FROM token_blacklist
      WHERE token_hash = $1 AND expires_at > CURRENT_TIMESTAMP;
    `;
    const { rows } = await db.query(query, [tokenHash]);
    return rows.length > 0;
  }
}

class PasswordResetModel {
  static async createResetToken(userId, tokenHash, expiresAt) {
    // Invalidate prior unused tokens
    await db.query(`UPDATE password_resets SET used = true WHERE user_id = $1 AND used = false;`, [userId]);

    const query = `
      INSERT INTO password_resets (user_id, reset_token_hash, expires_at)
      VALUES ($1, $2, $3)
      RETURNING id, expires_at;
    `;
    const { rows } = await db.query(query, [userId, tokenHash, expiresAt]);
    return rows[0];
  }

  static async findValidToken(tokenHash) {
    const query = `
      SELECT id, user_id, expires_at, used
      FROM password_resets
      WHERE reset_token_hash = $1
        AND used = false
        AND expires_at > CURRENT_TIMESTAMP;
    `;
    const { rows } = await db.query(query, [tokenHash]);
    return rows[0] || null;
  }

  static async markAsUsed(id) {
    const query = `
      UPDATE password_resets
      SET used = true
      WHERE id = $1;
    `;
    await db.query(query, [id]);
  }
}

class FacultyVerificationModel {
  static async createOtp(email, codeHash, expiresAt) {
    const query = `
      INSERT INTO faculty_verification_codes (email, code, expires_at)
      VALUES ($1, $2, $3)
      RETURNING id;
    `;
    const { rows } = await db.query(query, [email.toLowerCase(), codeHash, expiresAt]);
    return rows[0];
  }

  static async verifyOtp(email, codeHash) {
    const query = `
      SELECT id FROM faculty_verification_codes
      WHERE email = $1 AND code = $2 AND expires_at > CURRENT_TIMESTAMP
      ORDER BY created_at DESC
      LIMIT 1;
    `;
    const { rows } = await db.query(query, [email.toLowerCase(), codeHash]);
    return rows.length > 0;
  }
}

module.exports = {
  UserModel,
  TokenBlacklistModel,
  PasswordResetModel,
  FacultyVerificationModel,
};
