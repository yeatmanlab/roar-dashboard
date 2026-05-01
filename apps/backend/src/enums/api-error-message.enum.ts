/**
 * API Error Messages
 *
 * Standardized error messages for API responses. Use these to ensure consistent,
 * generic messages across the codebase. Specific details should be logged
 * internally, not exposed to clients.
 *
 * @example
 * ```ts
 *   throw new ApiError(ApiErrorMessage.FORBIDDEN, {
 *     statusCode: StatusCodes.FORBIDDEN,
 *     code: ApiErrorCode.AUTH_FORBIDDEN,
 *   });
 * ```
 */
export enum ApiErrorMessage {
  /** Generic conflict error - use when a resource already exists */
  CONFLICT = 'The requested resource already exists',

  /** Generic forbidden error - use when user lacks permission for an action */
  FORBIDDEN = 'You do not have permission to perform this action',

  /** Generic not found error - use when a resource doesn't exist */
  NOT_FOUND = 'The requested resource was not found',

  REQUEST_VALIDATION_FAILED = 'Failed to validate request',

  /** Generic unauthorized error - use for authentication failures */
  UNAUTHORIZED = 'Authentication required',

  /**
   * Generic unprocessable-entity error — use when a body-referenced entity
   * (e.g., a parent id supplied in the request body) does not resolve.
   * 404 is reserved for missing URL targets; 422 fits "the request was
   * understood but could not be processed".
   */
  UNPROCESSABLE_ENTITY = 'The request could not be processed',

  /** Generic internal server error - use for unexpected errors */
  INTERNAL_SERVER_ERROR = 'An internal server error occurred',

  /** Generic external service unavailable error - use when a downstream dependency is unavailable */
  EXTERNAL_SERVICE_UNAVAILABLE = 'An external service is currently unavailable',
}
