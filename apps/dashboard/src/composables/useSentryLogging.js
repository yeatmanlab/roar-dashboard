import { addBreadcrumb } from '@sentry/vue';

const SENTRY_BREADCRUMB_CATEGORIES = Object.freeze({
  AUTH: 'auth',
  NAV: 'navigation',
  MEDIA: 'media',
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
  const logAuthEvent = createLogger(SENTRY_BREADCRUMB_CATEGORIES.AUTH);

  return { logEvent, logNavEvent, logMediaEvent, logAuthEvent };
}
