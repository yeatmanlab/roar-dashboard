import { describe, it, expect } from 'vitest';
import { getApiErrorCode, getApiErrorMessage } from './api-errors';

describe('getApiErrorCode', () => {
  it('extracts code from full ts-rest result shape', () => {
    const result = { status: 403, body: { error: { code: 'auth/forbidden', message: 'Forbidden' } } };
    expect(getApiErrorCode(result)).toBe('auth/forbidden');
  });

  it('extracts code from direct error object shape', () => {
    const body = { error: { code: 'auth/token-expired', message: 'Token expired' } };
    expect(getApiErrorCode(body)).toBe('auth/token-expired');
  });

  it('extracts code from plain object with code property', () => {
    const obj = { code: 'some-error' };
    expect(getApiErrorCode(obj)).toBe('some-error');
  });

  it('returns null when no code is present', () => {
    expect(getApiErrorCode({})).toBeNull();
    expect(getApiErrorCode(null)).toBeNull();
    expect(getApiErrorCode(undefined)).toBeNull();
  });

  it('ignores non-string code values', () => {
    expect(getApiErrorCode({ code: 42 })).toBeNull();
    expect(getApiErrorCode({ code: true })).toBeNull();
  });

  it('prefers body.error.code over error.code', () => {
    const ambiguous = {
      body: { error: { code: 'from-body' } },
      error: { code: 'from-error' },
      code: 'from-plain',
    };
    expect(getApiErrorCode(ambiguous)).toBe('from-body');
  });
});

describe('getApiErrorMessage', () => {
  it('extracts message from full ts-rest result shape', () => {
    const result = { status: 404, body: { error: { code: 'not-found', message: 'Not found' } } };
    expect(getApiErrorMessage(result)).toBe('Not found');
  });

  it('extracts message from direct error object shape', () => {
    const body = { error: { message: 'Something went wrong' } };
    expect(getApiErrorMessage(body)).toBe('Something went wrong');
  });

  it('extracts message from plain object with message property', () => {
    const obj = { message: 'plain error' };
    expect(getApiErrorMessage(obj)).toBe('plain error');
  });

  it('returns null when no message is present', () => {
    expect(getApiErrorMessage({})).toBeNull();
    expect(getApiErrorMessage(null)).toBeNull();
    expect(getApiErrorMessage(undefined)).toBeNull();
  });

  it('ignores non-string message values', () => {
    expect(getApiErrorMessage({ message: 42 })).toBeNull();
  });

  it('prefers body.error.message over error.message', () => {
    const ambiguous = {
      body: { error: { message: 'from-body' } },
      error: { message: 'from-error' },
      message: 'from-plain',
    };
    expect(getApiErrorMessage(ambiguous)).toBe('from-body');
  });
});
