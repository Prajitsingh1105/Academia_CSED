const express = require('express');
const rateLimit = require('express-rate-limit');
const AuthController = require('../controllers/authController');
const { verifyToken: authenticate } = require('../middleware/auth');
const v = require('../middleware/validators');

const router = express.Router();

// Strict limiter for anything that sends or verifies an OTP
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts. Try again later.' },
});

// Looser limiter for login (brute-force protection)
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });

// Faculty pre-auth OTP generator must never be public in production
const devOnly = (req, res, next) =>
  process.env.NODE_ENV === 'production'
    ? res.status(404).json({ success: false, message: 'Not found.' })
    : next();

// ── Registration (OTP) ─────────────────────────────────────────────────────
router.post('/register/request-otp', otpLimiter, v.validateRequestRegistrationOtp, AuthController.requestRegistrationOtp);
router.post('/register', otpLimiter, v.validateRegister, AuthController.register);

// ── Session ────────────────────────────────────────────────────────────────
router.post('/login', loginLimiter, v.validateLogin, AuthController.login);
router.post('/logout', authenticate, AuthController.logout);

// ── Password reset (OTP) ───────────────────────────────────────────────────
router.post('/forgot-password', otpLimiter, v.validateForgotPassword, AuthController.forgotPassword);
router.post('/reset-password', otpLimiter, v.validateResetPassword, AuthController.resetPassword);

// ── Profile ────────────────────────────────────────────────────────────────
router.get('/profile', authenticate, AuthController.getProfile);
router.put('/profile', authenticate, v.validateUpdateProfile, AuthController.updateProfile);

// ── Admin / dev utility ────────────────────────────────────────────────────
router.post('/faculty-otp', devOnly, AuthController.generateFacultyOtp);

module.exports = router;
