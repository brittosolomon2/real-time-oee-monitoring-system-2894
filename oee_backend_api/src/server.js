const app = require('./app');
const { initDb, closeDb } = require('./db');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

let server = null;

/**
 * Boots the HTTP server after DB schema/seed is ready.
 */
async function start() {
  // Initialize DB on startup so schema + seed are ready before serving requests.
  await initDb();

  server = app.listen(PORT, HOST, () => {
    // eslint-disable-next-line no-console
    console.log(`Server running at http://${HOST}:${PORT}`);
  });
}

start().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start server:', err);
  process.exit(1);
});

// Graceful shutdown
function shutdown(signal) {
  // eslint-disable-next-line no-console
  console.log(`${signal} signal received: closing HTTP server`);
  if (!server) process.exit(0);

  server.close(() => {
    closeDb()
      .catch((e) => {
        // eslint-disable-next-line no-console
        console.error('Error closing DB:', e);
      })
      .finally(() => {
        // eslint-disable-next-line no-console
        console.log('HTTP server closed');
        process.exit(0);
      });
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = server;
