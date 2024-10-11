/**
 * Application routes
 *
 * @TODO The below APP_ROUTES only contains a limited number of routes as it's a new addition to the application. This
 * should be extended to include all the routes of the application.
 *
 * @constant {Object} APP_ROUTES – The individual routes of the application.
 */
export const APP_ROUTES = {
  ACCOUNT_PROFILE: '/profile',
  HOME: '/',
  ORGS_LIST: '/list-orgs',
  PROGRESS_REPORT: '/administration/:administrationId/:orgType/:orgId',
  SCORE_REPORT: '/scores/:administrationId/:orgType/:orgId',
  SIGN_IN: '/signin',
  SSO: '/sso',
  STUDENT_REPORT: '/scores/:administrationId/:orgType/:orgId/user/:userId',
};
