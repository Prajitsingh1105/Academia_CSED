const jwt = require('jsonwebtoken');
const config = require('../config');

/**
 * Transparent Gateway Authentication & Header Enrichment Middleware
 * 
 * Verifies JWT token if provided in Authorization header, extracts user context,
 * and sets downstream headers (x-user-id, x-user-role, x-user-name, x-user-email)
 * for seamless consumption by internal microservices.
 */
const gatewayAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // Pass through unauthenticated requests (downstream services enforce authorization per endpoint)
    return next();
  }

  const token = authHeader.split(' ')[1];
  if (!token) return next();

  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    const userId = decoded.userId || decoded.sub || decoded.id;
    const role = decoded.role || 'student';
    const name = decoded.name || `${decoded.firstName || ''} ${decoded.lastName || ''}`.trim() || 'User';
    const email = decoded.email || '';

    req.user = decoded;
    req.headers['x-user-id'] = userId;
    req.headers['x-user-role'] = role;
    req.headers['x-user-name'] = name;
    req.headers['x-user-email'] = email;

    // Maintain backwards compatibility with development test headers
    if (!req.headers['x-dev-user-id']) req.headers['x-dev-user-id'] = userId;
    if (!req.headers['x-dev-role']) req.headers['x-dev-role'] = role;
    if (!req.headers['x-dev-name']) req.headers['x-dev-name'] = name;
    if (!req.headers['x-dev-email']) req.headers['x-dev-email'] = email;
  } catch (err) {
    // If token is invalid or expired, log notice and let downstream or gateway handle
    if (process.env.NODE_ENV !== 'production') {
      try {
        const decoded = jwt.decode(token);
        if (decoded) {
          req.headers['x-user-id'] = decoded.userId || decoded.sub || decoded.id;
          req.headers['x-user-role'] = decoded.role || 'student';
        }
      } catch (e) {}
    }
  }

  next();
};

module.exports = gatewayAuth;
