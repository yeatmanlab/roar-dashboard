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

  describe('ISO (YYYY-MM-DD) form', () => {
    it.each([
      ['1999-01-02', 'zero-padded with hyphens'],
      ['1999/01/02', 'zero-padded with slashes'],
      ['1999-1-2', 'single-digit month and day with hyphens'],
      ['1999/1/2', 'single-digit month and day with slashes'],
      ['1999-1-02', 'mixed padding'],
      ['1999/01/2', 'mixed padding with slashes'],
      [' 1999/1/2 ', 'surrounding whitespace is trimmed'],
    ])('accepts %s (%s)', (dob) => {
      // Local midnight, matching the US form — see the timezone note below.
      expect(parseDob(dob)).toEqual(new Date(1999, 0, 2));
    });

    it('reads the leading group as the year, not the month', () => {
      // The US form would read 2015 as a month; ISO must win for a 4-digit lead.
      expect(parseDob('2015-03-04')).toEqual(new Date(2015, 2, 4));
    });

    it('distinguishes ISO from the US form for the same digits', () => {
      expect(parseDob('2015-03-04')).toEqual(new Date(2015, 2, 4)); // March 4
      expect(parseDob('03-04-2015')).toEqual(new Date(2015, 2, 4)); // also March 4
      expect(parseDob('04-03-2015')).toEqual(new Date(2015, 3, 3)); // April 3
    });

    it('returns local midnight, matching the US form', () => {
      // formatDobToApiDate reads Date inputs with local getters, so an ISO input
      // must not be parsed as UTC — that shifts the date back a day west of UTC.
      const date = parseDob('1999/1/2');
      expect(date.getHours()).toBe(0);
      expect(date.getMinutes()).toBe(0);
      expect(parseDob('1999/1/2').getTime()).toBe(parseDob('1/2/1999').getTime());
    });

    it.each([
      ['1999-1/2', 'mixed separators'],
      ['1999/1-2', 'mixed separators reversed'],
      ['99-01-02', 'two-digit year is ambiguous'],
      ['1999-01', 'missing day'],
      ['1999--2', 'missing month'],
      ['1999-01-02extra', 'trailing characters'],
    ])('rejects %s (%s)', (dob) => {
      expect(parseDob(dob)).toBeNull();
    });

    it.each([
      ['2020-02-30', 'day overflows into the next month'],
      ['2020-13-01', 'month out of range'],
      ['2021-02-29', '2021 is not a leap year'],
    ])('rejects %s (%s)', (dob) => {
      expect(parseDob(dob)).toBeNull();
    });

    it('accepts a valid leap day', () => {
      expect(parseDob('2020-02-29')).toEqual(new Date(2020, 1, 29));
    });

    it('rejects a future date', () => {
      const nextYear = new Date().getFullYear() + 1;
      expect(parseDob(`${nextYear}-01-01`)).toBeNull();
    });
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
