import { describe, it, expect } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import { buildFilterConditions, type FilterFieldMap } from './report-filter-parser';
import type { ParsedFilter } from '@roar-dashboard/api-contract';
import { users } from '../db/schema';

// Use real Drizzle columns for the field map
const TEST_FIELD_MAP: FilterFieldMap = {
  'user.grade': users.grade,
  'user.firstName': users.nameFirst,
};

/** Renders a Drizzle SQL object to a parameterized SQL string for assertion. */
const dialect = new PgDialect();
function toSql(condition: NonNullable<ReturnType<typeof buildFilterConditions>>): string {
  return dialect.sqlToQuery(condition).sql;
}

describe('buildFilterConditions', () => {
  it('returns undefined for empty filters', () => {
    const result = buildFilterConditions([], TEST_FIELD_MAP);
    expect(result).toBeUndefined();
  });

  it('produces an equality condition for eq operator', () => {
    const filters: ParsedFilter[] = [{ field: 'user.grade', operator: 'eq', value: '3' }];
    const result = buildFilterConditions(filters, TEST_FIELD_MAP)!;
    expect(toSql(result)).toContain('= $1');
  });

  it('produces an IN condition for in operator', () => {
    const filters: ParsedFilter[] = [{ field: 'user.grade', operator: 'in', value: '3,4,5' }];
    const result = buildFilterConditions(filters, TEST_FIELD_MAP)!;
    expect(toSql(result)).toContain('in ($1, $2, $3)');
  });

  it('filters empty strings from in operator values', () => {
    const filters: ParsedFilter[] = [{ field: 'user.grade', operator: 'in', value: 'a,,b' }];
    const result = buildFilterConditions(filters, TEST_FIELD_MAP)!;
    // Should have 2 params (a, b) — empty string between commas is filtered
    expect(toSql(result)).toContain('in ($1, $2)');
  });

  it('returns false condition when all in values are empty', () => {
    const filters: ParsedFilter[] = [{ field: 'user.grade', operator: 'in', value: ',,,' }];
    const result = buildFilterConditions(filters, TEST_FIELD_MAP)!;
    expect(toSql(result)).toContain('false');
  });

  it('produces an ILIKE condition for contains operator', () => {
    const filters: ParsedFilter[] = [{ field: 'user.firstName', operator: 'contains', value: 'Jan' }];
    const result = buildFilterConditions(filters, TEST_FIELD_MAP)!;
    expect(toSql(result)).toContain('ilike');
  });

  it('escapes SQL wildcard characters in contains filter values', () => {
    const filters: ParsedFilter[] = [{ field: 'user.firstName', operator: 'contains', value: '100%_match' }];
    const result = buildFilterConditions(filters, TEST_FIELD_MAP)!;
    const { sql: sqlStr, params } = dialect.sqlToQuery(result);
    expect(sqlStr).toContain('ilike');
    // The parameter should contain escaped wildcards
    const likeParam = params.find((p) => typeof p === 'string' && p.includes('\\%'));
    expect(likeParam).toBeDefined();
  });

  it('escapes literal backslashes in contains filter values', () => {
    const filters: ParsedFilter[] = [{ field: 'user.firstName', operator: 'contains', value: 'foo\\%bar' }];
    const result = buildFilterConditions(filters, TEST_FIELD_MAP)!;
    const { params } = dialect.sqlToQuery(result);
    // The backslash should be escaped to \\\\ and the % to \\%
    const likeParam = params.find((p) => typeof p === 'string' && p.includes('\\\\'));
    expect(likeParam).toBeDefined();
  });

  it('ANDs multiple filters together', () => {
    const filters: ParsedFilter[] = [
      { field: 'user.grade', operator: 'eq', value: '3' },
      { field: 'user.firstName', operator: 'contains', value: 'Jan' },
    ];
    const result = buildFilterConditions(filters, TEST_FIELD_MAP)!;
    const sqlStr = toSql(result);
    expect(sqlStr).toContain(' and ');
  });

  it('throws ApiError for unknown filter field', () => {
    const filters: ParsedFilter[] = [{ field: 'unknown.field', operator: 'eq', value: 'test' }];
    expect(() => buildFilterConditions(filters, TEST_FIELD_MAP)).toThrow('Unknown filter field: "unknown.field"');
  });

  it('produces a >= condition for gte operator', () => {
    const filters: ParsedFilter[] = [{ field: 'user.grade', operator: 'gte', value: '3' }];
    const result = buildFilterConditions(filters, TEST_FIELD_MAP)!;
    expect(toSql(result)).toContain('>= $1');
  });

  it('produces a <= condition for lte operator', () => {
    const filters: ParsedFilter[] = [{ field: 'user.grade', operator: 'lte', value: '5' }];
    const result = buildFilterConditions(filters, TEST_FIELD_MAP)!;
    expect(toSql(result)).toContain('<= $1');
  });

  it('produces a <> condition for neq operator', () => {
    const filters: ParsedFilter[] = [{ field: 'user.grade', operator: 'neq', value: 'K' }];
    const result = buildFilterConditions(filters, TEST_FIELD_MAP)!;
    expect(toSql(result)).toContain('<> $1');
  });

  describe('grade-aware gte/lte', () => {
    const gradeAwareOptions = { gradeAwareFields: new Set(['user.grade']) };

    it('converts gte on grade field to an IN condition instead of >=', () => {
      const filters: ParsedFilter[] = [{ field: 'user.grade', operator: 'gte', value: '10' }];
      const result = buildFilterConditions(filters, TEST_FIELD_MAP, gradeAwareOptions)!;
      const sqlStr = toSql(result);
      expect(sqlStr).toContain('in (');
      expect(sqlStr).not.toContain('>=');
    });

    it('converts lte on grade field to an IN condition instead of <=', () => {
      const filters: ParsedFilter[] = [{ field: 'user.grade', operator: 'lte', value: '3' }];
      const result = buildFilterConditions(filters, TEST_FIELD_MAP, gradeAwareOptions)!;
      const sqlStr = toSql(result);
      expect(sqlStr).toContain('in (');
      expect(sqlStr).not.toContain('<=');
    });

    it('accepts named grade values like Kindergarten', () => {
      const filters: ParsedFilter[] = [{ field: 'user.grade', operator: 'lte', value: 'Kindergarten' }];
      const result = buildFilterConditions(filters, TEST_FIELD_MAP, gradeAwareOptions)!;
      expect(toSql(result)).toContain('in (');
    });

    it('throws for grade values with no numeric mapping', () => {
      const filters: ParsedFilter[] = [{ field: 'user.grade', operator: 'gte', value: 'Ungraded' }];
      expect(() => buildFilterConditions(filters, TEST_FIELD_MAP, gradeAwareOptions)).toThrow(
        'Cannot use "gte" on grade with value "Ungraded"',
      );
    });

    it('uses >= for gte on non-grade-aware fields', () => {
      const filters: ParsedFilter[] = [{ field: 'user.firstName', operator: 'gte', value: 'M' }];
      const result = buildFilterConditions(filters, TEST_FIELD_MAP, gradeAwareOptions)!;
      const sqlStr = toSql(result);
      expect(sqlStr).toContain('>= $1');
      expect(sqlStr).not.toContain('in (');
    });

    it('uses >= when gradeAwareFields is not provided', () => {
      const filters: ParsedFilter[] = [{ field: 'user.grade', operator: 'gte', value: '3' }];
      const result = buildFilterConditions(filters, TEST_FIELD_MAP)!;
      expect(toSql(result)).toContain('>= $1');
    });
  });
});
