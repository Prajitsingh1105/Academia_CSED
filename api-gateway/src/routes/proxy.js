const { createProxyMiddleware } = require('http-proxy-middleware');
const config = require('../config');

/**
 * Common proxy error handler
 */
function createProxyErrorHandler(serviceName, targetUrl) {
  return (err, req, res) => {
    const requestId = req.id || req.headers['x-request-id'] || 'unknown';
    console.error(`[API-GATEWAY PROXY ERROR] Failed to route to ${serviceName} (${targetUrl}):`, err.message);

    if (res && !res.headersSent && typeof res.status === 'function') {
      res.status(503).json({
        success: false,
        error: 'Service Unavailable',
        message: `The downstream service '${serviceName}' is currently unreachable at ${targetUrl}. Please ensure the service is running.`,
        service: serviceName,
        target: targetUrl,
        statusCode: 503,
        requestId,
        timestamp: new Date().toISOString(),
      });
    }
  };
}

/**
 * Decorates outgoing proxy request headers with tracking and authentication context
 */
function onProxyReq(proxyReq, req, res) {
  // Ensure correlation ID is forwarded
  if (req.id) {
    proxyReq.setHeader('x-request-id', req.id);
  }

  // Forward enriched user context headers if present
  if (req.headers['x-user-id']) proxyReq.setHeader('x-user-id', req.headers['x-user-id']);
  if (req.headers['x-user-role']) proxyReq.setHeader('x-user-role', req.headers['x-user-role']);
  if (req.headers['x-user-name']) proxyReq.setHeader('x-user-name', req.headers['x-user-name']);
  if (req.headers['x-user-email']) proxyReq.setHeader('x-user-email', req.headers['x-user-email']);

  // Forward development compatibility headers if present
  if (req.headers['x-dev-user-id']) proxyReq.setHeader('x-dev-user-id', req.headers['x-dev-user-id']);
  if (req.headers['x-dev-role']) proxyReq.setHeader('x-dev-role', req.headers['x-dev-role']);
  if (req.headers['x-dev-name']) proxyReq.setHeader('x-dev-name', req.headers['x-dev-name']);
  if (req.headers['x-dev-email']) proxyReq.setHeader('x-dev-email', req.headers['x-dev-email']);
}

/**
 * Configure and register all downstream microservice reverse proxies on Express app
 */
function setupProxies(app) {
  // ── 1. Module 1: IAM & Auth Service (Port 4000) ──────────────────────────
  app.use(
    createProxyMiddleware({
      target: config.services.auth.url,
      changeOrigin: true,
      pathFilter: ['/api/auth', '/api/users'],
      on: {
        proxyReq: onProxyReq,
        error: createProxyErrorHandler(config.services.auth.name, config.services.auth.url),
      },
    })
  );

  // ── 2. Module 2 & 3: Classroom, Assignments & Gemini OCR (Port 7000) ─────
  app.use(
    createProxyMiddleware({
      target: config.services.classroom.url,
      changeOrigin: true,
      pathFilter: [
        '/api/classrooms',
        '/api/assignments',
        '/api/submissions',
        '/api/materials',
        '/api/announcements',
        '/api/dev',
      ],
      on: {
        proxyReq: onProxyReq,
        error: createProxyErrorHandler(config.services.classroom.name, config.services.classroom.url),
      },
    })
  );

  // ── 3. Module 4: Notification & Real-Time Chat (Port 5001) ───────────────
  app.use(
    createProxyMiddleware({
      target: config.services.chat.url,
      changeOrigin: true,
      ws: true,
      pathFilter: ['/api/chat', '/api/notifications'],
      on: {
        proxyReq: onProxyReq,
        error: createProxyErrorHandler(config.services.chat.name, config.services.chat.url),
      },
    })
  );

  // Socket.IO WebSocket reverse proxy route
  app.use(
    createProxyMiddleware({
      target: config.services.chat.url,
      changeOrigin: true,
      ws: true,
      pathFilter: ['/socket.io'],
      on: {
        error: createProxyErrorHandler('Socket.IO Gateway Proxy', config.services.chat.url),
      },
    })
  );

  // ── 4. Module 5: Attendance & Academic Performance (Port 6500) ───────────
  app.use(
    createProxyMiddleware({
      target: config.services.performance.url,
      changeOrigin: true,
      pathFilter: ['/api/attendance', '/api/marks', '/api/analytics'],
      on: {
        proxyReq: onProxyReq,
        error: createProxyErrorHandler(config.services.performance.name, config.services.performance.url),
      },
    })
  );
}

module.exports = { setupProxies };
