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

  // Regression: `new Date('YYYY-MM-DD')` parses as UTC midnight while the helper's
  // local getters read local time, so date-only strings used to come back a day
  // early for every negative UTC offset. These dates are returned verbatim without
  // touching `Date`, so the result no longer depends on the runner's time zone.
  it('returns date-only strings unchanged regardless of time zone', () => {
    expect(formatDobToApiDate('2015-12-25')).toBe('2015-12-25');
    expect(formatDobToApiDate('2015-01-01')).toBe('2015-01-01');
    expect(formatDobToApiDate('2016-02-29')).toBe('2016-02-29'); // real leap day
  });

  it('trims surrounding whitespace on a date-only string', () => {
    expect(formatDobToApiDate('  2015-12-25  ')).toBe('2015-12-25');
  });

  // `new Date('2015-02-30')` silently rolls over to March 1 rather than reporting
  // an invalid date, which would have recorded a DOB the user never entered.
  it('throws on a date-only string naming a day that does not exist', () => {
    expect(() => formatDobToApiDate('2015-02-30')).toThrow(/invalid/i);
    expect(() => formatDobToApiDate('2015-11-31')).toThrow(/invalid/i);
    expect(() => formatDobToApiDate('2015-02-29')).toThrow(/invalid/i); // 2015 is not a leap year
    expect(() => formatDobToApiDate('2015-13-01')).toThrow(/invalid/i);
    expect(() => formatDobToApiDate('2015-00-10')).toThrow(/invalid/i);
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
