const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const config = require('./config');
const requestLogger = require('./middleware/requestLogger');
const gatewayAuth = require('./middleware/auth');
const gatewayRateLimiter = require('./middleware/rateLimiter');
const gatewayErrorHandler = require('./middleware/errorHandler');

const healthRoutes = require('./routes/health');
const { getRegistry } = require('./routes/registry');
const { setupProxies } = require('./routes/proxy');

const app = express();

// ── 1. Security & Diagnostic Headers ─────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: false,
  })
);

// ── 2. CORS Handling ──────────────────────────────────────────────────────────
app.use(
  cors({
    origin: config.corsOrigin === '*' ? true : [config.corsOrigin, 'http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Request-Id',
      'x-dev-user-id',
      'x-dev-role',
      'x-dev-name',
      'x-dev-email',
      'x-user-id',
      'x-user-role',
    ],
    exposedHeaders: ['X-Request-Id'],
  })
);

// ── 3. Correlation Tracking & Request Logging ─────────────────────────────────
app.use(requestLogger);

// ── 4. Gateway Rate Limiting ──────────────────────────────────────────────────
app.use(gatewayRateLimiter);

// ── 5. Gateway Authentication & Header Enrichment ─────────────────────────────
app.use(gatewayAuth);

// ── 6. Root Directory & Aggregated Health Probes ───────────────────────────────
app.use('/health', healthRoutes);
app.use('/api/health', healthRoutes);

app.get('/favicon.ico', (req, res) => res.status(204).end());
app.get('/', getRegistry);
app.get('/api', getRegistry);

// ── 7. Reverse Proxying (Mounted BEFORE body parsers for raw streaming) ────────
setupProxies(app);

// ── 8. Unmatched Route Fallback ───────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route Not Found',
    message: `No microservice route is registered at ${req.method} ${req.originalUrl}. Visit GET / or GET /api for the full gateway routing directory.`,
    statusCode: 404,
    requestId: req.id || req.headers['x-request-id'],
    timestamp: new Date().toISOString(),
  });
});

// ── 9. Centralized Gateway Error Handler ──────────────────────────────────────
app.use(gatewayErrorHandler);

module.exports = app;
