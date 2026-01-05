import pino from 'pino';

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
 * In development: Uses pino-pretty for human-readable output.
 * In production: Outputs structured JSON compatible with GCP Cloud Logging.
 */
function createLogger() {
  const level = process.env.LOG_LEVEL || 'info';

  if (isDevelopment) {
    // Development: pretty-printed logs
    return pino({
      level,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      },
    });
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
