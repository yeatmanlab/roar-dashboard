import { type SQL, sql, and, eq, ne, inArray, gte, lte, ilike } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';
import type { ParsedFilter } from '@roar-dashboard/api-contract';
import { StatusCodes } from 'http-status-codes';
import { ApiError } from '../errors/api-error';
import { ApiErrorCode } from '../enums/api-error-code.enum';
import { getGradesInRange } from './get-grade-as-number.util';

/**
 * Mapping of allowed filter fields to their Drizzle column references.
 * Each endpoint defines its own field map.
 */
export type FilterFieldMap = Record<string, PgColumn>;

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
      throw new ApiError(`Unknown filter field: "${filter.field}"`, {
        statusCode: StatusCodes.BAD_REQUEST,
        code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
        context: { field: filter.field, allowedFields: Object.keys(allowedFields) },
      });
    }

    const isGradeAware = options?.gradeAwareFields?.has(filter.field) ?? false;
    const condition = buildOperatorCondition(column, filter.operator, filter.value, isGradeAware);
    conditions.push(condition);
  }

  if (conditions.length === 0) return undefined;
  if (conditions.length === 1) return conditions[0]!;

  return and(...conditions);
}

/**
 * Builds a single Drizzle SQL condition for one filter expression.
 *
 * @param column - The Drizzle column to filter on
 * @param operator - The filter operator
 * @param value - The filter value (string from query params)
 * @param gradeAware - Whether to use grade-aware numeric ordering for gte/lte
 * @returns A Drizzle SQL condition
 */
function buildOperatorCondition(
  column: PgColumn,
  operator: ParsedFilter['operator'],
  value: string,
  gradeAware: boolean,
): SQL {
  switch (operator) {
    case 'eq':
      return eq(column, value);
    case 'neq':
      return ne(column, value);
    case 'in': {
      const values = value
        .split(',')
        .map((v) => v.trim())
        .filter((v) => v.length > 0);
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
      // Escape SQL pattern characters so user input is treated as literal text.
      // Backslash must be escaped first to avoid double-escaping the \ from % and _ replacements.
      const escaped = value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
      return ilike(column, `%${escaped}%`);
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
    throw new ApiError(
      `Cannot use "${operator}" on grade with value "${value}" — it has no numeric mapping. Use "eq" or "in" instead.`,
      {
        statusCode: StatusCodes.BAD_REQUEST,
        code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
        context: { operator, value },
      },
    );
  }
  if (matchingGrades.length === 0) {
    // No grades match — return a condition that's always false
    return sql`false`;
  }
  return inArray(column, matchingGrades);
}
