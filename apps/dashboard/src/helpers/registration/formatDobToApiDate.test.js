import { describe, it, expect } from 'vitest';
import { formatDobToApiDate } from './formatDobToApiDate';

describe('formatDobToApiDate', () => {
  it('formats a Date at local midnight to YYYY-MM-DD preserving the calendar date', () => {
    // Constructed via the local-time constructor (year, monthIndex, day), this is
    // local midnight. `toISOString().slice(0,10)` would shift this to the prior
    // day for any negative UTC offset; the helper must preserve 2018-05-04.
    const dob = new Date(2018, 4, 4); // May 4, 2018, local midnight
    expect(formatDobToApiDate(dob)).toBe('2018-05-04');
  });

  it('zero-pads single-digit months and days', () => {
    const dob = new Date(2009, 0, 7); // Jan 7, 2009
    expect(formatDobToApiDate(dob)).toBe('2009-01-07');
  });

  it('accepts an ISO date string and normalizes it', () => {
    expect(formatDobToApiDate('2015-12-25')).toBe('2015-12-25');
  });

  it('throws on a missing date', () => {
    expect(() => formatDobToApiDate('')).toThrow(/required/i);
    expect(() => formatDobToApiDate(undefined)).toThrow(/required/i);
    expect(() => formatDobToApiDate(null)).toThrow(/required/i);
  });

  it('throws on an invalid date', () => {
    expect(() => formatDobToApiDate('not-a-date')).toThrow(/invalid/i);
    expect(() => formatDobToApiDate(new Date('nope'))).toThrow(/invalid/i);
  });
});
