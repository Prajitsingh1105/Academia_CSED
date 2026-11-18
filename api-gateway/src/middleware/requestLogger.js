const crypto = require('crypto');

/**
 * Request correlation & logger middleware
 * Attaches a unique x-request-id for distributed tracing across all microservices
 */
const requestLogger = (req, res, next) => {
  const requestId = req.headers['x-request-id'] || crypto.randomUUID();
  req.id = requestId;
  req.headers['x-request-id'] = requestId;
  res.setHeader('X-Request-Id', requestId);

  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logLevel = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    const logMsg = `[API-GATEWAY] [${requestId.slice(0, 8)}] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${duration}ms)`;

    if (logLevel === 'error') {
      console.error(logMsg);
    } else if (process.env.NODE_ENV !== 'production' || res.statusCode >= 400) {
      console.log(logMsg);
    }
  });

  next();
};

module.exports = requestLogger;
