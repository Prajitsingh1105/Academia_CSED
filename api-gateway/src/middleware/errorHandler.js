/**
 * Global Gateway Error Handler
 * Standardizes upstream and proxy error representations
 */
const gatewayErrorHandler = (err, req, res, next) => {
  const requestId = req.id || req.headers['x-request-id'] || 'unknown';
  const statusCode = err.status || err.statusCode || 500;

  console.error(`[API-GATEWAY ERROR] [${requestId.slice(0, 8)}] ${req.method} ${req.originalUrl}:`, err.message);

  if (res.headersSent) {
    return next(err);
  }

  res.status(statusCode).json({
    success: false,
    error: err.name || 'Gateway Error',
    message: err.message || 'An unexpected gateway routing error occurred.',
    statusCode,
    requestId,
    timestamp: new Date().toISOString(),
  });
};

module.exports = gatewayErrorHandler;
