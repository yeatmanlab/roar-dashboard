import { describe, it, expect } from 'vitest';
import { toPostgresUuidArray } from './to-postgres-uuid-array.util';

describe('toPostgresUuidArray', () => {
  it('should convert an array of UUIDs to PostgreSQL array literal', () => {
    const ids = ['550e8400-e29b-41d4-a716-446655440000', 'f47ac10b-58cc-4372-a567-0e02b2c3d479'];
    expect(toPostgresUuidArray(ids)).toBe(
      '{550e8400-e29b-41d4-a716-446655440000,f47ac10b-58cc-4372-a567-0e02b2c3d479}',
    );
  });

  it('should handle a single UUID', () => {
    const ids = ['550e8400-e29b-41d4-a716-446655440000'];
    expect(toPostgresUuidArray(ids)).toBe('{550e8400-e29b-41d4-a716-446655440000}');
  });

  it('should handle an empty array', () => {
    expect(toPostgresUuidArray([])).toBe('{}');
  });

  it('should throw an error for invalid UUIDs', () => {
    expect(() => toPostgresUuidArray(['not-a-uuid'])).toThrow('Invalid UUID format: not-a-uuid');
  });

  it('should throw an error if any UUID in the array is invalid', () => {
    const ids = ['550e8400-e29b-41d4-a716-446655440000', 'invalid', 'f47ac10b-58cc-4372-a567-0e02b2c3d479'];
    expect(() => toPostgresUuidArray(ids)).toThrow('Invalid UUID format: invalid');
  });

  it('should throw an error for SQL injection attempts', () => {
    expect(() => toPostgresUuidArray(["'; DROP TABLE users; --"])).toThrow('Invalid UUID format');
    expect(() => toPostgresUuidArray(['550e8400-e29b-41d4-a716-446655440000', "' OR '1'='1"])).toThrow(
      'Invalid UUID format',
    );
  });
});
