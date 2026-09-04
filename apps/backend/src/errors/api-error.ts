import { StatusCodes } from 'http-status-codes';
import { randomUUID } from 'crypto';
import { ApiErrorCode } from '../enums/api-error-code.enum';

/**
 * Parameters for initializing an ApiError instance.
 */
interface ApiErrorParams {
  /** HTTP status code for the error. Defaults to 500 (Internal Server Error). */
  statusCode?: number;
  /** Error code for programmatic error handling. */
  code?: ApiErrorCode;
  /** Additional context information about the error. */
  context?: Record<string, unknown> | undefined;
  /** Unique identifier for tracing the error. Auto-generated if not provided. */
  traceId?: string;
  /** The underlying cause of the error. */
  cause?: unknown;
}

/**
 * Custom API error class that extends the standard Error class.
 * Provides additional context and structured error handling.
 *
 * @example
 * ```typescript
 *  throw new ApiError('Failed to process request', {
 *   statusCode: StatusCodes.BAD_REQUEST,
 *   code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
 *   context: { requestId: '123' },
 *   cause: originalError
 *  });
 * ```
 * @param message - The human-readable error message.
 * @param options - Optional configuration for the error.
 */
export class ApiError extends Error {
  /** HTTP status code for the error. */
  public readonly statusCode: number;
  /** Error code for programmatic error handling. */
  public readonly code: ApiErrorCode | undefined;
  /** Additional context information about the error. */
  public readonly context: Record<string, unknown> | undefined;
  /** Unique identifier for tracing the error. Auto-generated if not provided. */
  public readonly traceId: string;

  /**
   * Creates a new ApiError instance.
   * @param message - The error message
   * @param options - Configuration options for the error
   */
  constructor(
    override readonly message: string,
    options?: ApiErrorParams,
  ) {
    super(message, { cause: options?.cause });
    this.name = 'ApiError';
    this.statusCode = options?.statusCode ?? StatusCodes.INTERNAL_SERVER_ERROR;
    this.code = options?.code;
    this.traceId = options?.traceId ?? randomUUID();
    this.context = options?.context;
  }
}
