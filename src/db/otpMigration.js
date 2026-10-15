const db = require('../config/db');

const sql = `
CREATE TABLE IF NOT EXISTS otp_codes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       VARCHAR(255) NOT NULL,
  purpose     VARCHAR(30)  NOT NULL CHECK (purpose IN ('REGISTER', 'PASSWORD_RESET')),
  code_hash   CHAR(64)     NOT NULL,
  attempts    SMALLINT     NOT NULL DEFAULT 0,
  expires_at  TIMESTAMPTZ  NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_otp_lookup ON otp_codes (email, purpose, created_at DESC);
`;

async function up() {
  await db.query(sql);
}

module.exports = { up, sql };

// Standalone run:  node src/db/otpMigration.js
if (require.main === module) {
  up()
    .then(() => { console.log('otp_codes table ready'); process.exit(0); })
    .catch((err) => { console.error(err); process.exit(1); });
}
