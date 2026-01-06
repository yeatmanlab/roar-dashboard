import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import createError from 'http-errors';
import { StatusCodes } from 'http-status-codes';
import { errorHandler } from './error-handler';
import { ApiError } from './errors/api-error';
import { DatabaseError } from './errors/database-error';
import { DatabaseErrorCode } from './enums/database-error-code.enum';
import { ApiErrorCode } from './enums/api-error-code.enum';
import { logger } from './logger';

vi.mock('./logger', () => ({
  logger: {
    error: vi.fn(),
  },
}));

describe('errorHandler', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let jsonMock: ReturnType<typeof vi.fn>;
  let statusMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });

    mockReq = {};
    mockRes = { status: statusMock };
    mockNext = vi.fn();
  });

  describe('ApiError handling', () => {
    it('should return status code and message from ApiError', () => {
      const error = new ApiError('Bad request', { statusCode: StatusCodes.BAD_REQUEST });

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST);
      expect(jsonMock).toHaveBeenCalledWith({
        error: {
          message: 'Bad request',
          traceId: error.traceId,
        },
      });
    });

    it('should default to 500 if no status code provided', () => {
      const error = new ApiError('Something went wrong');

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(StatusCodes.INTERNAL_SERVER_ERROR);
    });
  });

  describe('DatabaseError handling', () => {
    it('should convert DatabaseError to ApiError response', () => {
      const error = new DatabaseError('Record not found', {
        code: DatabaseErrorCode.NOT_FOUND,
      });

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(StatusCodes.NOT_FOUND);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: 'Record not found',
          }),
        }),
      );
    });

    it('should map CONFLICT code to 409', () => {
      const error = new DatabaseError('Duplicate entry', {
        code: DatabaseErrorCode.CONFLICT,
      });

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(StatusCodes.CONFLICT);
    });

    it('should map INVALID_PARAMS code to 400', () => {
      const error = new DatabaseError('Invalid parameters', {
        code: DatabaseErrorCode.INVALID_PARAMS,
      });

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST);
    });
  });

  describe('HttpError handling', () => {
    it('should handle http-errors', () => {
      const error = createError(StatusCodes.UNAUTHORIZED, {
        message: 'Token missing.',
        code: 'AUTH_REQUIRED',
      });

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(StatusCodes.UNAUTHORIZED);
      expect(jsonMock).toHaveBeenCalledWith({
        error: {
          message: 'Token missing.',
          code: 'AUTH_REQUIRED',
        },
      });
    });
  });

  describe('Unknown error handling', () => {
    it('should return 500 for unknown errors', () => {
      const error = new Error('Something unexpected');

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(jsonMock).toHaveBeenCalledWith({
        error: {
          message: 'An unexpected error occurred.',
          code: ApiErrorCode.INTERNAL,
        },
      });
    });

    it('should log unexpected errors', () => {
      const error = new Error('Something unexpected');

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(logger.error).toHaveBeenCalledWith({ err: error }, 'Unexpected error');
    });

    it('should not expose internal error details', () => {
      const error = new Error('Database connection string: postgres://user:password@host');

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(jsonMock).toHaveBeenCalledWith({
        error: {
          message: 'An unexpected error occurred.',
          code: ApiErrorCode.INTERNAL,
        },
      });
    });
  });
});
