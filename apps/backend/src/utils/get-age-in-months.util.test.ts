import { describe, it, expect } from 'vitest';
import { getAgeInMonthsFromDob } from './get-age-in-months.util';

describe('getAgeInMonthsFromDob', () => {
  const asOf = new Date(Date.UTC(2026, 5, 20)); // 2026-06-20

  it('computes whole months from a date-only dob string', () => {
    expect(getAgeInMonthsFromDob('2016-06-20', asOf)).toBe(120); // exactly 10 years
    expect(getAgeInMonthsFromDob('2016-12-20', asOf)).toBe(114); // 9.5 years
  });

  it('subtracts a month when the birth day-of-month has not been reached', () => {
    expect(getAgeInMonthsFromDob('2016-06-21', asOf)).toBe(119);
  });

  it('accepts a Date object', () => {
    expect(getAgeInMonthsFromDob(new Date(Date.UTC(2020, 5, 20)), asOf)).toBe(72);
  });

  it('returns null for missing or unparseable dob', () => {
    expect(getAgeInMonthsFromDob(null, asOf)).toBeNull();
    expect(getAgeInMonthsFromDob(undefined, asOf)).toBeNull();
    expect(getAgeInMonthsFromDob('not-a-date', asOf)).toBeNull();
  });

  it('clamps a future dob to 0 rather than returning negative months', () => {
    expect(getAgeInMonthsFromDob('2030-01-01', asOf)).toBe(0);
  });
});
