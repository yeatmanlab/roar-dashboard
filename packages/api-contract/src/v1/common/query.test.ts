import { describe, it, expect } from 'vitest';
import { createDynamicSortQuerySchema } from './query';

const STATIC_FIELDS = ['user.lastName', 'user.firstName'] as const;
const UUID_PATTERN = /^progress\.[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.status$/;

function parse(input: Record<string, unknown>) {
  const schema = createDynamicSortQuerySchema(STATIC_FIELDS, 'user.lastName', 'asc', [UUID_PATTERN]);
  return schema.parse(input);
}

function parseSafe(input: Record<string, unknown>) {
  const schema = createDynamicSortQuerySchema(STATIC_FIELDS, 'user.lastName', 'asc', [UUID_PATTERN]);
  return schema.safeParse(input);
}

describe('createDynamicSortQuerySchema', () => {
  it('accepts static sort fields', () => {
    const result = parse({ sortBy: 'user.lastName' });
    expect(result.sortBy).toBe('user.lastName');
  });

  it('defaults to the specified default field', () => {
    const result = parse({});
    expect(result.sortBy).toBe('user.lastName');
    expect(result.sortOrder).toBe('asc');
  });

  it('accepts a valid progress.<uuid>.status sort field', () => {
    const result = parse({ sortBy: 'progress.ae557e88-582d-55fe-b41d-ba826adce70e.status' });
    expect(result.sortBy).toBe('progress.ae557e88-582d-55fe-b41d-ba826adce70e.status');
  });

  it('rejects an invalid UUID in dynamic sort field', () => {
    const result = parseSafe({ sortBy: 'progress.not-a-uuid.status' });
    expect(result.success).toBe(false);
  });

  it('rejects completely unknown sort fields', () => {
    const result = parseSafe({ sortBy: 'garbage' });
    expect(result.success).toBe(false);
  });

  it('accepts sortOrder parameter', () => {
    const result = parse({ sortBy: 'user.firstName', sortOrder: 'desc' });
    expect(result.sortOrder).toBe('desc');
  });
});
