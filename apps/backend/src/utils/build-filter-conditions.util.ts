import type { SQL } from 'drizzle-orm';
import { sql, and, eq, ne, inArray, gte, lte, ilike, is } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';
import { PgChar, PgEnumColumn, PgText, PgUUID, PgVarchar } from 'drizzle-orm/pg-core';
import type { ParsedFilter } from '../types/filter';
import { StatusCodes } from 'http-status-codes';
import { ApiError } from '../errors/api-error';
import { ApiErrorCode } from '../enums/api-error-code.enum';
import { ApiErrorMessage } from '../enums/api-error-message.enum';
import { getGradesInRange } from './get-grade-as-number.util';
import { isValidUuid } from './is-valid-uuid.util';
import { escapeLikePattern } from './escape-like-pattern.util';

/**
 * Mapping of allowed filter fields to their Drizzle column references.
 * Each endpoint defines its own field map.
 */
export type FilterFieldMap = Record<string, PgColumn>;

/**
 * Whether ILIKE can be applied to the column. `contains` compiles to ILIKE, which has
 * no operator form against enum, uuid, numeric, or timestamp columns — Postgres raises
 * `operator does not exist` rather than matching nothing.
 *
 * @param column - The Drizzle column to test
 * @returns true if the column is one of Drizzle's text-typed columns
 */
function isTextColumn(column: PgColumn): boolean {
  return is(column, PgText) || is(column, PgVarchar) || is(column, PgChar);
}

/**
 * Options for building filter conditions.
 */
export interface FilterBuildOptions {
  /**
   * Set of field names that use grade-aware comparison for gte/lte operators.
   * For these fields, gte/lte is converted to an IN clause using numeric grade
   * ordering (e.g., `user.grade:gte:3` becomes `IN ('3','4','5',...,'13','PostGraduate')`).
   */
  gradeAwareFields?: ReadonlySet<string>;
}

/**
 * Builds a Drizzle SQL condition from parsed filter expressions.
 * All filters are ANDed together.
 *
 * Field names are validated at the contract level by `createFilterQuerySchema`, so
 * the `allowedFields` lookup here serves as a safety net and maps field names to
 * Drizzle column references for SQL generation.
 *
 * @param filters - Parsed filter expressions from the query string
 * @param allowedFields - Map of field names to Drizzle column references
 * @param options - Optional configuration for field-specific behavior
 * @returns A Drizzle SQL condition, or undefined if no valid filters
 * @throws {ApiError} BAD_REQUEST if a filter field is not in the allowed set
 * @throws {ApiError} BAD_REQUEST if a grade-aware gte/lte filter has an unrecognized grade value
 */
export function buildFilterConditions(
  filters: ParsedFilter[],
  allowedFields: FilterFieldMap,
  options?: FilterBuildOptions,
): SQL | undefined {
  if (filters.length === 0) return undefined;

  const conditions: SQL[] = [];

  for (const filter of filters) {
    const column = allowedFields[filter.field];
    if (!column) {
      throw new ApiError(ApiErrorMessage.REQUEST_VALIDATION_FAILED, {
        statusCode: StatusCodes.BAD_REQUEST,
        code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
        context: {
          field: filter.field,
          allowedFields: Object.keys(allowedFields),
          reason: 'Filter field is not in the allowed set',
        },
      });
    }

    const isGradeAware = options?.gradeAwareFields?.has(filter.field) ?? false;
    const condition = buildOperatorCondition(column, filter.field, filter.operator, filter.value, isGradeAware);
    conditions.push(condition);
  }

  if (conditions.length === 1) return conditions[0]!;

  return and(...conditions);
}

/**
 * Rejects filter expressions the column's Postgres type cannot evaluate.
 *
 * `createFilterQuerySchema` validates a filter's shape, field name, and operator against
 * the contract, but never the value against the column it will be compared to. Without
 * this guard those expressions reach the database as a type error and surface as a 500
 * (`DATABASE_QUERY_FAILED`) — a client typo reported as a server fault.
 *
 * Both checks read the column rather than a per-endpoint declaration, so a newly
 * filterable column is covered without a second list to keep in sync:
 *
 * - `contains` requires a text-typed column, since it compiles to ILIKE.
 * - Enum and uuid columns require a value Postgres can cast.
 *
 * Numeric and timestamp columns are not value-checked — none are currently exposed as
 * filter fields, and `contains`, their only unconditional failure, is rejected above.
 * Add a branch here when the first one is exposed.
 *
 * @param column - The Drizzle column the filter will be compared against
 * @param field - The filter field name, for error context
 * @param operator - The filter operator
 * @param values - The filter values, already split for the `in` operator
 * @param gradeAware - Whether gte/lte will be expanded by `buildGradeRangeCondition`
 * @throws {ApiError} BAD_REQUEST if the column's type cannot evaluate the expression
 */
