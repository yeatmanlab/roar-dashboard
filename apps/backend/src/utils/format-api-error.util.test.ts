import { describe, it, expect } from 'vitest';
import { StatusCodes } from 'http-status-codes';
import { ApiError } from '../errors/api-error';
import { ApiErrorCode } from '../enums/api-error-code.enum';
import { formatApiError } from './format-api-error.util';

describe('formatApiError', () => {
  it('should format an ApiError with all fields', () => {
    const error = new ApiError('Not found', {
      statusCode: StatusCodes.NOT_FOUND,
      code: ApiErrorCode.RESOURCE_NOT_FOUND,
      traceId: 'trace-123',
    });

    expect(formatApiError(error)).toEqual({
      error: {
        message: 'Not found',
        code: 'resource/not-found',
        traceId: 'trace-123',
      },
    });
  });

  it('should include auto-generated traceId when not provided', () => {
    const error = new ApiError('Forbidden', {
      statusCode: StatusCodes.FORBIDDEN,
      code: ApiErrorCode.AUTH_FORBIDDEN,
    });

    const result = formatApiError(error);

    expect(result.error.message).toBe('Forbidden');
    expect(result.error.code).toBe('auth/forbidden');
    expect(result.error.traceId).toEqual(expect.any(String));
  });

  it('should handle ApiError with no code', () => {
    const error = new ApiError('Something went wrong');

    const result = formatApiError(error);

    expect(result.error.message).toBe('Something went wrong');
    expect(result.error.code).toBeUndefined();
    expect(result.error.traceId).toEqual(expect.any(String));
  });
});
