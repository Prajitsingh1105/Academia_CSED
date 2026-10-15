const AuthService = require('../services/authService');
const { normalizeEmail } = require('../utils/emailValidator');

class AuthController {
  // Step 1 of registration: validate email format + send OTP (async delivery)
  static async requestRegistrationOtp(req, res, next) {
    try {
      const { email, role } = req.body;
      const result = await AuthService.requestRegistrationOtp({ email, role });
      return res.status(202).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  // Step 2 of registration: submit details + emailed OTP
  static async register(req, res, next) {
    try {
      const { email, password, firstName, lastName, role, department, otp, facultyOtp } = req.body;
      const user = await AuthService.register({
        email, password, firstName, lastName, role, department, otp, facultyOtp,
      });

      return res.status(201).json({
        success: true,
        message: 'User registered successfully.',
        data: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role,
          department: user.department,
          isVerified: user.is_verified,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  static async login(req, res, next) {
    try {
      const { email, password } = req.body;
      const authResult = await AuthService.login({ email, password });
      return res.status(200).json({ success: true, message: 'Login successful.', data: authResult });
    } catch (err) {
      next(err);
    }
  }

  static async logout(req, res, next) {
    try {
      await AuthService.logout(req.rawToken, req.user.id);
      return res.status(200).json({
        success: true,
        message: 'Logged out successfully. Token has been invalidated.',
      });
    } catch (err) {
      next(err);
    }
  }

  static async forgotPassword(req, res, next) {
    try {
      const result = await AuthService.forgotPassword(req.body.email);
      return res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  // Now OTP-based: { email, otp, newPassword }
  static async resetPassword(req, res, next) {
    try {
      const { email, otp, newPassword } = req.body;
      const result = await AuthService.resetPassword({ email, otp, newPassword });
      return res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  static async getProfile(req, res, next) {
    try {
      const user = await AuthService.getProfile(req.user.id);
      return res.status(200).json({
        success: true,
        data: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role,
          department: user.department,
          isVerified: user.is_verified,
          createdAt: user.created_at,
          updatedAt: user.updated_at,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  static async updateProfile(req, res, next) {
    try {
      const { firstName, lastName, department } = req.body;
      const updated = await AuthService.updateProfile(req.user.id, { firstName, lastName, department });
      return res.status(200).json({
        success: true,
        message: 'Profile updated successfully.',
        data: {
          id: updated.id,
          email: updated.email,
          firstName: updated.first_name,
          lastName: updated.last_name,
          role: updated.role,
          department: updated.department,
          isVerified: updated.is_verified,
          updatedAt: updated.updated_at,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  // Dev / admin utility: pre-authorise an off-domain faculty email
  static async generateFacultyOtp(req, res, next) {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ success: false, message: 'Email is required' });
      const normalizedEmail = normalizeEmail(email);
      const otp = await AuthService.generateFacultyOtp(normalizedEmail);
      return res.status(200).json({ success: true, message: 'Faculty verification OTP generated.', otp });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = AuthController;
