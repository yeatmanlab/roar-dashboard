import { describe, it, expect } from 'vitest';
import { crc32String, generateAssessmentPid } from './assessment-pid.util';

describe('crc32String', () => {
  it('returns a lowercase hex string', () => {
    const result = crc32String('hello');
    expect(result).toMatch(/^[0-9a-f]+$/);
  });

  it('returns consistent output for the same input', () => {
    expect(crc32String('user@example.com')).toBe(crc32String('user@example.com'));
  });

  it('returns different output for different inputs', () => {
    expect(crc32String('a')).not.toBe(crc32String('b'));
  });

  it('returns unsigned hex (no leading minus)', () => {
    // crc-32 returns signed integers; ensure result is never negative
    const result = crc32String('test-input-that-produces-negative-signed-crc');
    expect(result.startsWith('-')).toBe(false);
  });
});

describe('generateAssessmentPid', () => {
  // ── Validation errors ────────────────────────────────────────────────────────

  it('throws when userId is empty string', () => {
    expect(() => generateAssessmentPid({ userId: '' })).toThrow('userId is required');
  });

  it('throws when userId is whitespace only', () => {
    expect(() => generateAssessmentPid({ userId: '   ' })).toThrow('userId is required');
  });

  it('throws when districtPrefix exceeds maxPrefixLength', () => {
    expect(() => generateAssessmentPid({ userId: 'user@example.com', districtPrefix: 'TOOLONGPREFIX' })).toThrow(
      'District prefix cannot exceed 10 characters',
    );
  });

  it('throws when schoolPrefix exceeds maxPrefixLength', () => {
    expect(() => generateAssessmentPid({ userId: 'user@example.com', schoolPrefix: 'TOOLONGPREFIX' })).toThrow(
      'School prefix cannot exceed 10 characters',
    );
  });

  it('throws when separator is empty string', () => {
    expect(() => generateAssessmentPid({ userId: 'user@example.com', separator: '' })).toThrow(
      'Separator must be a non-empty string',
    );
  });

  it('respects a custom maxPrefixLength', () => {
    expect(() =>
      generateAssessmentPid({ userId: 'user@example.com', districtPrefix: 'ABC', maxPrefixLength: 2 }),
    ).toThrow('District prefix cannot exceed 2 characters');
  });

  // ── Format ───────────────────────────────────────────────────────────────────

  it('returns only the checksum when no prefixes are provided', () => {
    const pid = generateAssessmentPid({ userId: 'user@example.com' });
    expect(pid).toMatch(/^[0-9a-f]+$/);
    expect(pid).not.toContain('-');
  });

  it('appends districtPrefix separated by default separator', () => {
    const pid = generateAssessmentPid({ userId: 'user@example.com', districtPrefix: 'USD' });
    const parts = pid.split('-');
    expect(parts).toHaveLength(2);
    expect(parts[1]).toBe('USD');
  });

  it('appends both prefixes in district-then-school order', () => {
    const pid = generateAssessmentPid({
      userId: 'user@example.com',
      districtPrefix: 'USD',
      schoolPrefix: 'ELEM',
    });
    const parts = pid.split('-');
    expect(parts).toHaveLength(3);
    expect(parts[1]).toBe('USD');
    expect(parts[2]).toBe('ELEM');
  });

  it('uses a custom separator', () => {
    const pid = generateAssessmentPid({
      userId: 'user@example.com',
      districtPrefix: 'USD',
      separator: '_',
    });
    expect(pid).toContain('_');
    expect(pid).not.toContain('-');
  });

  it('trims whitespace from userId before hashing', () => {
    const trimmed = generateAssessmentPid({ userId: 'user@example.com' });
    const padded = generateAssessmentPid({ userId: '  user@example.com  ' });
    expect(trimmed).toBe(padded);
  });

  it('skips districtPrefix when it is empty or whitespace', () => {
    const withEmpty = generateAssessmentPid({ userId: 'user@example.com', districtPrefix: '' });
    const withWhitespace = generateAssessmentPid({ userId: 'user@example.com', districtPrefix: '   ' });
    const withoutPrefix = generateAssessmentPid({ userId: 'user@example.com' });
    expect(withEmpty).toBe(withoutPrefix);
    expect(withWhitespace).toBe(withoutPrefix);
  });

  it('skips schoolPrefix when it is empty or whitespace', () => {
    const withEmpty = generateAssessmentPid({ userId: 'user@example.com', schoolPrefix: '' });
    const withoutPrefix = generateAssessmentPid({ userId: 'user@example.com' });
    expect(withEmpty).toBe(withoutPrefix);
  });

  it('trims whitespace from prefix values', () => {
    const padded = generateAssessmentPid({ userId: 'user@example.com', districtPrefix: '  USD  ' });
    const trimmed = generateAssessmentPid({ userId: 'user@example.com', districtPrefix: 'USD' });
    expect(padded).toBe(trimmed);
  });

  it('produces consistent output for the same inputs', () => {
    const opts = { userId: 'user@example.com', districtPrefix: 'USD', schoolPrefix: 'ELEM' };
    expect(generateAssessmentPid(opts)).toBe(generateAssessmentPid(opts));
  });
});
