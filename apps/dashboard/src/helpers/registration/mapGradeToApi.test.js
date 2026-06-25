import { describe, it, expect } from 'vitest';
import { mapGradeToApi } from './mapGradeToApi';

describe('mapGradeToApi', () => {
  it('maps the short early-childhood codes to long-form enum values', () => {
    expect(mapGradeToApi('PK')).toBe('PreKindergarten');
    expect(mapGradeToApi('TK')).toBe('TransitionalKindergarten');
    expect(mapGradeToApi('K')).toBe('Kindergarten');
  });

  it('passes through numeric grade strings 1–12 unchanged', () => {
    for (let n = 1; n <= 12; n += 1) {
      expect(mapGradeToApi(String(n))).toBe(String(n));
    }
  });

  it('accepts a numeric grade and coerces it to a string', () => {
    expect(mapGradeToApi(3)).toBe('3');
  });

  it('throws on an empty or missing grade', () => {
    expect(() => mapGradeToApi('')).toThrow(/required/i);
    expect(() => mapGradeToApi(undefined)).toThrow(/required/i);
    expect(() => mapGradeToApi(null)).toThrow(/required/i);
  });

  it('throws on an unrecognized grade rather than passing it through', () => {
    expect(() => mapGradeToApi('first')).toThrow(/Unrecognized grade/i);
    expect(() => mapGradeToApi('20')).toThrow(/Unrecognized grade/i);
  });
});
