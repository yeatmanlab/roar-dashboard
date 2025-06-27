import { addBreadcrumb } from '@sentry/vue';

const SENTRY_BREADCRUMB_CATEGORIES = Object.freeze({
  AUTH: 'auth',
  NAV: 'navigation',
});

/*export const useSentryLogging = () => {
  const logBreadcrumb = ({ category, data, message, level = 'info' }) => {
    addBreadcrumb({
      category,
      message,
      data,
      level,
    });
  };
}*/
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
  });
};

/**
 * Creates a reusable Sentry auth breadcrumb logger.
 *
 * @param {Object} baseData - Data included in every event: { roarUid: string, userType: string, provider: string }
 * @returns {Function} logger - Returns a function that logs an authentication event.
 *   @param {string} message - Event description.
 *   @param {Object} eventData - Event to log.
 *   @param {string} [eventData.level='info'] - Optional severity level.
 *   @param {Object} [eventData.details] - Optional extra data.
 */
export const createAuthBreadcrumb =
  (baseData) =>
  (message, { details, ...options }) => {
    const data = details ? { ...baseData, details } : baseData;
    logBreadcrumb({
      category: SENTRY_BREADCRUMB_CATEGORIES.AUTH,
      message,
      data,
      ...options,
    });
  };

/**
 * Logs a Sentry navigation breadcrumb.
 * @param {string} message - Event description.
 * @param {Object} eventData - Event to log.
 * @param {string} eventData.data - Event data.
 * @param {string} [eventData.level='info'] - Optional severity level.
 */
export const logNavBreadcrumb = (message, { data, level }) => {
  logBreadcrumb({
    category: SENTRY_BREADCRUMB_CATEGORIES.NAV,
    data,
    message,
    level,
  });
};
