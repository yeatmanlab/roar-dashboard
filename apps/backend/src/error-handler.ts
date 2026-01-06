import type { NextFunction, Request, Response } from 'express';
import { isHttpError } from 'http-errors';
import { StatusCodes } from 'http-status-codes';
import { ApiError } from './errors/api-error';
import { DatabaseError } from './errors/database-error';
import { ApiErrorCode } from './enums/api-error-code.enum';
import { logger } from './logger';

/**
 * Global error handler for the Express application.
 *
 * Handles different error types and returns structured JSON responses:
 * - ApiError: Custom API errors with status code and context
 * - DatabaseError: Converted to ApiError with mapped HTTP status
 * - HttpError: Errors created with http-errors package
 * - Unknown errors: Generic 500 response (details logged, not exposed)
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  // Handle custom ApiError
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      error: {
        message: err.message,
        code: err.code,
        traceId: err.traceId,
      },
    });
  }

  // Handle DatabaseError by converting to ApiError
  if (err instanceof DatabaseError) {
    const apiError = err.toApiError();
    return res.status(apiError.statusCode).json({
      error: {
        message: apiError.message,
        code: apiError.code,
        traceId: apiError.traceId,
      },
    });
  }

  // Handle HTTP errors created with http-errors package
  if (isHttpError(err)) {
    return res.status(err.statusCode).json({
      error: {
        message: err.message,
        code: err.code,
      },
    });
  }

  // Log unexpected errors for debugging
  logger.error({ err }, 'Unexpected error');

  // Fallback for unexpected errors - don't expose internal details
  return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
    error: {
      message: 'An unexpected error occurred.',
      code: ApiErrorCode.INTERNAL,
    },
  });
}
