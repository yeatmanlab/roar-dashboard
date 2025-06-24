import { addBreadcrumb } from '@sentry/vue';

/**
 * Logs a Sentry breadcrumb.
 *
 * @param {Object} options
 * @param {string} options.category - Event context.
 * @param {Object} options.data - Expected fields by category:
 *   - auth: { roarUid: string, userType: string, provider: string, details?: object }
 *   - admin: { adminUid: string, role: string }
 *   - assignment: { assignmentId: string, userId: string }
 * @param {string} options.message - Short event summary.
 * @param {string} [options.level='info'] - Severity, defaults to 'info'.
 */
export const logBreadcrumb = ({ category, data, message, level = 'info' }) => {
  addBreadcrumb({
    category,
    data,
    level,
    message,
    timestamp: new Date(),
  });
};

export const createAuthBreadcrumb =
  (baseOptions) =>
  ({ details, ...options }) => {
    const data = details ? { ...baseOptions, details } : baseOptions;
    logBreadcrumb({
      ...options,
      data,
      category: 'auth',
    });
  };
