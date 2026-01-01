import { StatusCodes } from 'http-status-codes';
import { ApiError } from './api-error';
import { DatabaseErrorCode } from '../enums/database-error-code.enum';

/**
 * Parameters for creating a DatabaseError instance.
 */
interface DatabaseErrorParams {
  /** The error code for the database error. */
  code?: DatabaseErrorCode;
  /** Additional context information about the error. */
  context?: Record<string, unknown> | undefined;
  /** The original error object. */
  cause?: unknown;
}

/**
 * Specialized error class for handling database-related errors in the ROAR platform.
 * Provides structured error handling with support for error codes, context, and error conversion.
 *
 * @example
 * ```typescript
 *  throw new DatabaseError('Failed to query user data', {
 *   code: DatabaseErrorCode.QUERY_FAILED,
 *   context: { userId: '123' },
 *   cause: originalError
 *  });
 * ```
 * @param message - The human-readable error message.
 * @param options - Optional configuration for the error.
 */
export class DatabaseError extends Error {
  /**
   * The specific error code identifying the type of database error.
   * Defaults to DatabaseErrorCode.QUERY_FAILED if not provided in options.
   */
  public readonly code: DatabaseErrorCode;

  /**
   * Additional contextual information about the error.
   * Useful for debugging and error tracking.
   */
  public readonly context: Record<string, unknown> | undefined;

  /**
   * Creates a new DatabaseError instance.
   * @param message - The human-readable error message
   * @param options - Optional configuration for the error
   */
  constructor(
    override readonly message: string,
    options?: DatabaseErrorParams,
  ) {
    super(message, { cause: options?.cause });
    this.name = 'DatabaseError';
    this.code = options?.code ?? DatabaseErrorCode.QUERY_FAILED;
    this.context = options?.context;
  }

  /**
   * Converts the DatabaseError into an ApiError suitable for HTTP responses.
   * Maps database error codes to appropriate HTTP status codes.
   * @returns An ApiError instance with mapped HTTP status code and original error details.
   */
  toApiError(): ApiError {
    return new ApiError(this.message, {
      statusCode: this.mapToHttpStatus(),
      context: this.context,
      cause: this.cause,
    });
  }

  /**
   * Maps database error codes to HTTP status codes.
   * @returns The corresponding HTTP status code.
   */
  private mapToHttpStatus(): number {
    switch (this.code) {
      case DatabaseErrorCode.NOT_FOUND:
        return StatusCodes.NOT_FOUND;
      case DatabaseErrorCode.CONFLICT:
        return StatusCodes.CONFLICT;
      case DatabaseErrorCode.INVALID_PARAMS:
        return StatusCodes.BAD_REQUEST;
      case DatabaseErrorCode.QUERY_FAILED:
      default:
        return StatusCodes.INTERNAL_SERVER_ERROR;
    }
  }
}
