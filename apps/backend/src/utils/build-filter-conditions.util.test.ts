import { describe, it, expect } from 'vitest';
import { StatusCodes } from 'http-status-codes';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { FilterFieldMap } from './build-filter-conditions.util';
import { assertFiltersSupported, buildFilterConditions } from './build-filter-conditions.util';
import { ApiErrorCode } from '../enums/api-error-code.enum';
import type { ParsedFilter } from '../types/filter';
import { users } from '../db/schema';

// Use real Drizzle columns for the field map — the guards read the column's Postgres
// type, so the enum (grade), uuid (id), and text (nameFirst) cases must be real columns.
const TEST_FIELD_MAP: FilterFieldMap = {
  'user.grade': users.grade,
  'user.firstName': users.nameFirst,
  'user.id': users.id,
};

const VALID_UUID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

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
    const filters: ParsedFilter[] = [{ field: 'user.grade', operator: 'in', value: '3,,4' }];
    const result = buildFilterConditions(filters, TEST_FIELD_MAP)!;
    // Should have 2 params (3, 4) — empty string between commas is filtered
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
    expect(() => buildFilterConditions(filters, TEST_FIELD_MAP)).toThrow(
      expect.objectContaining({
        statusCode: StatusCodes.BAD_REQUEST,
        code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
        // The rejected field name stays in context, not in the client-facing message.
        context: expect.objectContaining({ field: 'unknown.field' }),
      }),
    );
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
    const filters: ParsedFilter[] = [{ field: 'user.grade', operator: 'neq', value: 'Kindergarten' }];
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
        expect.objectContaining({
          statusCode: StatusCodes.BAD_REQUEST,
          code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
          context: expect.objectContaining({ value: 'Ungraded' }),
        }),
      );
    });

    it('returns false condition when grade range is empty', () => {
      // '14' parses as numeric 14, but nothing in GRADE_MAP has value >= 14
      const filters: ParsedFilter[] = [{ field: 'user.grade', operator: 'gte', value: '14' }];
      const result = buildFilterConditions(filters, TEST_FIELD_MAP, gradeAwareOptions)!;
      expect(toSql(result)).toContain('false');
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

  describe('column type guards', () => {
    // Without these, the expression reaches Postgres as a type error and the request
    // fails with DATABASE_QUERY_FAILED / 500 instead of a validation 400.

    it('rejects contains on an enum column', () => {
      // '1' is a valid grade, so the value check would pass it — only the operator
      // check can reject this, without the test asserting on which one fired.
      const filters: ParsedFilter[] = [{ field: 'user.grade', operator: 'contains', value: '1' }];
      expect(() => buildFilterConditions(filters, TEST_FIELD_MAP)).toThrow(
        expect.objectContaining({
          statusCode: StatusCodes.BAD_REQUEST,
          code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
        }),
      );
    });

    it('rejects contains on a uuid column', () => {
      // A well-formed uuid, so again only the operator check can reject it.
      const filters: ParsedFilter[] = [{ field: 'user.id', operator: 'contains', value: VALID_UUID }];
      expect(() => buildFilterConditions(filters, TEST_FIELD_MAP)).toThrow(
        expect.objectContaining({
          statusCode: StatusCodes.BAD_REQUEST,
          code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
        }),
      );
    });

    it('allows contains on a text column', () => {
      const filters: ParsedFilter[] = [{ field: 'user.firstName', operator: 'contains', value: 'Jan' }];
      expect(toSql(buildFilterConditions(filters, TEST_FIELD_MAP)!)).toContain('ilike');
    });

    it('rejects a value outside the enum', () => {
      const filters: ParsedFilter[] = [{ field: 'user.grade', operator: 'eq', value: 'K2' }];
      expect(() => buildFilterConditions(filters, TEST_FIELD_MAP)).toThrow(
        expect.objectContaining({
          statusCode: StatusCodes.BAD_REQUEST,
          code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
          // invalidValues is populated only by the value check.
          context: expect.objectContaining({ invalidValues: ['K2'] }),
        }),
      );
    });

    it('rejects a single invalid member of an in list', () => {
      const filters: ParsedFilter[] = [{ field: 'user.grade', operator: 'in', value: '3,K2,4' }];
      expect(() => buildFilterConditions(filters, TEST_FIELD_MAP)).toThrow(
        expect.objectContaining({
          statusCode: StatusCodes.BAD_REQUEST,
          code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
          // invalidValues is populated only by the value check.
          context: expect.objectContaining({ invalidValues: ['K2'] }),
        }),
      );
    });

    it('rejects a malformed uuid value', () => {
      const filters: ParsedFilter[] = [{ field: 'user.id', operator: 'eq', value: 'not-a-uuid' }];
      expect(() => buildFilterConditions(filters, TEST_FIELD_MAP)).toThrow(
        expect.objectContaining({
          statusCode: StatusCodes.BAD_REQUEST,
          code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
          // invalidValues is populated only by the value check.
          context: expect.objectContaining({ invalidValues: ['not-a-uuid'] }),
        }),
      );
    });

    it('allows a well-formed uuid value', () => {
      const filters: ParsedFilter[] = [{ field: 'user.id', operator: 'eq', value: VALID_UUID }];
      expect(toSql(buildFilterConditions(filters, TEST_FIELD_MAP)!)).toContain('= $1');
    });

    it('does not value-check the reference grade of a grade-aware range', () => {
      // '14' is numerically valid but not an enum member. It is a comparison reference
      // expanded by buildGradeRangeCondition, not a value cast to the column.
      const filters: ParsedFilter[] = [{ field: 'user.grade', operator: 'gte', value: '14' }];
      const result = buildFilterConditions(filters, TEST_FIELD_MAP, {
        gradeAwareFields: new Set(['user.grade']),
      })!;
      expect(toSql(result)).toContain('false');
    });

    it('still value-checks a non-grade-aware range on an enum column', () => {
      const filters: ParsedFilter[] = [{ field: 'user.grade', operator: 'gte', value: '14' }];
      expect(() => buildFilterConditions(filters, TEST_FIELD_MAP)).toThrow(
        expect.objectContaining({
          statusCode: StatusCodes.BAD_REQUEST,
          code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
          context: expect.objectContaining({ invalidValues: ['14'] }),
        }),
      );
    });
  });
});

