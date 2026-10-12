import { describe, it, expect } from 'vitest';
import { parseDob } from './parseDob';

describe('parseDob', () => {
  it.each([
    ['2/1/2020', 'single-digit month and day with slashes'],
    ['02/01/2020', 'zero-padded with slashes'],
    ['2-1-2020', 'single-digit with hyphens'],
    ['02-01-2020', 'zero-padded with hyphens'],
    [' 2/1/2020 ', 'surrounding whitespace is trimmed'],
  ])('accepts %s (%s)', (dob) => {
    expect(parseDob(dob)).toBeInstanceOf(Date);
  });

  it('parses the date correctly', () => {
    const date = parseDob('2/1/2020');
    expect(date.getFullYear()).toBe(2020);
    expect(date.getMonth()).toBe(1); // February, zero-indexed
    expect(date.getDate()).toBe(1);
  });

  it.each([
    ['2/1/12', 'two-digit year is ambiguous'],
    ['2-1/2020', 'mixed separators'],
    ['2/1-2020', 'mixed separators reversed'],
    ['2//2020', 'missing day'],
    ['2/1/2020extra', 'trailing characters'],
    ['not a date', 'non-numeric'],
    ['', 'empty string'],
  ])('rejects %s (%s)', (dob) => {
    expect(parseDob(dob)).toBeNull();
  });

  it.each([
    ['2/30/2020', 'day overflows into the next month'],
    ['13/1/2020', 'month out of range'],
    ['13/45/2020', 'month and day out of range'],
    ['2/29/2021', '2021 is not a leap year'],
  ])('rejects %s (%s)', (dob) => {
    expect(parseDob(dob)).toBeNull();
  });

  it('accepts a valid leap day', () => {
    expect(parseDob('2/29/2020')).toBeInstanceOf(Date);
  });

  it('rejects a future date', () => {
    const nextYear = new Date().getFullYear() + 1;
    expect(parseDob(`1/1/${nextYear}`)).toBeNull();
  });
});
