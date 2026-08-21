import { describe, test, expect } from 'vitest';
import { buildRunMetadata } from './runMetadata';

describe('buildRunMetadata', () => {
  test('returns undefined for undefined, null, or empty params', () => {
    expect(buildRunMetadata(undefined)).toBeUndefined();
    expect(buildRunMetadata(null)).toBeUndefined();
    expect(buildRunMetadata({})).toBeUndefined();
  });

  test('returns undefined when every value is null, undefined, or empty string', () => {
    expect(buildRunMetadata({ a: null, b: undefined, c: '' })).toBeUndefined();
  });

  test('drops null / undefined / empty-string values, keeps the rest', () => {
    expect(buildRunMetadata({ pid: 'p1', grade: null, age: '', birthYear: undefined })).toEqual({ pid: 'p1' });
  });

  test('preserves falsy-but-meaningful values (0 and false)', () => {
    expect(buildRunMetadata({ pid: 'p1', count: 0, flag: false })).toEqual({ pid: 'p1', count: 0, flag: false });
  });
});
