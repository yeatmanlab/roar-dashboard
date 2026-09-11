import { describe, it, expect } from 'vitest';
import { extractFgaObjectId } from './extract-fga-object-id.helper';
import { ApiError } from '../../../errors/api-error';
import { ApiErrorCode } from '../../../enums/api-error-code.enum';
import { ApiErrorMessage } from '../../../enums/api-error-message.enum';

describe('extractFgaObjectId', () => {
  it('extracts ID from fully qualified FGA object string', () => {
    expect(extractFgaObjectId('administration:abc-123')).toBe('abc-123');
  });

  it('handles UUID format', () => {
    expect(extractFgaObjectId('district:550e8400-e29b-41d4-a716-446655440000')).toBe(
      '550e8400-e29b-41d4-a716-446655440000',
    );
  });

  it('throws ApiError on input without colon', () => {
    expect(() => extractFgaObjectId('no-colon')).toThrow(ApiError);
    expect(() => extractFgaObjectId('no-colon')).toThrow(ApiErrorMessage.INTERNAL_SERVER_ERROR);
  });

  it('throws ApiError with EXTERNAL_SERVICE_FAILED code on malformed input', () => {
    let thrownError: unknown;
    try {
      extractFgaObjectId('administration:');
    } catch (error) {
      thrownError = error;
    }

    expect(thrownError).toBeInstanceOf(ApiError);
    expect((thrownError as ApiError).code).toBe(ApiErrorCode.EXTERNAL_SERVICE_FAILED);
  });

  it('throws ApiError on empty string', () => {
    expect(() => extractFgaObjectId('')).toThrow(ApiError);
    expect(() => extractFgaObjectId('')).toThrow(ApiErrorMessage.INTERNAL_SERVER_ERROR);
  });
});
