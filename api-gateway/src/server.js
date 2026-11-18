const http = require('http');
const app = require('./app');
const config = require('./config');

const server = http.createServer(app);

const PORT = config.port;

server.listen(PORT, () => {
  console.log('===========================================================');
  console.log('            ACADEMIA UNIFIED API GATEWAY                  ');
  console.log('===========================================================');
  console.log(` Status:       ONLINE`);
  console.log(` Gateway URL:  http://localhost:${PORT}`);
  console.log(` Health Check: http://localhost:${PORT}/health`);
  console.log(` Directory:    http://localhost:${PORT}/api`);
  console.log('-----------------------------------------------------------');
  console.log(' Reverse Proxy Target Routes:');
  console.log(`  - Module 1 (Auth):        http://localhost:${PORT}/api/auth -> ${config.services.auth.url}`);
  console.log(`  - Module 2 (Classroom):   http://localhost:${PORT}/api/classrooms -> ${config.services.classroom.url}`);
  console.log(`  - Module 3 (Gemini OCR):  http://localhost:${PORT}/api/submissions -> ${config.services.classroom.url}`);
  console.log(`  - Module 4 (Chat/Notifs): http://localhost:${PORT}/api/chat, /notifications -> ${config.services.chat.url}`);
  console.log(`  - Module 4 (WebSockets):  ws://localhost:${PORT}/socket.io -> ${config.services.chat.url}`);
  console.log(`  - Module 5 (Performance): http://localhost:${PORT}/api/attendance, /marks -> ${config.services.performance.url}`);
  console.log('===========================================================');
});

// Graceful Shutdown
const handleShutdown = (signal) => {
  console.log(`\n[API-GATEWAY] Received ${signal}. Initiating graceful shutdown...`);
  server.close(() => {
    console.log('[API-GATEWAY] HTTP and WebSocket listeners closed cleanly.');
    process.exit(0);
  });

  setTimeout(() => {
    console.error('[API-GATEWAY] Forced shutdown due to timeout.');
    process.exit(1);
  }, 5000).unref();
};

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

module.exports = server;
