import { addBreadcrumb } from '@sentry/vue';

/**
 * Logs a generic Sentry breadcrumb.
 *
 * @param {Object} options
 * @param {string} options.category - Event context.
 * @param {Object} options.data - Event data.
 * @param {string} options.message - Event description.
 * @param {string} [options.level='info'] - Severity, defaults to 'info'.
 */
export const logBreadcrumb = ({ category, data, message, level = 'info' }) => {
  addBreadcrumb({
    category,
    message,
    data,
    level,
    timestamp: new Date(),
  });
};

/**
 * Creates a reusable Sentry auth breadcrumb logger.
 *
 * @param {Object} baseData - Data included in every event: { roarUid: string, userType: string, provider: string }
 * @returns {Function} logger - Returns a function that logs an authentication event.
 *   @param {Object} eventData - Event to log.
 *   @param {string} eventData.message - Event description.
 *   @param {string} [eventData.level='info'] - Optional severity level.
 *   @param {Object} [eventData.details] - Optional extra data.
 */
export const createAuthBreadcrumb =
  (baseData) =>
  ({ details, ...options }) => {
    const data = details ? { ...baseData, details } : baseData;
    logBreadcrumb({
      category: 'auth',
      data,
      ...options,
    });
  };

/**
 * Logs a Sentry navigation breadcrumb.
 *
 * @param {Object} eventData - Event to log.
 * @param {string} eventData.message - Event description.
 * @param {string} [eventData.level='info'] - Optional severity level.
 */
export const logNavBreadcrumb = ({ data, message, level }) => {
  logBreadcrumb({
    category: 'navigation',
    data,
    message,
    level,
  });
};
