/**
 * Firebase Error Codes
 *
 * Error codes emitted by Firebase part of the `code` property of the error object when invoking Firebase
 * Admin SDK methods.
 */
export const FIREBASE_ERROR_CODES = {
  AUTH: {
    ID_TOKEN_EXPIRED: 'auth/id-token-expired',
    USER_NOT_FOUND: 'auth/user-not-found',
    EMAIL_ALREADY_EXISTS: 'auth/email-already-exists',
    TOO_MANY_REQUESTS: 'auth/too-many-requests',
  },
} as const;
