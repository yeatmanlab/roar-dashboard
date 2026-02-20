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

  /** Generic unauthorized error - use for authentication failures */
  UNAUTHORIZED = 'Authentication required',
}
