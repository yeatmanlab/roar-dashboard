const MILLISECONDS_PER_MINUTE = 60_000;

export const REGISTRATION_AGREEMENTS_RATE_LIMIT = {
  windowMs: MILLISECONDS_PER_MINUTE,
  maxRequests: 60,
} as const;

export const REGISTRATION_SUBMISSION_IP_RATE_LIMIT = {
  windowMs: 15 * MILLISECONDS_PER_MINUTE,
  maxRequests: 5,
} as const;

export const REGISTRATION_SUBMISSION_EMAIL_RATE_LIMIT = {
  windowMs: 15 * MILLISECONDS_PER_MINUTE,
  maxRequests: 5,
} as const;
