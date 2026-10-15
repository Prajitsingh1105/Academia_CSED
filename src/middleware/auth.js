const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { TokenBlacklistModel, UserModel } = require('../models');

const JWT_SECRET = process.env.JWT_SECRET || 'default_jwt_secret_dev_key';

/**
 * Hash a token string (using SHA-256) for secure storage in database / blacklist
 */
const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

/**
 * Middleware: Verify JWT and ensure token has not been revoked/blacklisted
 */
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authentication token missing or invalid format. Expected "Bearer <token>"',
      });
    }

    const token = authHeader.split(' ')[1];
    const hashed = hashToken(token);

    // Check blacklist (e.g. user logged out)
    const isRevoked = await TokenBlacklistModel.isBlacklisted(hashed);
    if (isRevoked) {
      return res.status(401).json({
        success: false,
        message: 'Token has been revoked or expired. Please log in again.',
      });
    }

    // Verify signature and expiration
    const decoded = jwt.verify(token, JWT_SECRET);

    // Verify user still exists in database
    const user = await UserModel.findById(decoded.sub || decoded.userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User associated with this token no longer exists.',
      });
    }

    // Attach user information to request
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      department: user.department,
    };
    req.rawToken = token;

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token has expired.' });
    }
    return res.status(401).json({ success: false, message: 'Invalid authentication token.' });
  }
};

/**
 * Middleware factory: Role-Based Access Control (RBAC) guard
 * @param  {...string} allowedRoles Allowed roles for the endpoint (e.g. 'student', 'faculty', 'admin')
 */
const requireRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: User authentication required.',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: Access requires one of the following roles: [${allowedRoles.join(', ')}]. Current role: '${req.user.role}'`,
      });
    }

    next();
  };
};

module.exports = {
  verifyToken,
  requireRoles,
  hashToken,
};
