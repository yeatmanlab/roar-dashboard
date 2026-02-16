/**
 * PostgreSQL error code constants and utilities.
 *
 * SQLSTATE error codes from PostgreSQL:
 * @see https://www.postgresql.org/docs/current/errcodes-appendix.html
 */

/**
 * PostgreSQL SQLSTATE error codes.
 * These are standard codes defined by the SQL standard and PostgreSQL.
 */
export const PostgresErrorCode = {
  /** Class 23 - Integrity Constraint Violation */
  FOREIGN_KEY_VIOLATION: '23503',
  UNIQUE_VIOLATION: '23505',
  CHECK_VIOLATION: '23514',
  NOT_NULL_VIOLATION: '23502',
} as const;

/**
 * Type representing a Postgres database error with a code property.
 * The `pg` library throws errors with this shape.
 */
interface PostgresError {
  code?: string;
  message?: string;
}

/**
 * Check if an error is a Postgres foreign key violation.
 *
 * @param error - The error to check
 * @returns True if the error is a foreign key violation (SQLSTATE 23503)
 */
export function isForeignKeyViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  return (error as PostgresError).code === PostgresErrorCode.FOREIGN_KEY_VIOLATION;
}

/**
 * Check if an error is a Postgres unique constraint violation.
 *
 * @param error - The error to check
 * @returns True if the error is a unique violation (SQLSTATE 23505)
 */
export function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  return (error as PostgresError).code === PostgresErrorCode.UNIQUE_VIOLATION;
}
