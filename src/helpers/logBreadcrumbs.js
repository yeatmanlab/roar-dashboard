import { addBreadcrumb } from '@sentry/vue';

const SENTRY_BREADCRUMB_CATEGORIES = Object.freeze({
  AUTH: 'auth',
  NAV: 'navigation',
});

export default function useSentryLogging() {
  /**
   * Logs a generic Sentry breadcrumb.
   *
   * @param {string} message - Event description.
   * @param {Object} options
   * @param {string} options.category - Event context.
   * @param {Object} options.data - Event data.
   * @param {string} [options.level='info'] - Severity, defaults to 'info'.
   */
  const logBreadcrumb = (message, { category, data, level = 'info' }) => {
    addBreadcrumb({
      category,
      message,
      data,
      level,
    });
  };

  /**
   * Creates a Sentry auth breadcrumb logger.
   *
   * @param {Object} baseData - Data included in every event: { roarUid: string, userType: string, provider: string }
   * @returns {Function} logger - Returns a function that logs an authentication event.
   *   @param {string} message - Event description.
   *   @param {Object} eventData - Event to log.
   *   @param {string} [eventData.level='info'] - Optional severity level.
   *   @param {Object} [eventData.details] - Optional extra data.
   */
  const createAuthBreadcrumb =
    (baseData) =>
    (message, { details, ...options }) => {
      const data = details ? { ...baseData, details } : baseData;
      logBreadcrumb(message, {
        category: SENTRY_BREADCRUMB_CATEGORIES.AUTH,
        data,
        ...options,
      });
    };

  /**
   * Logs a Sentry navigation breadcrumb.
   *
   * @param {string} message - Event description.
   * @param {Object} eventData - Event to log.
   * @param {string} eventData.data - Event data.
   * @param {string} [eventData.level='info'] - Optional severity level.
   */
  const logNavBreadcrumb = (message, { data, level }) => {
    logBreadcrumb(message, {
      category: SENTRY_BREADCRUMB_CATEGORIES.NAV,
      data,
      level,
    });
  };

  return { logBreadcrumb, createAuthBreadcrumb, logNavBreadcrumb };
}
