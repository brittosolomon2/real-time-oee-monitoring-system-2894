const app = require('./app');
const { initDb, closeDb } = require('./db');

/**
 * Resolve the host/port the server should bind to.
 *
 * Preview environments typically expect the backend to be reachable on a fixed port.
 * We default to 0.0.0.0:3001, but still allow overrides via env vars.
 *
 * Supported overrides:
 * - PORT: numeric TCP port
 * - HOST: bind host (e.g. 127.0.0.1, 0.0.0.0)
 */
function getBindConfig() {
  const DEFAULT_PORT = 3001;
  const DEFAULT_HOST = '0.0.0.0';

  const portRaw = process.env.PORT;
  const hostRaw = process.env.HOST;

  const parsedPort = portRaw ? Number.parseInt(String(portRaw), 10) : NaN;
  const port =
    Number.isFinite(parsedPort) && parsedPort > 0 && parsedPort < 65536 ? parsedPort : DEFAULT_PORT;

  const host = (hostRaw && String(hostRaw).trim()) || DEFAULT_HOST;

  return { host, port };
}

const { port: PORT, host: HOST } = getBindConfig();

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
