import { describe, it, expect } from 'vitest';
import { extractFgaObjectId } from './extract-fga-object-id.helper';

describe('extractFgaObjectId', () => {
  it('extracts ID from fully qualified FGA object string', () => {
    expect(extractFgaObjectId('administration:abc-123')).toBe('abc-123');
  });

  it('handles UUID format', () => {
    expect(extractFgaObjectId('district:550e8400-e29b-41d4-a716-446655440000')).toBe(
      '550e8400-e29b-41d4-a716-446655440000',
    );
  });

  it('returns empty string for malformed input', () => {
    expect(extractFgaObjectId('no-colon')).toBe('');
  });
});
