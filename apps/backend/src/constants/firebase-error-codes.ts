/**
 * Firebase Error Codes
 *
 * Error codes emitted by Firebase part of the `code` property of the error object when invoking Firebase
 * Admin SDK methods.
 */
export const FIREBASE_ERROR_CODES = {
  AUTH: {
    ID_TOKEN_EXPIRED: 'auth/id-token-expired',
  },
} as const;
