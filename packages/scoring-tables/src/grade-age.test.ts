import { describe, it, expect } from 'vitest';
import {
  GRADE_TO_AGE_INTERCEPT_MONTHS,
  MONTHS_PER_GRADE,
  clampToRange,
  deriveAgeMonths,
  resolveKeyValue,
} from './grade-age.js';

describe('deriveAgeMonths', () => {
  it('returns ageMonths directly when present', () => {
    expect(deriveAgeMonths({ ageMonths: 84, grade: 5 })).toBe(84);
  });

  it('falls back to the grade heuristic when age is null', () => {
    // Kindergarten (grade 0) → 66; grade 1 → 78; grade 3 → 102
    expect(deriveAgeMonths({ ageMonths: null, grade: 0 })).toBe(GRADE_TO_AGE_INTERCEPT_MONTHS);
    expect(deriveAgeMonths({ ageMonths: undefined, grade: 1 })).toBe(GRADE_TO_AGE_INTERCEPT_MONTHS + MONTHS_PER_GRADE);
    expect(deriveAgeMonths({ grade: 3 })).toBe(66 + 3 * 12);
  });

  it('falls back to grade when ageMonths is non-finite (NaN)', () => {
    expect(deriveAgeMonths({ ageMonths: Number.NaN, grade: 2 })).toBe(90);
  });

  it('returns null when neither age nor grade is usable', () => {
    expect(deriveAgeMonths({})).toBeNull();
    expect(deriveAgeMonths({ ageMonths: null, grade: null })).toBeNull();
    expect(deriveAgeMonths({ ageMonths: Number.NaN, grade: Number.NaN })).toBeNull();
  });
});

describe('clampToRange', () => {
  it('leaves values within range unchanged', () => {
    expect(clampToRange(84, { min: 60, max: 96 })).toBe(84);
  });

  it('clamps below min and above max', () => {
    expect(clampToRange(48, { min: 60, max: 96 })).toBe(60);
    expect(clampToRange(200, { min: 60, max: 96 })).toBe(96);
  });

  it('honours one-sided bounds', () => {
    expect(clampToRange(10, { min: 72 })).toBe(72);
    expect(clampToRange(300, { max: 216 })).toBe(216);
    expect(clampToRange(10, { max: 216 })).toBe(10);
  });

  it('returns the value unchanged when no range is given', () => {
    expect(clampToRange(123, undefined)).toBe(123);
  });
});

describe('resolveKeyValue', () => {
  it('derives + clamps age for keyKind "ageMonths"', () => {
    expect(resolveKeyValue({ keyKind: 'ageMonths', clamp: { min: 72, max: 216 } }, { ageMonths: 60 })).toBe(72);
    expect(resolveKeyValue({ keyKind: 'ageMonths', clamp: { min: 60, max: 96 } }, { ageMonths: 84 })).toBe(84);
  });

  it('uses the grade fallback then clamps for keyKind "ageMonths"', () => {
    // grade 1 → 78 months, within [60, 96]
    expect(resolveKeyValue({ keyKind: 'ageMonths', clamp: { min: 60, max: 96 } }, { grade: 1 })).toBe(78);
  });

  it('keys on grade (clamped) for keyKind "grade"', () => {
    expect(resolveKeyValue({ keyKind: 'grade', clamp: { min: 1, max: 12 } }, { grade: 5 })).toBe(5);
    expect(resolveKeyValue({ keyKind: 'grade', clamp: { min: 1, max: 12 } }, { grade: 0 })).toBe(1);
    expect(resolveKeyValue({ keyKind: 'grade', clamp: { min: 1, max: 12 } }, { grade: 13 })).toBe(12);
  });

  it('does not fall back to age when keyKind is "grade" and grade is absent', () => {
    expect(resolveKeyValue({ keyKind: 'grade' }, { ageMonths: 120 })).toBeNull();
  });

  it('returns null when the required demographic is unavailable', () => {
    expect(resolveKeyValue({ keyKind: 'ageMonths' }, {})).toBeNull();
    expect(resolveKeyValue({ keyKind: 'grade' }, {})).toBeNull();
  });
});
