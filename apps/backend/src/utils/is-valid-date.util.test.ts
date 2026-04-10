import { describe, it, expect } from 'vitest';
import { isValidDate } from './is-valid-date.util';

describe('isValidDate', () => {
  it('returns true for a valid Date', () => {
    expect(isValidDate(new Date('2024-01-01'))).toBe(true);
  });

  it('returns true for Date.now()', () => {
    expect(isValidDate(new Date())).toBe(true);
  });

  it('returns false for an invalid Date', () => {
    expect(isValidDate(new Date('not-a-date'))).toBe(false);
  });

  it('returns false for null', () => {
    expect(isValidDate(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isValidDate(undefined)).toBe(false);
  });

  it('returns false for a number', () => {
    expect(isValidDate(1234567890)).toBe(false);
  });

  it('returns false for an ISO string', () => {
    expect(isValidDate('2024-01-01T00:00:00.000Z')).toBe(false);
  });
});
