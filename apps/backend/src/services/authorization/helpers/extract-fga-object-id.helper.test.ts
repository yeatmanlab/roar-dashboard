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

  it('throws on input without colon', () => {
    expect(() => extractFgaObjectId('no-colon')).toThrow('Malformed FGA object string: "no-colon"');
  });

  it('throws on input with colon but empty ID', () => {
    expect(() => extractFgaObjectId('administration:')).toThrow('Malformed FGA object string: "administration:"');
  });

  it('throws on empty string', () => {
    expect(() => extractFgaObjectId('')).toThrow('Malformed FGA object string: ""');
  });
});
