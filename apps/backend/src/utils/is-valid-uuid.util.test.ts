import { describe, it, expect } from 'vitest';
import { isValidUuid } from './is-valid-uuid.util';

describe('isValidUuid', () => {
  it('should return true for valid UUIDs', () => {
    expect(isValidUuid('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    expect(isValidUuid('6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toBe(true);
    expect(isValidUuid('f47ac10b-58cc-4372-a567-0e02b2c3d479')).toBe(true);
  });

  it('should return true for uppercase UUIDs', () => {
    expect(isValidUuid('550E8400-E29B-41D4-A716-446655440000')).toBe(true);
    expect(isValidUuid('F47AC10B-58CC-4372-A567-0E02B2C3D479')).toBe(true);
  });

  it('should return true for mixed case UUIDs', () => {
    expect(isValidUuid('550e8400-E29B-41d4-A716-446655440000')).toBe(true);
  });

  it('should return false for invalid UUIDs', () => {
    expect(isValidUuid('')).toBe(false);
    expect(isValidUuid('not-a-uuid')).toBe(false);
    expect(isValidUuid('550e8400-e29b-41d4-a716')).toBe(false);
    expect(isValidUuid('550e8400e29b41d4a716446655440000')).toBe(false);
  });

  it('should return false for UUIDs with invalid characters', () => {
    expect(isValidUuid('550e8400-e29b-41d4-a716-44665544000g')).toBe(false);
    expect(isValidUuid('550e8400-e29b-41d4-a716-44665544000!')).toBe(false);
  });

  it('should return false for SQL injection attempts', () => {
    expect(isValidUuid("'; DROP TABLE users; --")).toBe(false);
    expect(isValidUuid('550e8400-e29b-41d4-a716-446655440000; DROP TABLE')).toBe(false);
    expect(isValidUuid("550e8400-e29b-41d4-a716-446655440000' OR '1'='1")).toBe(false);
  });
});
