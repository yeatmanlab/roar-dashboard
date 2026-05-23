import pino from 'pino';
import pretty from 'pino-pretty';

/**
 * GCP Cloud Logging severity levels mapped to pino levels.
 * @see https://cloud.google.com/logging/docs/reference/v2/rest/v2/LogEntry#LogSeverity
 */
const GCP_SEVERITY_MAP: Record<string, string> = {
  trace: 'DEBUG',
  debug: 'DEBUG',
  info: 'INFO',
  warn: 'WARNING',
  error: 'ERROR',
  fatal: 'CRITICAL',
};

/**
 * Determines if we're in a development environment.
 */
const isDevelopment = process.env.NODE_ENV !== 'production';

/**
 * Creates the pino logger instance.
 *
 * In development: Uses pino-pretty as a synchronous destination stream for
 * human-readable output. We deliberately do not use the `transport` option
 * here — that form spawns pino-pretty in a worker thread, and the worker's
 * own loader uses `__dirname` to locate its entry script. Because the
 * backend is bundled as ESM (`"type": "module"` in package.json),
 * `__dirname` is undefined and the worker crashes on first log call. The
 * sync sink runs in the main thread and avoids the worker boundary
 * entirely; perf overhead is negligible for local dev.
 *
 * In production: Outputs structured JSON compatible with GCP Cloud Logging.
 * No transport / stream override, so pino writes directly to stdout.
 */
function createLogger() {
  const level = process.env.LOG_LEVEL || 'info';

  if (isDevelopment) {
    const prettyStream = pretty({
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
    });
    return pino({ level }, prettyStream);
  }

  // Production: structured JSON for GCP Cloud Logging
  return pino({
    level,
    formatters: {
      level(label) {
        // Map pino level to GCP severity
        return {
          severity: GCP_SEVERITY_MAP[label] || 'DEFAULT',
          level: label,
        };
      },
    },
    messageKey: 'message',
    timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
  });
}

export const logger = createLogger();

/**
 * Creates a child logger with additional context.
 * Useful for adding request-specific context like traceId.
 *
 * @example
 * const reqLogger = createChildLogger({ traceId: req.headers['x-cloud-trace-context'] });
 * reqLogger.info('Processing request');
 */
export function createChildLogger(context: Record<string, unknown>) {
  return logger.child(context);
}
