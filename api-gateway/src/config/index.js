const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

module.exports = {
  port: parseInt(process.env.GATEWAY_PORT || process.env.PORT || '8000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'super_secret_jwt_hmac_sha256_key_at_least_32_chars_long',
  corsOrigin: process.env.CORS_ORIGIN || '*',

  services: {
    auth: {
      name: 'IAM & Authentication Service',
      module: 'Module 1',
      url: process.env.AUTH_SERVICE_URL || 'http://localhost:4000',
      healthUrl: `${process.env.AUTH_SERVICE_URL || 'http://localhost:4000'}/health`,
      routes: ['/api/auth', '/api/users'],
    },
    classroom: {
      name: 'Classroom & Course Management Service',
      module: 'Module 2 & Module 3 (Gemini OCR/Evaluation)',
      url: process.env.CLASSROOM_SERVICE_URL || 'http://localhost:7000',
      healthUrl: `${process.env.CLASSROOM_SERVICE_URL || 'http://localhost:7000'}/health`,
      routes: [
        '/api/classrooms',
        '/api/assignments',
        '/api/submissions',
        '/api/materials',
        '/api/announcements',
      ],
    },
    chat: {
      name: 'Notification & Real-Time Chat Service',
      module: 'Module 4',
      url: process.env.CHAT_SERVICE_URL || 'http://localhost:5001',
      healthUrl: `${process.env.CHAT_SERVICE_URL || 'http://localhost:5001'}/health`,
      routes: ['/api/chat', '/api/notifications', '/socket.io'],
    },
    performance: {
      name: 'Attendance & Academic Performance Service',
      module: 'Module 5',
      url: process.env.PERFORMANCE_SERVICE_URL || 'http://localhost:6500',
      healthUrl: `${process.env.PERFORMANCE_SERVICE_URL || 'http://localhost:6500'}/health`,
      routes: ['/api/attendance', '/api/marks', '/api/analytics'],
    },
  },
};
