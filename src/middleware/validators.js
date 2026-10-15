const { isValidEmail } = require('../utils/emailValidator');

// ── rule helpers: return an error string, or null if OK ────────────────────
const str = (label, { min = 1, max = 100, optional = false } = {}) => (v) => {
  if (v === undefined || v === null || v === '') return optional ? null : `${label} is required.`;
  if (typeof v !== 'string') return `${label} must be a string.`;
  const len = v.trim().length;
  if (len < min) return `${label} must be at least ${min} characters.`;
  if (len > max) return `${label} must be at most ${max} characters.`;
  return null;
};

const email = () => (v) => (isValidEmail(v) ? null : 'A valid email is required.');

const password = (label = 'Password') => (v) => {
  if (typeof v !== 'string' || v.length < 8) return `${label} must be at least 8 characters.`;
  if (v.length > 72) return `${label} must be at most 72 characters.`; // bcrypt limit
  if (!/[a-z]/.test(v) || !/[A-Z]/.test(v) || !/\d/.test(v)) {
    return `${label} must include upper-case, lower-case and a number.`;
  }
  return null;
};

const otp6 = () => (v) => (/^\d{6}$/.test(String(v || '')) ? null : 'OTP must be a 6-digit code.');

const oneOf = (label, values) => (v) => (values.includes(v) ? null : `${label} must be one of: ${values.join(', ')}.`);

const validate = (rules) => (req, res, next) => {
  const errors = [];
  for (const [field, rule] of Object.entries(rules)) {
    const msg = rule(req.body?.[field], req.body);
    if (msg) errors.push({ field, message: msg });
  }
  if (errors.length) {
    return res.status(400).json({ success: false, message: 'Validation failed.', errors });
  }
  next();
};

module.exports = {
  validateRequestRegistrationOtp: validate({
    email: email(),
    role: oneOf('role', ['student', 'faculty']),
  }),
  validateRegister: validate({
    email: email(),
    password: password(),
    firstName: str('First name', { max: 50 }),
    lastName: str('Last name', { max: 50 }),
    role: oneOf('role', ['student', 'faculty']),
    department: str('Department', { max: 100, optional: true }),
    otp: otp6(),
  }),
  validateLogin: validate({
    email: email(),
    password: str('Password', { max: 72 }),
  }),
  validateForgotPassword: validate({ email: email() }),
  validateResetPassword: validate({
    email: email(),
    otp: otp6(),
    newPassword: password('New password'),
  }),
  validateUpdateProfile: validate({
    firstName: str('First name', { max: 50 }),
    lastName: str('Last name', { max: 50 }),
    department: str('Department', { max: 100, optional: true }),
  }),
};
