const express = require('express');
const http = require('http');
const https = require('https');
const config = require('../config');

const router = express.Router();

/**
 * Helper to ping a downstream health endpoint with timeout
 */
function probeService(serviceKey, serviceConfig) {
  return new Promise((resolve) => {
    const start = Date.now();
    try {
      const parsedUrl = new URL(serviceConfig.healthUrl);
      const isHttps = parsedUrl.protocol === 'https:';
      const requester = isHttps ? https : http;

      const req = requester.get(
        parsedUrl,
        {
          timeout: 2500,
          headers: { 'User-Agent': 'Academia-API-Gateway-HealthCheck' },
        },
        (res) => {
          let body = '';
          res.on('data', (chunk) => (body += chunk));
          res.on('end', () => {
            const latencyMs = Date.now() - start;
            let parsed = null;
            try {
              parsed = JSON.parse(body);
            } catch (e) {
              parsed = { raw: body.slice(0, 100) };
            }

            resolve({
              service: serviceConfig.name,
              module: serviceConfig.module,
              target: serviceConfig.url,
              status: res.statusCode === 200 ? 'UP' : 'UNHEALTHY',
              statusCode: res.statusCode,
              latencyMs,
              details: parsed,
            });
          });
        }
      );

      req.on('error', (err) => {
        resolve({
          service: serviceConfig.name,
          module: serviceConfig.module,
          target: serviceConfig.url,
          status: 'DOWN',
          statusCode: 503,
          latencyMs: Date.now() - start,
          error: err.message,
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({
          service: serviceConfig.name,
          module: serviceConfig.module,
          target: serviceConfig.url,
          status: 'TIMEOUT',
          statusCode: 504,
          latencyMs: Date.now() - start,
          error: 'Health check timed out after 2500ms',
        });
      });
    } catch (e) {
      resolve({
        service: serviceConfig.name,
        module: serviceConfig.module,
        target: serviceConfig.url,
        status: 'ERROR',
        error: e.message,
      });
    }
  });
}

/**
 * GET /health or GET /api/health
 * Aggregated ecosystem health dashboard
 */
router.get('/', async (req, res) => {
  const probePromises = Object.entries(config.services).map(([key, s]) =>
    probeService(key, s)
  );

  const results = await Promise.all(probePromises);

  const isAllUp = results.every((r) => r.status === 'UP');
  const isAnyUp = results.some((r) => r.status === 'UP');

  const systemStatus = isAllUp ? 'HEALTHY' : isAnyUp ? 'DEGRADED' : 'CRITICAL';
  const httpCode = isAllUp ? 200 : 207;

  res.status(httpCode).json({
    status: systemStatus,
    gateway: {
      name: 'Academia Unified API Gateway',
      version: '1.0.0',
      port: config.port,
      environment: config.nodeEnv,
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    },
    downstreamServices: results,
  });
});

module.exports = router;
