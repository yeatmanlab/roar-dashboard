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
 * Type guard for a PostgreSQL error with a `constraint` field. node-postgres
 * populates `constraint` on `unique_violation` and other integrity errors,
 * giving us the offending index/constraint name.
 */
export function isPostgresErrorWithConstraint(error: unknown): error is { code: string; constraint: string } {
  return (
    isPostgresError(error) && 'constraint' in error && typeof (error as { constraint: unknown }).constraint === 'string'
  );
}

/**
 * Checks if an error is a unique constraint violation on the specified constraint or index name.
 *
 * Useful when more than one unique constraint can fire on the same insert and the caller needs to
 * map each to a different ApiError (e.g. distinguishing an email conflict from a "one family per
 * caretaker" violation on the same `INSERT INTO families`).
 *
 * @param error - The error to check
 * @param constraintName - The exact constraint or index name from the schema (e.g. `families_created_by_uniq_idx`)
 * @returns True if the error is a unique violation on that constraint
 */
export function isUniqueViolationOnConstraint(error: unknown, constraintName: string): boolean {
  return isUniqueViolation(error) && isPostgresErrorWithConstraint(error) && error.constraint === constraintName;
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
