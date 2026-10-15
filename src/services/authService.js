const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { UserModel, TokenBlacklistModel, FacultyVerificationModel } = require('../models');
const { hashToken } = require('../middleware/auth');
const { eventBus, EVENTS } = require('../events/eventBus');
const { OtpService, OTP_PURPOSES } = require('./otpService');
const { normalizeEmail, isValidEmail, isStudentEmail } = require('../utils/emailValidator');

const JWT_SECRET = process.env.JWT_SECRET || 'default_jwt_secret_dev_key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
const BCRYPT_SALT_ROUNDS = 12;
const GENERIC_OTP_MSG = 'If the details are valid, a verification code has been sent to your email.';

const httpError = (msg, statusCode) => Object.assign(new Error(msg), { statusCode });

class AuthService {
  static isAllowedFacultyDomain(email) {
    const allowed = (process.env.ALLOWED_FACULTY_DOMAINS || 'academia.edu,university.ac.in,faculty.institution.org')
      .split(',').map((d) => d.trim().toLowerCase());
    const domain = email.split('@')[1]?.toLowerCase();
    return Boolean(domain && allowed.includes(domain));
  }

  /** Shared role ↔ email-format rules (used by both request-otp and register). */
  static assertEmailMatchesRole(email, role) {
    if (!isValidEmail(email)) throw httpError('Invalid email address.', 400);

    if (role === 'student') {
      if (!isStudentEmail(email)) {
        throw httpError('Students must register with their official student email (13-digit enrollment number, e.g. 24005201000XX@ietlucknow.ac.in).', 400);
      }
    } else if (role === 'faculty') {
      if (isStudentEmail(email)) throw httpError('Student email addresses cannot register as faculty.', 403);
    } else {
      throw httpError('Role must be either student or faculty.', 400);
    }
  }

  /** Step 1 of registration: validate format, then send OTP asynchronously. */
  static async requestRegistrationOtp({ email, role }) {
    email = normalizeEmail(email);
    this.assertEmailMatchesRole(email, role);

    if (await UserModel.findByEmail(email)) throw httpError('User with this email already exists.', 409);

    await OtpService.request(email, OTP_PURPOSES.REGISTER, { role });
    return { message: 'Verification code sent to your email.' };
  }

  /** Step 2: register with the emailed OTP. */
  static async register({ email, password, firstName, lastName, role, department, otp, facultyOtp }) {
    email = normalizeEmail(email);
    this.assertEmailMatchesRole(email, role);

    if (await UserModel.findByEmail(email)) throw httpError('User with this email already exists.', 409);

    // Off-domain faculty still need an admin pre-authorized OTP
    if (role === 'faculty' && !this.isAllowedFacultyDomain(email)) {
      if (!facultyOtp) {
        throw httpError('Faculty registration requires an institutional email domain or a valid pre-authorized OTP verification code.', 403);
      }
      const otpHash = crypto.createHash('sha256').update(facultyOtp).digest('hex');
      if (!(await FacultyVerificationModel.verifyOtp(email, otpHash))) {
        throw httpError('Invalid or expired faculty verification code (OTP).', 403);
      }
    }

    // Prove ownership of the mailbox (single-use, attempt-limited)
    await OtpService.verify(email, OTP_PURPOSES.REGISTER, otp);

    const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
    const newUser = await UserModel.create({
      email, passwordHash, firstName, lastName, role, department,
      isVerified: true, // email ownership proven via OTP
    });

    await eventBus.publish(EVENTS.USER_REGISTERED, {
      userId: newUser.id, email: newUser.email, role: newUser.role,
      firstName: newUser.first_name, lastName: newUser.last_name, department: newUser.department,
    });
    return newUser;
  }

  static async login({ email, password }) {
    const user = await UserModel.findByEmail(normalizeEmail(email));
    // Compare against a dummy hash when user is missing → uniform timing
    const hash = user?.password_hash || '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidi';
    const isMatch = await bcrypt.compare(password, hash);
    if (!user || !isMatch) throw httpError('Invalid email or password.', 401);
    if (!user.is_verified) throw httpError('Email not verified.', 403);

    const payload = { sub: user.id, userId: user.id, email: user.email, role: user.role, department: user.department };
    const token = jwt.sign(payload, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
      issuer: 'academia-iam-auth-service',
      audience: 'academia-platform-microservices',
    });
    const decoded = jwt.decode(token);

    await eventBus.publish(EVENTS.USER_LOGGED_IN, {
      userId: user.id, email: user.email, role: user.role, loggedInAt: new Date().toISOString(),
    });

    return {
      token,
      expiresAt: new Date(decoded.exp * 1000).toISOString(),
      user: {
        id: user.id, email: user.email, firstName: user.first_name, lastName: user.last_name,
        role: user.role, department: user.department, isVerified: user.is_verified,
      },
    };
  }

  static async logout(rawToken, userId) {
    if (!rawToken) return;
    const decoded = jwt.decode(rawToken);
    const expiresAt = decoded?.exp ? new Date(decoded.exp * 1000) : new Date(Date.now() + 3600000);
    await TokenBlacklistModel.addToken(hashToken(rawToken), expiresAt);
    await eventBus.publish(EVENTS.USER_LOGGED_OUT, { userId, loggedOutAt: new Date().toISOString() });
  }

  /** Password reset via OTP. Always returns the same response (no account enumeration). */
  static async forgotPassword(email) {
    email = normalizeEmail(email);
    const user = isValidEmail(email) ? await UserModel.findByEmail(email) : null;

    if (user) {
      try {
        await OtpService.request(email, OTP_PURPOSES.PASSWORD_RESET, { userId: user.id });
      } catch (err) {
        if (err.statusCode !== 429) throw err; // swallow cooldown so response stays identical
      }
    }
    return { message: GENERIC_OTP_MSG };
  }

  static async resetPassword({ email, otp, newPassword }) {
    email = normalizeEmail(email);
    const user = await UserModel.findByEmail(email);
    if (!user) throw httpError('Invalid or expired verification code.', 400);

    await OtpService.verify(email, OTP_PURPOSES.PASSWORD_RESET, otp);

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);
    await UserModel.updatePassword(user.id, passwordHash);

    await eventBus.publish(EVENTS.PASSWORD_RESET_COMPLETED, { userId: user.id, resetAt: new Date().toISOString() });
    return { message: 'Password has been successfully reset. You may now log in with your new credentials.' };
  }

  static async getProfile(userId) {
    const user = await UserModel.findById(userId);
    if (!user) throw httpError('User not found.', 404);
    return user;
  }

  static async updateProfile(userId, { firstName, lastName, department }) {
    const updated = await UserModel.updateProfile(userId, { firstName, lastName, department });
    if (!updated) throw httpError('User not found.', 404);
    await eventBus.publish(EVENTS.USER_PROFILE_UPDATED, {
      userId: updated.id, firstName: updated.first_name, lastName: updated.last_name, department: updated.department,
    });
    return updated;
  }

  static async generateFacultyOtp(email) {
    const otp = crypto.randomInt(100000, 1000000).toString();
    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
    await FacultyVerificationModel.createOtp(email, otpHash, new Date(Date.now() + 60 * 60 * 1000));
    return otp;
  }
}

module.exports = AuthService;
