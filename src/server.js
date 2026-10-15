require('dotenv').config();
const app = require('./app');
const db = require('./config/db');

const PORT = process.env.PORT || 4000;

// Test DB connection before listening
db.query('SELECT 1')
  .then(() => {
    console.log('Connected to PostgreSQL successfully.');
    const { startOtpMailer } = require('./services/otpMailer');
startOtpMailer();
    app.listen(PORT, () => {
      console.log(`IAM & Auth Microservice running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.warn('Warning: PostgreSQL connection failed on startup. Server running in standalone/offline mode:', err.message);
    app.listen(PORT, () => {
      console.log(`IAM & Auth Microservice running on port ${PORT} (Database pending)`);
    });
  });
