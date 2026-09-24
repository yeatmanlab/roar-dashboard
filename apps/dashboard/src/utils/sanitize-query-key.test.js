import { describe, it, expect } from 'vitest';
import { sanitizeQueryKey } from './sanitize-query-key';

const UUID = '4f3e2d1c-0b9a-4876-b543-210fedcba987';

describe('sanitizeQueryKey', () => {
  it('passes the family constant, UUIDs, and slug-prefixed UUIDs untouched', () => {
    expect(sanitizeQueryKey(['administration-assignments', UUID, `school-${UUID}`])).toEqual([
      'administration-assignments',
      UUID,
      `school-${UUID}`,
    ]);
  });

  it('passes numbers, booleans, and null', () => {
    expect(sanitizeQueryKey(['users-list', 3, true, null])).toEqual(['users-list', 3, true, null]);
  });

  it('redacts free-text strings beyond position 0', () => {
    expect(sanitizeQueryKey(['users-list', 'timmy'])).toEqual(['users-list', '[redacted]']);
  });

  it('keeps object key names but redacts their values', () => {
    expect(sanitizeQueryKey(['users-list', { search: 'timmy', grade: 3 }])).toEqual([
      'users-list',
      { search: '[redacted]', grade: '[redacted]' },
    ]);
  });

  it('redacts a non-array key wholesale', () => {
    expect(sanitizeQueryKey('users-list')).toBe('[redacted]');
    expect(sanitizeQueryKey(undefined)).toBe('[redacted]');
  });
});
