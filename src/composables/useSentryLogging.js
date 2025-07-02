import { addBreadcrumb } from '@sentry/vue';

const SENTRY_BREADCRUMB_CATEGORIES = Object.freeze({
  AUTH: 'auth',
  NAV: 'navigation',
  MEDIA: 'media',
  PROFILE: 'profile',
  ACCESS_CONTROL: 'access-control',
});

export default function useSentryLogging() {
  /**
   * Logs a generic Sentry breadcrumb.
   *
   * @param {string} category - Event context.
   * @param {string} message - Event description.
   * @param {Object} [options={}] - Optional overrides and data.
   * @param {Object} [options.data] - Event data.
   * @param {string} [options.level='info'] - Severity, defaults to 'info'.
   * @param {...any} [extras] - Less common attributes: type, timestamp, and origin.
   */
  const logEvent = (category, message, { data, level = 'info', ...extras } = {}) => {
    addBreadcrumb({
      category,
      message,
      data,
      level,
      ...extras,
    });
  };

  /**
   * Creates a Sentry auth breadcrumb logger.
   *
   * @param {Object} baseData - Data included in every event: { roarUid: string, userType: string, provider: string }
   * @returns {Function} logAuthEvent - Returns a function that logs an auth event.
   *   @param {Object} [options.details] - Optional extra data.
   *   See {@link logEvent} for rest of parameter details.
   */
  const createAuthLogger =
    (baseData) =>
    (message, { details, level, ...extras } = {}) => {
      const data = details ? { ...baseData, details } : baseData;
      logEvent(SENTRY_BREADCRUMB_CATEGORIES.AUTH, message, {
        data,
        level,
        ...extras,
      });
    };

  /**
   * Creates a generic Sentry breadcrumb logger.
   *
   * @param {string} category - Event context.
   * @returns {Function} logCategoryEvent - Returns a function that logs an event.
   *   See {@link logEvent} for parameter details.
   */
  const createLogger =
    (category) =>
    (message, { data, level, ...extras } = {}) => {
      logEvent(category, message, {
        data,
        level,
        ...extras,
      });
    };

  const logNavEvent = createLogger(SENTRY_BREADCRUMB_CATEGORIES.NAV);
  const logMediaEvent = createLogger(SENTRY_BREADCRUMB_CATEGORIES.MEDIA);
  const logProfileEvent = createLogger(SENTRY_BREADCRUMB_CATEGORIES.PROFILE);
  const logAccessEvent = createLogger(SENTRY_BREADCRUMB_CATEGORIES.ACCESS_CONTROL);

  return { logEvent, createAuthLogger, logNavEvent, logMediaEvent, logProfileEvent, logAccessEvent };
}
