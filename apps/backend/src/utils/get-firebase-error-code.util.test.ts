import { describe, it, expect } from 'vitest';
import { getFirebaseErrorCode } from './get-firebase-error-code.util';

describe('getFirebaseErrorCode', () => {
  it('should extract code from direct code property', () => {
    const error = { code: 'auth/invalid-token' };
    expect(getFirebaseErrorCode(error)).toBe('auth/invalid-token');
  });

  it('should extract code from errorInfo.code property', () => {
    const error = { errorInfo: { code: 'auth/id-token-expired' } };
    expect(getFirebaseErrorCode(error)).toBe('auth/id-token-expired');
  });

  it('should prioritize direct code over errorInfo.code', () => {
    const error = {
      code: 'auth/invalid-token',
      errorInfo: { code: 'auth/id-token-expired' },
    };
    expect(getFirebaseErrorCode(error)).toBe('auth/invalid-token');
  });

  it('should return undefined for invalid inputs', () => {
    expect(getFirebaseErrorCode(null)).toBeUndefined();
    expect(getFirebaseErrorCode(undefined)).toBeUndefined();
    expect(getFirebaseErrorCode('string')).toBeUndefined();
    expect(getFirebaseErrorCode(123)).toBeUndefined();
    expect(getFirebaseErrorCode({})).toBeUndefined();
  });

  it('should return undefined when code is not a string', () => {
    expect(getFirebaseErrorCode({ code: 123 })).toBeUndefined();
    expect(getFirebaseErrorCode({ code: null })).toBeUndefined();
    expect(getFirebaseErrorCode({ errorInfo: { code: 123 } })).toBeUndefined();
  });
});
