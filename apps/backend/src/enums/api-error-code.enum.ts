/**
 * API Error Codes
 *
 * Error codes emitted by the API as part of the `code` property of the error object.
 * Used for programmatic error handling on the client.
 *
 * @example
 * ```ts
 *   throw new ApiError('Invalid token.', {
 *     statusCode: StatusCodes.UNAUTHORIZED,
 *     code: ApiErrorCode.AUTH_TOKEN_INVALID,
 *   });
 * ```
 */
export enum ApiErrorCode {
  // Auth errors
  AUTH_REQUIRED = 'auth/required',
  AUTH_TOKEN_INVALID = 'auth/token-invalid',
  AUTH_TOKEN_EXPIRED = 'auth/token-expired',
  AUTH_USER_NOT_FOUND = 'auth/user-not-found',
  AUTH_FORBIDDEN = 'auth/forbidden',

  // Request errors
  REQUEST_INVALID = 'request/invalid',
  REQUEST_VALIDATION_FAILED = 'request/validation-failed',

  // Resource errors
  RESOURCE_NOT_FOUND = 'resource/not-found',
  RESOURCE_CONFLICT = 'resource/conflict',

  // Database errors
  DATABASE_QUERY_FAILED = 'database/query-failed',

  // Internal errors
  INTERNAL = 'internal/error',
}
