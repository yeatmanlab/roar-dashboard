import { StatusCodes } from 'http-status-codes';
import { v4 } from 'uuid';

/**
 * Parameters for initializing an ApiError instance.
 */
interface ApiErrorParams {
  /** HTTP status code for the error. Defaults to 500 (Internal Server Error). */
  statusCode?: number;
  /** Additional context information about the error. */
  context?: Record<string, unknown>;
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
  /** Additional context information about the error. */
  public readonly context?: Record<string, unknown>;
  /** Unique identifier for tracing the error. Auto-generated if not provided. */
  public readonly traceId?: string;
  /** The original error or cause of the error. */
  public readonly cause?: unknown;

  /**
   * Creates a new ApiError instance.
   * @param message - The error message
   * @param options - Configuration options for the error
   */
  constructor(
    public readonly message: string,
    options?: ApiErrorParams,
  ) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = options?.statusCode ?? StatusCodes.INTERNAL_SERVER_ERROR;
    this.traceId = options?.traceId || v4();
    this.context = options?.context;
    this.cause = options?.cause;
  }
}
