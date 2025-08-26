import fs from 'fs';
import http from 'http';
import https from 'https';
import app from './app';

const { NODE_ENV = 'development', PORT = '4000', KEEP_ALIVE_TIMEOUT = '75000' } = process.env;

const LOCAL_SSL_KEY_PATH = '../../certs/roar-local.key';
const LOCAL_SSL_CERT_PATH = '../../certs/roar-local.crt';

const port: number = parseInt(PORT, 10);
app.set('port', port);

let server: http.Server | https.Server;

if (NODE_ENV === 'development') {
  // Local development HTTPS server using mkcert certificates.
  // This mirrors production HTTPS to catch SSL-related issues early.
  const key = fs.readFileSync(LOCAL_SSL_KEY_PATH);
  const cert = fs.readFileSync(LOCAL_SSL_CERT_PATH);

  server = https.createServer({ key, cert }, app);
  server.listen(port, () => {
    console.log(`HTTPS server listening on https://localhost:${port}`);
  });
} else {
  // Standard HTTP server.
  // In production, this runs behind NGINX with TLS termination.
  server = http.createServer(app);
  server.listen(port, () => {
    console.log(`HTTP server listening on http://0.0.0.0:${port}`);
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
      console.error(`${bind} requires elevated privileges`);
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(`${bind} is already in use`);
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
  if (NODE_ENV !== 'test') {
    console.log(`Listening on ${bind}`);
  }
}

server.on('error', onError);
server.on('listening', onListening);

/**
 * Graceful shutdown handlers for Docker/Kubernetes.
 * Ensures all connections are closed cleanly on SIGTERM/SIGINT.
 */
process.on('SIGTERM', () => {
  console.log('SIGTERM received: shutting down server');
  server.close(() => {
    console.log('Server shutdown');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received: shutting down server');
  server.close(() => {
    console.log('Server shutdown');
    process.exit(0);
  });
});
