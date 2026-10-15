const errorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);

  const statusCode = err.statusCode || 500;
  const isDev = process.env.NODE_ENV === 'development';

  // Don't leak internal error text for server faults outside dev
  const message =
    statusCode >= 500 && !isDev
      ? 'Internal Server Error'
      : err.message || 'Internal Server Error';

  // Server-side logs are private, so always keep the stack
  console.error(`[Error] ${req.method} ${req.url}:`, {
    statusCode,
    message: err.message,
    stack: err.stack,
  });

  res.status(statusCode).json({
    success: false,
    message,
    ...(err.retryAfter && { retryAfter: err.retryAfter }),
    ...(isDev && { stack: err.stack }),
  });
};

module.exports = errorHandler;