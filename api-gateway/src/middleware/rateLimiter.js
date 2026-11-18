const rateLimit = require('express-rate-limit');

/**
 * Gateway-wide Rate Limiter
 * Guards downstream microservices against DoS and abusive request floods
 */
const gatewayRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1500, // 1500 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip health checks and static files from rate limiting
    return req.path === '/health' || req.path === '/api/health' || req.path.startsWith('/socket.io');
  },
  message: {
    success: false,
    error: 'Too Many Requests',
    message: 'Too many requests dispatched through API Gateway. Please slow down and try again later.',
    statusCode: 429,
  },
});

module.exports = gatewayRateLimiter;
