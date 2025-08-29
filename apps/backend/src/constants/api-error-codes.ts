/**
 * API Error Codes
 *
 * Error codes emitted by the API as part of the `code` property of the error object.
 *
 * @example
 * ```ts
 *   return createError(StatusCodes.UNAUTHORIZED, {
 *     message: 'Invalid token.',
 *     code: API_ERROR_CODES.AUTH.TOKEN_INVALID,
 *   });
 * ```
 */
export const API_ERROR_CODES = {
  AUTH: {
    REQUIRED: 'auth/required',
    TOKEN_INVALID: 'auth/token-invalid',
    TOKEN_EXPIRED: 'auth/token-expired',
  },
  REQUEST: {
    INVALID: 'request/invalid',
  },
  INTERNAL: 'internal/error',
} as const;
