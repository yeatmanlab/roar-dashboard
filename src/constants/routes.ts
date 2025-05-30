/**
 * Application routes
 *
 * @TODO The below APP_ROUTES only contains a limited number of routes as it's a new addition to the application. This
 * should be extended to include all the routes of the application.
 *
 * @constant {Object} APP_ROUTES – The individual routes of the application.
 */
export const APP_ROUTES = {
  HOME: '/',
  SIGN_IN: '/signin',
  SSO: '/sso',
  PROGRESS_REPORT: '/administration/:administrationId/:orgType/:orgId',
  SCORE_REPORT: '/scores/:administrationId/:orgType/:orgId',
  CHILD_REPORT: '/scores/:administrationId/:orgType/:orgId/user/:userId',
  ACCOUNT_PROFILE: '/profile',
  LIST_ORGS: '/list-orgs',
} as const;