function assertColumnAcceptsFilter(
  column: PgColumn,
  field: string,
  operator: ParsedFilter['operator'],
  values: string[],
  gradeAware: boolean,
): void {
  if (operator === 'contains' && !isTextColumn(column)) {
    throw new ApiError(ApiErrorMessage.REQUEST_VALIDATION_FAILED, {
      statusCode: StatusCodes.BAD_REQUEST,
      code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
      context: {
        field,
        operator,
        columnType: column.columnType,
        reason: 'The contains operator requires a text column',
      },
    });
  }

  // A grade-aware range compares against a numeric reference point rather than a column
  // value: `buildGradeRangeCondition` expands it into enum members it has already
  // validated, so a numerically-valid grade outside the enum ('14' → empty range) is
  // legitimate input here and is rejected by `getGradesInRange` when it isn't.
  if (gradeAware && (operator === 'gte' || operator === 'lte')) {
    return;
  }

  const invalidValues = is(column, PgEnumColumn)
    ? values.filter((v) => !column.enumValues.includes(v))
    : is(column, PgUUID)
      ? values.filter((v) => !isValidUuid(v))
      : [];

  if (invalidValues.length > 0) {
    throw new ApiError(ApiErrorMessage.REQUEST_VALIDATION_FAILED, {
      statusCode: StatusCodes.BAD_REQUEST,
      code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
      context: {
        field,
        operator,
        columnType: column.columnType,
        invalidValues,
        reason: 'Filter value is not valid for the column type',
      },
    });
  }
}

/**
 * Builds a single Drizzle SQL condition for one filter expression.
 *
 * @param column - The Drizzle column to filter on
 * @param field - The filter field name, for error context
 * @param operator - The filter operator
 * @param value - The filter value (string from query params)
 * @param gradeAware - Whether to use grade-aware numeric ordering for gte/lte
 * @returns A Drizzle SQL condition
 * @throws {ApiError} BAD_REQUEST if the column's type cannot evaluate the expression
 */
function buildOperatorCondition(
  column: PgColumn,
  field: string,
  operator: ParsedFilter['operator'],
  value: string,
  gradeAware: boolean,
): SQL {
  const values =
    operator === 'in'
      ? value
          .split(',')
          .map((v) => v.trim())
          .filter((v) => v.length > 0)
      : [value];

  assertColumnAcceptsFilter(column, field, operator, values, gradeAware);

  switch (operator) {
    case 'eq':
      return eq(column, value);
    case 'neq':
      return ne(column, value);
    case 'in': {
      if (values.length === 0) {
        // All values were empty after filtering — no rows can match
        return sql`false`;
      }
      return inArray(column, values);
    }
    case 'gte':
    case 'lte': {
      if (gradeAware) {
        return buildGradeRangeCondition(column, operator, value);
      }
      // Default: string comparison semantics
      return operator === 'gte' ? gte(column, value) : lte(column, value);
    }
    case 'contains': {
      return ilike(column, `%${escapeLikePattern(value)}%`);
    }
    default:
      throw new Error(`Unsupported filter operator: ${operator satisfies never}`);
  }
}

/**
 * Builds a grade-aware range condition by expanding gte/lte into an IN clause
 * using numeric grade ordering.
 *
 * For example, `user.grade:gte:3` becomes `IN ('3','4','5',...,'13','PostGraduate')`.
 *
 * @throws {ApiError} BAD_REQUEST if the grade value has no numeric mapping
 */
function buildGradeRangeCondition(column: PgColumn, operator: 'gte' | 'lte', value: string): SQL {
  const matchingGrades = getGradesInRange(operator, value);
  if (matchingGrades === null) {
    throw new ApiError(ApiErrorMessage.REQUEST_VALIDATION_FAILED, {
      statusCode: StatusCodes.BAD_REQUEST,
      code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
      context: { operator, value, reason: 'Grade has no numeric ordering to compare against' },
    });
  }
  if (matchingGrades.length === 0) {
    // No grades match — return a condition that's always false
    return sql`false`;
  }
  return inArray(column, matchingGrades);
}
