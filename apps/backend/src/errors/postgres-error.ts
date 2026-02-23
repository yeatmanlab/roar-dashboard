import { PostgresErrorCode } from '../enums/postgres-error-code.enum';

/**
 * Type guard to check if an error is a PostgreSQL database error.
 *
 * PostgreSQL errors from node-postgres have a `code` property containing
 * the SQLSTATE error code (a 5-character string).
 *
 * @param error - The error to check
 * @returns True if the error is a PostgreSQL error with a code property
 *
 * @example
 * ```typescript
 * try {
 *   await db.insert(users).values(newUser);
 * } catch (error) {
 *   if (isPostgresError(error)) {
 *     console.log(`Postgres error: ${error.code}`);
 *   }
 * }
 * ```
 */
export function isPostgresError(error: unknown): error is { code: string } {
  return error !== null && typeof error === 'object' && 'code' in error && typeof error.code === 'string';
}

/**
 * Checks if an error is a specific PostgreSQL error code.
 *
 * @param error - The error to check
 * @param code - The PostgreSQL error code to match against
 * @returns True if the error matches the specified code
 *
 * @example
 * ```typescript
 * try {
 *   await db.insert(users).values(newUser);
 * } catch (error) {
 *   if (isPostgresErrorCode(error, PostgresErrorCode.UNIQUE_VIOLATION)) {
 *     throw new ApiError('User already exists', {
 *       statusCode: StatusCodes.CONFLICT,
 *       code: ApiErrorCode.RESOURCE_CONFLICT,
 *     });
 *   }
 * }
 * ```
 */
export function isPostgresErrorCode(error: unknown, code: PostgresErrorCode): boolean {
  return isPostgresError(error) && error.code === code;
}

/**
 * Checks if an error is a PostgreSQL unique constraint violation.
 *
 * This is a convenience function for the most common constraint check.
 *
 * @param error - The error to check
 * @returns True if the error is a unique constraint violation
 *
 * @example
 * ```typescript
 * try {
 *   await db.insert(users).values(newUser);
 * } catch (error) {
 *   if (isUniqueViolation(error)) {
 *     throw new ApiError('Duplicate entry', {
 *       statusCode: StatusCodes.CONFLICT,
 *       code: ApiErrorCode.RESOURCE_CONFLICT,
 *     });
 *   }
 * }
 * ```
 */
export function isUniqueViolation(error: unknown): boolean {
  return isPostgresErrorCode(error, PostgresErrorCode.UNIQUE_VIOLATION);
}

/**
 * Checks if an error is a PostgreSQL foreign key constraint violation.
 *
 * @param error - The error to check
 * @returns True if the error is a foreign key violation
 *
 * @example
 * ```typescript
 * try {
 *   await db.insert(orders).values(newOrder);
 * } catch (error) {
 *   if (isForeignKeyViolation(error)) {
 *     throw new ApiError('Referenced record does not exist', {
 *       statusCode: StatusCodes.BAD_REQUEST,
 *       code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
 *     });
 *   }
 * }
 * ```
 */
export function isForeignKeyViolation(error: unknown): boolean {
  return isPostgresErrorCode(error, PostgresErrorCode.FOREIGN_KEY_VIOLATION);
}

/**
 * Checks if an error is a PostgreSQL not null constraint violation.
 *
 * @param error - The error to check
 * @returns True if the error is a not null violation
 *
 * @example
 * ```typescript
 * try {
 *   await db.insert(users).values(newUser);
 * } catch (error) {
 *   if (isNotNullViolation(error)) {
 *     throw new ApiError('Required field is missing', {
 *       statusCode: StatusCodes.BAD_REQUEST,
 *       code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
 *     });
 *   }
 * }
 * ```
 */
export function isNotNullViolation(error: unknown): boolean {
  return isPostgresErrorCode(error, PostgresErrorCode.NOT_NULL_VIOLATION);
}
