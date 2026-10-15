const db = require('../config/db');

const migrate = async () => {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // Enable uuid-ossp if available or use gen_random_uuid()
    await client.query(`
      CREATE EXTENSION IF NOT EXISTS "pgcrypto";

      -- User Roles enum
      DO $$ BEGIN
        CREATE TYPE user_role AS ENUM ('student', 'faculty', 'admin');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;

      -- Users table
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        role user_role NOT NULL DEFAULT 'student',
        department VARCHAR(100),
        is_verified BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Faculty Verification tokens / OTP table
      CREATE TABLE IF NOT EXISTS faculty_verification_codes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) NOT NULL,
        code VARCHAR(64) NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Password Reset Tokens table
      CREATE TABLE IF NOT EXISTS password_resets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        reset_token_hash VARCHAR(255) NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        used BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Token Revocation / Blacklist table (for logout & immediate revocation)
      CREATE TABLE IF NOT EXISTS token_blacklist (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        token_hash VARCHAR(255) UNIQUE NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Indexes for performance
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
      CREATE INDEX IF NOT EXISTS idx_token_blacklist_hash ON token_blacklist(token_hash);
      CREATE INDEX IF NOT EXISTS idx_password_resets_user_id ON password_resets(user_id);
    `);

    await client.query('COMMIT');
    console.log('Database migration completed successfully.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', error);
    throw error;
  } finally {
    client.release();
  }
};

if (require.main === module) {
  migrate().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = migrate;
