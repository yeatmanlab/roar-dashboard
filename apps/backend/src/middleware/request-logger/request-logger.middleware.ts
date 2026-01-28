import type { Request, Response, NextFunction } from 'express';
import { logger } from '../../logger';
import { version } from '../../../package.json';

/**
 * Child logger with redaction for sensitive headers.
 */
const requestLog = logger.child(
  {},
  {
    redact: {
      censor: '<redacted>',
      paths: ['req.headers.authorization', 'req.headers.cookie', 'req.headers["x-api-key"]'],
    },
  },
);

/**
 * Routes to exclude from request logging (e.g., health checks).
 */
const EXCLUDED_ROUTES = ['/health', '/ready'];

/**
 * Express middleware that logs HTTP request/response details.
 *
 * Logs method, path, status code, response time, and request context.
 * Uses 'info' level for successful responses (2xx/3xx), 'warn' for client errors (4xx),
 * and 'error' for server errors (5xx).
 *
 * Sensitive headers (authorization, cookies) are automatically redacted.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  // Skip logging for excluded routes
  if (EXCLUDED_ROUTES.includes(req.path)) {
    return next();
  }

  const startTime = process.hrtime.bigint();
  const requestId = req.headers['x-request-id'] as string | undefined;

  res.on('finish', () => {
    const durationNs = process.hrtime.bigint() - startTime;
    const durationMs = Number(durationNs) / 1_000_000;

    const logData = {
      version,
      requestId,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Math.round(durationMs * 100) / 100,
      req: {
        headers: req.headers,
        remoteAddress: req.ip,
        httpVersion: `${req.httpVersionMajor}.${req.httpVersionMinor}`,
      },
    };

    const message = `${req.method} ${req.originalUrl} ${res.statusCode} ${logData.durationMs}ms`;

    if (res.statusCode >= 500) {
      requestLog.error(logData, message);
    } else if (res.statusCode >= 400) {
      requestLog.warn(logData, message);
    } else {
      requestLog.info(logData, message);
    }
  });

  next();
}
