export const AUTH_LOG_MESSAGES = Object.freeze({
  USER_CLAIMS_UPDATED: 'User claims updated',
  PROVISIONING_PENDING: 'User account not yet provisioned, retrying...',
  SSO_READINESS_RETRY_FAILED: '/me attempt failed during the SSO readiness wait, retrying...',
  SSO_SESSION_MISSING: 'No authenticated session on the SSO landing page, routing to sign-in',
  SUCCESS: 'User successfully identified, routing to home page',
  MISSING_SSO_PROVIDER: 'No SSO provider detected. Redirecting to SSO landing page...',
  AWAITING_ACCOUNT_READINESS: 'Redirected to SSO landing page, awaiting account provisioning...',
  PROVISIONING_RETRIES_EXHAUSTED: 'SSO account readiness wait exhausted all /me retries',
});

export const NAV_LOG_MESSAGES = Object.freeze({
  FORBIDDEN_ROUTE: 'User does not have permission to access route',
});

export const MEDIA_LOG_MESSAGES = Object.freeze({
  VIDEO_STARTED: 'Video started',
  VIDEO_ENDED: 'Video ended',
});
