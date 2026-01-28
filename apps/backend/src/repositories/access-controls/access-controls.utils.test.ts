import { describe, it, expect } from 'vitest';
import { parseAccessControlFilter } from './access-controls.utils';

describe('parseAccessControlFilter', () => {
  it('should parse valid filter', () => {
    const result = parseAccessControlFilter({
      userId: 'user-123',
      allowedRoles: ['student', 'teacher'],
    });

    expect(result.userId).toBe('user-123');
    expect(result.allowedRoles).toEqual(['student', 'teacher']);
  });

  it('should throw when userId is empty', () => {
    expect(() =>
      parseAccessControlFilter({
        userId: '',
        allowedRoles: ['student'],
      }),
    ).toThrow('userId cannot be empty');
  });

  it('should throw when allowedRoles is empty', () => {
    expect(() =>
      parseAccessControlFilter({
        userId: 'user-123',
        allowedRoles: [],
      }),
    ).toThrow('allowedRoles cannot be empty');
  });

  it('should throw for invalid role values', () => {
    expect(() =>
      parseAccessControlFilter({
        userId: 'user-123',
        allowedRoles: ['invalid_role'],
      }),
    ).toThrow();
  });
});