describe('assertFiltersSupported', () => {
  const gradeAwareOptions = { gradeAwareFields: new Set(['user.grade']) };

  /**
   * The point of this entry point is that it cannot drift from the SQL path, so the tests assert
   * agreement rather than restating the rules. Anything `buildFilterConditions` rejects must be
   * rejected here, and anything it accepts must be accepted here.
   */
  const CASES: ReadonlyArray<{ label: string; filter: ParsedFilter }> = [
    { label: 'contains on an enum column', filter: { field: 'user.grade', operator: 'contains', value: '1' } },
    { label: 'eq outside the enum', filter: { field: 'user.grade', operator: 'eq', value: 'K2' } },
    { label: 'neq outside the enum', filter: { field: 'user.grade', operator: 'neq', value: 'K2' } },
    { label: 'in with one bad member', filter: { field: 'user.grade', operator: 'in', value: '3,K2' } },
    { label: 'eq on a malformed uuid', filter: { field: 'user.id', operator: 'eq', value: 'not-a-uuid' } },
    { label: 'an unknown field', filter: { field: 'user.nope', operator: 'eq', value: '3' } },
    { label: 'eq inside the enum', filter: { field: 'user.grade', operator: 'eq', value: '3' } },
    { label: 'in with all good members', filter: { field: 'user.grade', operator: 'in', value: '3,4' } },
    { label: 'contains on a text column', filter: { field: 'user.firstName', operator: 'contains', value: 'ab' } },
    { label: 'grade-aware gte outside the enum', filter: { field: 'user.grade', operator: 'gte', value: '14' } },
    { label: 'eq on a valid uuid', filter: { field: 'user.id', operator: 'eq', value: VALID_UUID } },
  ];

  it.each(CASES)('agrees with buildFilterConditions on $label', ({ filter }) => {
    const sqlThrew = (() => {
      try {
        buildFilterConditions([filter], TEST_FIELD_MAP, gradeAwareOptions);
        return false;
      } catch {
        return true;
      }
    })();

    const assertThrew = (() => {
      try {
        assertFiltersSupported([filter], TEST_FIELD_MAP, gradeAwareOptions);
        return false;
      } catch {
        return true;
      }
    })();

    expect(assertThrew).toBe(sqlThrew);
  });

  it('throws the same 400 shape the SQL path throws', () => {
    // Parity of outcome is not enough — the facets endpoint surfaces this error to the client,
    // so the status and code have to match too.
    const filter: ParsedFilter = { field: 'user.grade', operator: 'contains', value: '1' };

    expect(() => assertFiltersSupported([filter], TEST_FIELD_MAP, gradeAwareOptions)).toThrowError(
      expect.objectContaining({
        statusCode: StatusCodes.BAD_REQUEST,
        code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
      }),
    );
  });

  it('accepts an empty filter list', () => {
    expect(() => assertFiltersSupported([], TEST_FIELD_MAP)).not.toThrow();
  });

  it('validates every filter, not just the first', () => {
    const filters: ParsedFilter[] = [
      { field: 'user.grade', operator: 'eq', value: '3' },
      { field: 'user.grade', operator: 'eq', value: 'K2' },
    ];

    expect(() => assertFiltersSupported(filters, TEST_FIELD_MAP, gradeAwareOptions)).toThrow();
  });
});
