import { describe, it, expect } from 'vitest';
import { createFilterQuerySchema } from './common';

const ALLOWED_FIELDS = ['user.grade', 'user.firstName', 'user.lastName'] as const;

function parse(input: string | string[] | undefined) {
  const schema = createFilterQuerySchema(ALLOWED_FIELDS);
  return schema.shape.filter.parse(input);
}

function parseError(input: string | string[] | undefined): string[] {
  const schema = createFilterQuerySchema(ALLOWED_FIELDS);
  const result = schema.shape.filter.safeParse(input);
  if (result.success) throw new Error('Expected parse to fail');
  return result.error.issues.map((i) => i.message);
}

describe('createFilterQuerySchema', () => {
  describe('input normalization', () => {
    it('returns empty array for undefined input', () => {
      expect(parse(undefined)).toEqual([]);
    });

    it('accepts a single string and parses it', () => {
      const result = parse('user.grade:eq:3');
      expect(result).toEqual([{ field: 'user.grade', operator: 'eq', value: '3' }]);
    });

    it('accepts an array of strings', () => {
      const result = parse(['user.grade:eq:3', 'user.firstName:contains:Jane']);
      expect(result).toHaveLength(2);
      expect(result[0]!.field).toBe('user.grade');
      expect(result[1]!.field).toBe('user.firstName');
    });
  });

  describe('colon handling', () => {
    it('rejoins value parts containing colons', () => {
      const result = parse('user.firstName:eq:foo:bar:baz');
      expect(result[0]!.value).toBe('foo:bar:baz');
    });
  });

  describe('validation errors', () => {
    it('rejects filter with fewer than 3 colon-delimited parts', () => {
      const errors = parseError('user.grade:eq');
      expect(errors[0]).toContain('Invalid filter format');
    });

    it('rejects empty field name', () => {
      const errors = parseError(':eq:3');
      expect(errors[0]).toContain('field name must not be empty');
    });

    it('rejects empty value', () => {
      const errors = parseError('user.grade:eq:');
      expect(errors[0]).toContain('value must not be empty');
    });

    it('rejects unknown field names', () => {
      const errors = parseError('user.email:eq:test@example.com');
      expect(errors[0]).toContain('Unknown filter field');
      expect(errors[0]).toContain('user.email');
    });

    it('rejects invalid operator', () => {
      const errors = parseError('user.grade:like:3');
      expect(errors[0]).toContain('Invalid filter operator');
    });

    it('collects multiple errors from a single request', () => {
      const errors = parseError(['badformat', 'user.email:eq:test', ':eq:3']);
      expect(errors.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('operator parsing', () => {
    it.each(['eq', 'neq', 'in', 'gte', 'lte', 'contains'] as const)('accepts %s operator', (op) => {
      const result = parse(`user.grade:${op}:value`);
      expect(result[0]!.operator).toBe(op);
    });
  });

  describe('dynamic field patterns', () => {
    const UUID_PATTERN = /^progress\.[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.status$/;

    function parseDynamic(input: string | string[] | undefined) {
      const schema = createFilterQuerySchema(ALLOWED_FIELDS, {
        dynamicFieldPatterns: [UUID_PATTERN],
      });
      return schema.shape.filter.parse(input);
    }

    function parseDynamicSafe(input: string | string[] | undefined) {
      const schema = createFilterQuerySchema(ALLOWED_FIELDS, {
        dynamicFieldPatterns: [UUID_PATTERN],
      });
      return schema.shape.filter.safeParse(input);
    }

    it('accepts a valid progress.<uuid>.status filter', () => {
      const result = parseDynamic('progress.ae557e88-582d-55fe-b41d-ba826adce70e.status:eq:completed');
      expect(result).toHaveLength(1);
      expect(result[0]!.field).toBe('progress.ae557e88-582d-55fe-b41d-ba826adce70e.status');
      expect(result[0]!.operator).toBe('eq');
      expect(result[0]!.value).toBe('completed');
    });

    it('accepts progress.<uuid>.status with in operator', () => {
      const result = parseDynamic('progress.ae557e88-582d-55fe-b41d-ba826adce70e.status:in:completed,started');
      expect(result[0]!.value).toBe('completed,started');
    });

    it('rejects invalid UUID format in dynamic field', () => {
      const result = parseDynamicSafe('progress.not-a-uuid.status:eq:completed');
      expect(result.success).toBe(false);
    });

    it('rejects dynamic field with missing .status suffix', () => {
      const result = parseDynamicSafe('progress.ae557e88-582d-55fe-b41d-ba826adce70e:eq:completed');
      expect(result.success).toBe(false);
    });

    it('still accepts static fields alongside dynamic ones', () => {
      const result = parseDynamic([
        'user.grade:eq:3',
        'progress.ae557e88-582d-55fe-b41d-ba826adce70e.status:eq:completed',
      ]);
      expect(result).toHaveLength(2);
      expect(result[0]!.field).toBe('user.grade');
      expect(result[1]!.field).toBe('progress.ae557e88-582d-55fe-b41d-ba826adce70e.status');
    });

    it('still rejects unknown fields that match neither static nor dynamic', () => {
      const result = parseDynamicSafe('totally.bogus:eq:value');
      expect(result.success).toBe(false);
    });
  });
});
