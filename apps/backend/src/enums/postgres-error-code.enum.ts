/**
 * PostgreSQL Error Codes
 *
 * Common SQLSTATE error codes returned by PostgreSQL.
 * Used for handling specific database errors programmatically.
 *
 * Full list: https://www.postgresql.org/docs/current/errcodes-appendix.html
 *
 * @example
 * ```ts
 * try {
 *   await db.insert(users).values(newUser);
 * } catch (error) {
 *   if (error.code === PostgresErrorCode.UNIQUE_VIOLATION) {
 *     throw new ApiError('User already exists', {
 *       statusCode: StatusCodes.CONFLICT,
 *       code: ApiErrorCode.RESOURCE_CONFLICT,
 *     });
 *   }
 * }
 * ```
 */
export enum PostgresErrorCode {
  /**
   * Unique constraint violation (e.g., duplicate key)
   * Class 23 - Integrity Constraint Violation
   */
  UNIQUE_VIOLATION = '23505',

  /**
   * Foreign key constraint violation
   * Class 23 - Integrity Constraint Violation
   */
  FOREIGN_KEY_VIOLATION = '23503',

  /**
   * Not null constraint violation
   * Class 23 - Integrity Constraint Violation
   */
  NOT_NULL_VIOLATION = '23502',

  /**
   * Check constraint violation
   * Class 23 - Integrity Constraint Violation
   */
  CHECK_VIOLATION = '23514',

  /**
   * Serialization failure (transaction conflict)
   * Class 40 - Transaction Rollback
   */
  SERIALIZATION_FAILURE = '40001',

  /**
   * Deadlock detected
   * Class 40 - Transaction Rollback
   */
  DEADLOCK_DETECTED = '40P01',

  /**
   * Undefined table
   * Class 42 - Syntax Error or Access Rule Violation
   */
  UNDEFINED_TABLE = '42P01',

  /**
   * Undefined column
   * Class 42 - Syntax Error or Access Rule Violation
   */
  UNDEFINED_COLUMN = '42703',

  /**
   * Insufficient privilege
   * Class 42 - Syntax Error or Access Rule Violation
   */
  INSUFFICIENT_PRIVILEGE = '42501',

  /**
   * Data exception - division by zero
   * Class 22 - Data Exception
   */
  DIVISION_BY_ZERO = '22012',
}
