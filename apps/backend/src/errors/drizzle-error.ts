import { DrizzleQueryError } from 'drizzle-orm';

/**
 * Extracts the underlying database error from a Drizzle error wrapper.
 *
 * When Drizzle ORM encounters database errors (e.g., constraint violations, connection errors),
 * it wraps them in a DrizzleQueryError with the actual database driver error in the `cause` property.
 * This helper unwraps that error to access the underlying Postgres error codes and details.
 *
 * @param error - The error that may be wrapped by Drizzle
 * @returns The underlying database error if wrapped, otherwise the original error
 *
 * @example
 * ```typescript
 * try {
 *   await db.insert(users).values(newUser);
 * } catch (error) {
 *   const dbError = unwrapDrizzleError(error);
 *   if (isUniqueViolation(dbError)) {
 *     // Handle unique constraint violation
 *   }
    if (isForeignKeyViolation(dbError)) {
      // Handle foreign key constraint violation
    }
 * }
 * ```
 */
export function unwrapDrizzleError(error: unknown): unknown {
  return error instanceof DrizzleQueryError ? error.cause : error;
}

/**
 * Type guard to check if an error is a Drizzle query error.
 *
 * @param error - The error to check
 * @returns True if the error is a DrizzleQueryError
 *
 * @example
 * ```typescript
 * if (isDrizzleQueryError(error)) {
 *   console.log('Query:', error.query);
 *   console.log('Params:', error.params);
 * }
 * ```
 */
export function isDrizzleQueryError(error: unknown): error is DrizzleQueryError {
  return error instanceof DrizzleQueryError;
}
