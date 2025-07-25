export const AUTH_LOG_MESSAGES = Object.freeze({
  USER_CLAIMS_UPDATED: 'User claims updated',
  USER_TYPE_MISSING: 'User type missing, retrying...',
  USER_TYPE_GUEST: 'User identified as guest user, retrying...',
  SUCCESS: 'User successfully identified, routing to home page',
  MISSING_SSO_PROVIDER: 'No SSO provider detected. Redirecting to SSO landing page...',
  POLLING_ACCOUNT_READINESS: 'Redirected to SSO landing page, polling for account readiness...',
});

export const NAV_LOG_MESSAGES = Object.freeze({
  FORBIDDEN_ROUTE: 'User does not have permission to access route',
});

export const MEDIA_LOG_MESSAGES = Object.freeze({
  VIDEO_STARTED: 'Video started',
  VIDEO_ENDED: 'Video ended',
});
