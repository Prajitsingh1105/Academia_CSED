const validator = require('validator');

/**
 * Student email format. Override via STUDENT_EMAIL_REGEX in .env.
 * Capture group 1 must be the enrollment / roll number.
 * IET Lucknow format: 13-digit enrollment number, e.g. 24005201000XX@ietlucknow.ac.in
 */
const STUDENT_EMAIL_REGEX = new RegExp(
  process.env.STUDENT_EMAIL_REGEX || '^(\\d{13})@ietlucknow\\.ac\\.in$',
  'i'
);

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

const isValidEmail = (email) => validator.isEmail(normalizeEmail(email));

const isStudentEmail = (email) => STUDENT_EMAIL_REGEX.test(normalizeEmail(email));

const getEnrollmentNumber = (email) => {
  const m = normalizeEmail(email).match(STUDENT_EMAIL_REGEX);
  return m ? m[1] : null;
};

module.exports = { normalizeEmail, isValidEmail, isStudentEmail, getEnrollmentNumber };
