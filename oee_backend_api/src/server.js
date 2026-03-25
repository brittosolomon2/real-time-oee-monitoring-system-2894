const app = require('./app');
const { getDb, closeDb } = require('./db');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// Initialize DB on startup so schema + seed are ready before serving requests.
getDb();

const server = app.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}`);
});

// Graceful shutdown
function shutdown(signal) {
  console.log(`${signal} signal received: closing HTTP server`);
  server.close(() => {
    try {
      closeDb();
    } catch (e) {
      console.error('Error closing DB:', e);
    }
    console.log('HTTP server closed');
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = server;
