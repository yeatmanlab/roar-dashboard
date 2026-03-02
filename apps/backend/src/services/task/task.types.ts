/**
 * Operators supported for field condition comparisons.
 */
export enum Operator {
  LESS_THAN = 'LESS_THAN',
  GREATER_THAN = 'GREATER_THAN',
  LESS_THAN_OR_EQUAL = 'LESS_THAN_OR_EQUAL',
  GREATER_THAN_OR_EQUAL = 'GREATER_THAN_OR_EQUAL',
  EQUAL = 'EQUAL',
  NOT_EQUAL = 'NOT_EQUAL',
}

/**
 * A condition that compares a field value against a target value using an operator.
 *
 * The `field` property uses dot notation to reference nested fields in user data.
 * Example: "studentData.grade" references userData.studentData.grade
 */
export interface FieldCondition {
  field: string;
  op: Operator;
  value: boolean | number | string | Date;
}

/**
 * A condition that combines multiple conditions using AND or OR logic.
 */
export interface CompositeCondition {
  op: 'AND' | 'OR';
  conditions: Condition[];
}

/**
 * A condition that always evaluates to true (matches all users).
 */
export type SelectAllCondition = true;

/**
 * A condition used for filtering users based on their data.
 * Can be a field comparison, a composite (AND/OR) condition, or a "select all" condition.
 */
export type Condition = FieldCondition | CompositeCondition | SelectAllCondition;
