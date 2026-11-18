const express = require('express');
const config = require('../config');

const router = express.Router();

/**
 * GET / or GET /api
 * Returns the API Gateway Directory Catalog
 */
function getRegistry(req, res) {
  res.status(200).json({
    name: 'Academia Institutional API Gateway',
    version: '1.0.0',
    description: 'Unified Entry Point & Reverse Proxy for Academia Microservices Ecosystem',
    documentation: 'https://github.com/academia/platform',
    gatewayUrl: `http://localhost:${config.port}`,
    healthCheck: `http://localhost:${config.port}/health`,
    routingDirectory: [
      {
        service: config.services.auth.name,
        module: config.services.auth.module,
        target: config.services.auth.url,
        prefixes: config.services.auth.routes,
        description: 'User registration, OTP verification, login, JWT token management, and profile access.',
      },
      {
        service: config.services.classroom.name,
        module: config.services.classroom.module,
        target: config.services.classroom.url,
        prefixes: config.services.classroom.routes,
        description: 'Course registration, classroom joining codes, assignment deliverables, lecture materials, announcements, and Gemini OCR plagiarism evaluation.',
      },
      {
        service: config.services.chat.name,
        module: config.services.chat.module,
        target: config.services.chat.url,
        prefixes: config.services.chat.routes,
        description: 'Real-time WebSocket chat, course discussion forums, and automated student/faculty notifications.',
      },
      {
        service: config.services.performance.name,
        module: config.services.performance.module,
        target: config.services.performance.url,
        prefixes: config.services.performance.routes,
        description: 'Roll call session registers, 75% safe-leave margin calculations, academic gradebook marks, and cohort analytics.',
      },
    ],
    timestamp: new Date().toISOString(),
  });
}

router.get('/', getRegistry);

module.exports = { router, getRegistry };
