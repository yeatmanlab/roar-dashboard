import { describe, it, expect } from 'vitest';
import { StatusCodes } from 'http-status-codes';
import { ApiError } from '../errors/api-error';
import { ApiErrorCode } from '../enums/api-error-code.enum';
import { toErrorResponse } from './to-error-response.util';

describe('toErrorResponse', () => {
  it('should return a response with status 404 when 404 is expected', () => {
    const error = new ApiError('Not found', {
      statusCode: StatusCodes.NOT_FOUND,
      code: ApiErrorCode.RESOURCE_NOT_FOUND,
      traceId: 'trace-404',
    });

    const result = toErrorResponse(error, [StatusCodes.NOT_FOUND, StatusCodes.FORBIDDEN]);

    expect(result).toEqual({
      status: StatusCodes.NOT_FOUND,
      body: {
        error: {
          message: 'Not found',
          code: 'resource/not-found',
          traceId: 'trace-404',
        },
      },
    });
  });

  it('should return a response with status 403 when 403 is expected', () => {
    const error = new ApiError('Forbidden', {
      statusCode: StatusCodes.FORBIDDEN,
      code: ApiErrorCode.AUTH_FORBIDDEN,
      traceId: 'trace-403',
    });

    const result = toErrorResponse(error, [StatusCodes.NOT_FOUND, StatusCodes.FORBIDDEN]);

    expect(result).toEqual({
      status: StatusCodes.FORBIDDEN,
      body: {
        error: {
          message: 'Forbidden',
          code: 'auth/forbidden',
          traceId: 'trace-403',
        },
      },
    });
  });

  it('should re-throw when the status code is not in the expected list', () => {
    const error = new ApiError('Internal error', {
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
    });

    expect(() => toErrorResponse(error, [StatusCodes.NOT_FOUND, StatusCodes.FORBIDDEN])).toThrow(error);
  });
});
