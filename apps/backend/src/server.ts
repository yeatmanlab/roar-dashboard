import 'dotenv/config';
import fs from 'fs';
import http from 'http';
import https from 'https';
import app from './app';
import { initializeDatabasePools, closeDatabasePools } from './db/clients';
import { logger } from './logger';

const { NODE_ENV = 'development', PORT = '4000', KEEP_ALIVE_TIMEOUT = '75000' } = process.env;

const port: number = parseInt(PORT, 10);
app.set('port', port);

let server: http.Server | https.Server;

/**
 * Handle server "error" events gracefully.
 * Provides friendly messages for common errors like permission denied or port in use.
 *
 * @param error - The error object.
 * @returns void
 */
function onError(error: NodeJS.ErrnoException): void {
  if (error.syscall !== 'listen') throw error;

  const bind = `Port ${port}`;

  switch (error.code) {
    case 'EACCES':
      logger.fatal({ port, code: error.code }, `${bind} requires elevated privileges`);
      process.exit(1);
      break;
    case 'EADDRINUSE':
      logger.fatal({ port, code: error.code }, `${bind} is already in use`);
      process.exit(1);
      break;
    default:
      throw error;
  }
}

/**
 * Handle server "listening" events.
 * Logs the port or pipe the server is bound to.
 *
 * @returns void
 */
function onListening(): void {
  const addr = server.address();
  const bind = typeof addr === 'string' ? `pipe ${addr}` : `port ${String(addr?.port)}`;
  logger.info(`Server is listening on ${bind}`);
}

async function startServer(): Promise<void> {
  // Initialize database pools before starting the server
  await initializeDatabasePools();

  if (NODE_ENV === 'development') {
    const LOCAL_SSL_KEY_PATH = '../../certs/roar-local.key';
    const LOCAL_SSL_CERT_PATH = '../../certs/roar-local.crt';

    // Local development HTTPS server using mkcert certificates.
    // This mirrors production HTTPS to catch SSL-related issues early.
    const key = fs.readFileSync(LOCAL_SSL_KEY_PATH);
    const cert = fs.readFileSync(LOCAL_SSL_CERT_PATH);

    server = https.createServer({ key, cert }, app);
    server.listen(port, () => {
      logger.info(`HTTPS server listening on https://localhost:${port}`);
    });
  } else {
    // Standard HTTP server.
    // In production, this runs behind NGINX with TLS termination.
    server = http.createServer(app);
    server.listen(port, () => {
      logger.info(`HTTP server listening on http://0.0.0.0:${port}`);
    });
  }

  /**
   * Configure server timeouts.
   *
   * - keepAliveTimeout: how long to keep idle sockets open for reuse.
   * - headersTimeout: must be > keepAliveTimeout to avoid 408s.
   * - requestTimeout: max total request time (0 = disabled).
   */
  const keepAliveMs = parseInt(KEEP_ALIVE_TIMEOUT, 10);
  server.keepAliveTimeout = keepAliveMs;
  server.headersTimeout = keepAliveMs + 1000;
  server.requestTimeout = 0;

  server.on('error', onError);
  server.on('listening', onListening);

  /**
   * Graceful shutdown handlers for Docker/Kubernetes.
   * Ensures all connections are closed cleanly on SIGTERM/SIGINT.
   */
  const shutdown = (signal: string) => {
    logger.info(`${signal} received: shutting down server`);
    server.close(() => {
      closeDatabasePools()
        .then(() => {
          logger.info('Server shutdown complete');
          process.exit(0);
        })
        .catch((err) => {
          logger.error({ err }, 'Error closing database pools');
          process.exit(1);
        });
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

startServer().catch((err) => {
  logger.fatal({ err }, 'Failed to start server');
  process.exit(1);
});
