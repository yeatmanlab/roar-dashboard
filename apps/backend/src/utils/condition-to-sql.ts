import { type SQL, sql, and, or, eq, ne, gt, gte, lt, lte, inArray } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';
import type { Condition, FieldCondition, CompositeCondition } from '../services/task/task.types';
import { Operator } from '../services/task/task.types';
import { getGradesInRange } from './get-grade-as-number.util';

/**
 * Maps condition field paths (e.g., 'studentData.grade') to Drizzle column references.
 * Each consumer defines its own field map based on the tables available in its query.
 */
export type ConditionFieldMap = Record<string, PgColumn>;

/**
 * Set of field paths that use grade-aware numeric ordering for range operators.
 * When a grade field is compared with LESS_THAN, GREATER_THAN, etc., the comparison
 * is expanded into an IN clause using getGradesInRange() for correct numeric ordering
 * (e.g., Kindergarten < 1 < 2 < ... < 12 < PostGraduate).
 */
const GRADE_FIELD_PATHS = new Set(['studentData.grade']);

/**
 * Translates a JSONB Condition tree into a Drizzle SQL expression.
 *
 * Used to push task variant eligibility checks (conditionsAssignment, conditionsRequirements)
 * into SQL WHERE clauses so that assigned/optional status can be determined at the database
 * level without post-query filtering. This keeps pagination correct.
 *
 * @param condition - The JSONB condition to translate. null or true (SelectAllCondition)
 *   means "no restriction" and returns undefined (no WHERE clause added).
 * @param fieldMap - Maps condition field paths to Drizzle columns
 * @returns A Drizzle SQL expression, or undefined if the condition imposes no restriction
 */
export function conditionToSql(condition: Condition | null, fieldMap: ConditionFieldMap): SQL | undefined {
  // null = no condition, true = select all — both mean no restriction
  if (condition === null || condition === true) {
    return undefined;
  }

  if (isFieldCondition(condition)) {
    return fieldConditionToSql(condition, fieldMap);
  }

  if (isCompositeCondition(condition)) {
    return compositeConditionToSql(condition, fieldMap);
  }

  // Unknown condition shape — fail safe by imposing no restriction
  return undefined;
}

/**
 * Translate a FieldCondition into a SQL expression.
 */
function fieldConditionToSql(condition: FieldCondition, fieldMap: ConditionFieldMap): SQL | undefined {
  const column = fieldMap[condition.field];
  if (!column) {
    // Unknown field path — condition can't be evaluated in SQL.
    // Return undefined (no restriction). Note: the JS evaluator returns false for
    // unknown fields, which is MORE restrictive (excludes the student). Returning
    // undefined here is LESS restrictive (includes them). This asymmetry is acceptable
    // because unknown fields in production conditions indicate a data/schema issue,
    // and including too many students is safer than silently excluding them from
    // sort/filter results. The JS evaluator in buildProgressMap handles the definitive
    // assignment/exclusion decision.
    return undefined;
  }

  const isGradeField = GRADE_FIELD_PATHS.has(condition.field);

  // Grade fields with range operators use getGradesInRange for correct numeric ordering
  if (isGradeField && isRangeOperator(condition.op)) {
    return gradeRangeToSql(column, condition.op, condition.value);
  }

  // Standard operator translation
  const value = condition.value;
  switch (condition.op) {
    case Operator.EQUAL:
      return eq(column, value);
    case Operator.NOT_EQUAL:
      return ne(column, value);
    case Operator.LESS_THAN:
      return lt(column, value);
    case Operator.LESS_THAN_OR_EQUAL:
      return lte(column, value);
    case Operator.GREATER_THAN:
      return gt(column, value);
    case Operator.GREATER_THAN_OR_EQUAL:
      return gte(column, value);
    default:
      return undefined;
  }
}

/**
 * Translate a CompositeCondition (AND/OR) into a SQL expression.
 */
function compositeConditionToSql(condition: CompositeCondition, fieldMap: ConditionFieldMap): SQL | undefined {
  const childSqls = condition.conditions
    .map((c) => conditionToSql(c, fieldMap))
    .filter((s): s is SQL => s !== undefined);

  if (childSqls.length === 0) return undefined;
  if (childSqls.length === 1) return childSqls[0];

  return condition.op === 'AND' ? and(...childSqls) : or(...childSqls);
}

/**
 * Translate a grade range comparison into an IN clause using numeric grade ordering.
 */
function gradeRangeToSql(column: PgColumn, op: Operator, value: boolean | number | string | Date): SQL | undefined {
  const gradeValue = String(value);
  const drizzleOp = operatorToGradeRangeOp(op);
  if (!drizzleOp) return undefined;

  const matchingGrades = getGradesInRange(drizzleOp, gradeValue);
  if (matchingGrades === null || matchingGrades.length === 0) {
    // No grades match the range — condition always fails
    return sql`false`;
  }
  return inArray(column, matchingGrades);
}

function isRangeOperator(op: Operator): boolean {
  return (
    op === Operator.LESS_THAN ||
    op === Operator.LESS_THAN_OR_EQUAL ||
    op === Operator.GREATER_THAN ||
    op === Operator.GREATER_THAN_OR_EQUAL
  );
}

function operatorToGradeRangeOp(op: Operator): 'gt' | 'gte' | 'lt' | 'lte' | null {
  switch (op) {
    case Operator.GREATER_THAN:
      return 'gt';
    case Operator.GREATER_THAN_OR_EQUAL:
      return 'gte';
    case Operator.LESS_THAN:
      return 'lt';
    case Operator.LESS_THAN_OR_EQUAL:
      return 'lte';
    default:
      return null;
  }
}

function isFieldCondition(condition: Condition): condition is FieldCondition {
  return typeof condition === 'object' && condition !== null && 'field' in condition;
}

function isCompositeCondition(condition: Condition): condition is CompositeCondition {
  return typeof condition === 'object' && condition !== null && 'conditions' in condition;
}
