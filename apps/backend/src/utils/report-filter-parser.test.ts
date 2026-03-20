import { describe, it, expect } from 'vitest';
import { buildFilterConditions, type FilterFieldMap } from './report-filter-parser';
import type { ParsedFilter } from '@roar-dashboard/api-contract';
import { users } from '../db/schema';

// Use real Drizzle columns for the field map
const TEST_FIELD_MAP: FilterFieldMap = {
  'user.grade': users.grade,
  'user.firstName': users.nameFirst,
};

describe('buildFilterConditions', () => {
  it('returns undefined for empty filters', () => {
    const result = buildFilterConditions([], TEST_FIELD_MAP);
    expect(result).toBeUndefined();
  });

  it('returns a SQL condition for a single eq filter', () => {
    const filters: ParsedFilter[] = [{ field: 'user.grade', operator: 'eq', value: '3' }];
    const result = buildFilterConditions(filters, TEST_FIELD_MAP);
    expect(result).toBeDefined();
  });

  it('returns a SQL condition for an in filter', () => {
    const filters: ParsedFilter[] = [{ field: 'user.grade', operator: 'in', value: '3,4,5' }];
    const result = buildFilterConditions(filters, TEST_FIELD_MAP);
    expect(result).toBeDefined();
  });

  it('returns a SQL condition for a contains filter', () => {
    const filters: ParsedFilter[] = [{ field: 'user.firstName', operator: 'contains', value: 'Jan' }];
    const result = buildFilterConditions(filters, TEST_FIELD_MAP);
    expect(result).toBeDefined();
  });

  it('escapes SQL wildcard characters in contains filter values', () => {
    const filters: ParsedFilter[] = [{ field: 'user.firstName', operator: 'contains', value: '100%_match' }];
    const result = buildFilterConditions(filters, TEST_FIELD_MAP);
    expect(result).toBeDefined();
    // The SQL should contain escaped wildcards, not raw ones
    const sqlChunks = result!.queryChunks.map((c) => (typeof c === 'string' ? c : String(c)));
    const sqlString = sqlChunks.join('');
    expect(sqlString).toContain('\\%');
    expect(sqlString).toContain('\\_');
  });

  it('ANDs multiple filters together', () => {
    const filters: ParsedFilter[] = [
      { field: 'user.grade', operator: 'eq', value: '3' },
      { field: 'user.firstName', operator: 'contains', value: 'Jan' },
    ];
    const result = buildFilterConditions(filters, TEST_FIELD_MAP);
    expect(result).toBeDefined();
  });

  it('throws ApiError for unknown filter field', () => {
    const filters: ParsedFilter[] = [{ field: 'unknown.field', operator: 'eq', value: 'test' }];
    expect(() => buildFilterConditions(filters, TEST_FIELD_MAP)).toThrow('Unknown filter field: "unknown.field"');
  });

  it('returns a SQL condition for gte operator', () => {
    const filters: ParsedFilter[] = [{ field: 'user.grade', operator: 'gte', value: '3' }];
    const result = buildFilterConditions(filters, TEST_FIELD_MAP);
    expect(result).toBeDefined();
  });

  it('returns a SQL condition for lte operator', () => {
    const filters: ParsedFilter[] = [{ field: 'user.grade', operator: 'lte', value: '5' }];
    const result = buildFilterConditions(filters, TEST_FIELD_MAP);
    expect(result).toBeDefined();
  });

  it('returns a SQL condition for neq operator', () => {
    const filters: ParsedFilter[] = [{ field: 'user.grade', operator: 'neq', value: 'K' }];
    const result = buildFilterConditions(filters, TEST_FIELD_MAP);
    expect(result).toBeDefined();
  });

  describe('grade-aware gte/lte', () => {
    const gradeAwareOptions = { gradeAwareFields: new Set(['user.grade']) };

    it('converts gte on grade field to an inArray condition', () => {
      const filters: ParsedFilter[] = [{ field: 'user.grade', operator: 'gte', value: '10' }];
      const result = buildFilterConditions(filters, TEST_FIELD_MAP, gradeAwareOptions);
      expect(result).toBeDefined();
    });

    it('converts lte on grade field to an inArray condition', () => {
      const filters: ParsedFilter[] = [{ field: 'user.grade', operator: 'lte', value: '3' }];
      const result = buildFilterConditions(filters, TEST_FIELD_MAP, gradeAwareOptions);
      expect(result).toBeDefined();
    });

    it('accepts named grade values like Kindergarten', () => {
      const filters: ParsedFilter[] = [{ field: 'user.grade', operator: 'lte', value: 'Kindergarten' }];
      const result = buildFilterConditions(filters, TEST_FIELD_MAP, gradeAwareOptions);
      expect(result).toBeDefined();
    });

    it('throws for grade values with no numeric mapping', () => {
      const filters: ParsedFilter[] = [{ field: 'user.grade', operator: 'gte', value: 'Ungraded' }];
      expect(() => buildFilterConditions(filters, TEST_FIELD_MAP, gradeAwareOptions)).toThrow(
        'Cannot use "gte" on grade with value "Ungraded"',
      );
    });

    it('uses string comparison for gte/lte on non-grade-aware fields', () => {
      const filters: ParsedFilter[] = [{ field: 'user.firstName', operator: 'gte', value: 'M' }];
      const result = buildFilterConditions(filters, TEST_FIELD_MAP, gradeAwareOptions);
      expect(result).toBeDefined();
    });

    it('uses string comparison when gradeAwareFields is not provided', () => {
      const filters: ParsedFilter[] = [{ field: 'user.grade', operator: 'gte', value: '3' }];
      const result = buildFilterConditions(filters, TEST_FIELD_MAP);
      expect(result).toBeDefined();
    });
  });
});
