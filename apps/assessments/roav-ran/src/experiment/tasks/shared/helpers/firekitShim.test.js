import { describe, test, expect } from 'vitest';
import { normalizeStage } from './firekitShim';

describe('normalizeStage', () => {
  test("maps RANView's capitalized stages to the canonical practice/test", () => {
    expect(normalizeStage('Practice')).toBe('practice');
    expect(normalizeStage('Test')).toBe('test');
  });

  test('maps eye-calibration events to practice_response', () => {
    expect(normalizeStage('eyeCalibration')).toBe('practice_response');
  });

  test('passes already-canonical stages through unchanged (symbolSearch)', () => {
    expect(normalizeStage('practice')).toBe('practice');
    expect(normalizeStage('test')).toBe('test');
    expect(normalizeStage('practice_response')).toBe('practice_response');
    expect(normalizeStage('test_response')).toBe('test_response');
  });

  test('is case-insensitive', () => {
    expect(normalizeStage('PRACTICE')).toBe('practice');
    expect(normalizeStage('EYECALIBRATION')).toBe('practice_response');
  });

  test('defaults unmapped, unknown, or missing stages to test', () => {
    expect(normalizeStage('headCalibration')).toBe('test');
    expect(normalizeStage('somethingElse')).toBe('test');
    expect(normalizeStage(undefined)).toBe('test');
    expect(normalizeStage(null)).toBe('test');
    expect(normalizeStage('')).toBe('test');
  });
});
