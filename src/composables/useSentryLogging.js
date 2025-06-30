import { addBreadcrumb } from '@sentry/vue';

const SENTRY_BREADCRUMB_CATEGORIES = Object.freeze({
  AUTH: 'auth',
  NAV: 'navigation',
  PROFILE: 'profile',
  MEDIA: 'media',
  ACCESS_CONTROL: 'access-control',
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
  const logEvent = (message, { category, data, level = 'info' }) => {
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
   * @returns {Function} logAuthEvent - Returns a function that logs an authentication event.
   *   @param {string} message - Event description.
   *   @param {Object} eventData - Event to log.
   *   @param {string} [eventData.level='info'] - Optional severity level.
   *   @param {Object} [eventData.details] - Optional extra data.
   */
  const createAuthLogger =
    (baseData) =>
    (message, { details, ...options }) => {
      const data = details ? { ...baseData, details } : baseData;
      logEvent(message, {
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
  const logNavEvent = (message, { data, level }) => {
    logEvent(message, {
      category: SENTRY_BREADCRUMB_CATEGORIES.NAV,
      data,
      level,
    });
  };

  /**
   * Logs a Sentry media breadcrumb.
   *
   * @param {string} message - Event description.
   * @param {Object} eventData - Event to log.
   * @param {string} eventData.data - Event data.
   * @param {string} [eventData.level='info'] - Optional severity level.
   */
  const logMediaEvent = (message, { data, level }) => {
    logEvent(message, {
      category: SENTRY_BREADCRUMB_CATEGORIES.MEDIA,
      data,
      level,
    });
  };

  /**
   * Logs a Sentry profile breadcrumb.
   *
   * @param {string} message - Event description.
   * @param {Object} eventData - Event to log.
   * @param {string} eventData.data - Event data.
   * @param {string} [eventData.level='info'] - Optional severity level.
   */
  const logProfileEvent = (message, { data, level }) => {
    logEvent(message, {
      category: SENTRY_BREADCRUMB_CATEGORIES.PROFILE,
      data,
      level,
    });
  };

  /**
   * Logs a Sentry access-control breadcrumb.
   *
   * @param {string} message - Event description.
   * @param {Object} eventData - Event to log.
   * @param {string} eventData.data - Event data.
   * @param {string} [eventData.level='info'] - Optional severity level.
   */
  const logAccessEvent = (message, { data, level }) => {
    logEvent(message, {
      category: SENTRY_BREADCRUMB_CATEGORIES.ACCESS_CONTROL,
      data,
      level,
    });
  };

  return { logEvent, createAuthLogger, logNavEvent, logMediaEvent, logProfileEvent, logAccessEvent };
}
