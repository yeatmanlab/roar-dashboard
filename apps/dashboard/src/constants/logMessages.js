export const AUTH_LOG_MESSAGES = Object.freeze({
  USER_CLAIMS_UPDATED: 'User claims updated',
  PROVISIONING_PENDING: 'User account not yet provisioned, retrying...',
  SUCCESS: 'User successfully identified, routing to home page',
  MISSING_SSO_PROVIDER: 'No SSO provider detected. Redirecting to SSO landing page...',
  POLLING_ACCOUNT_READINESS: 'Redirected to SSO landing page, polling for account readiness...',
  POLLING_MAX_RETRIES_EXCEEDED: 'SSO account readiness polling exceeded maximum retries',
});

export const NAV_LOG_MESSAGES = Object.freeze({
  FORBIDDEN_ROUTE: 'User does not have permission to access route',
});

export const MEDIA_LOG_MESSAGES = Object.freeze({
  VIDEO_STARTED: 'Video started',
  VIDEO_ENDED: 'Video ended',
});
