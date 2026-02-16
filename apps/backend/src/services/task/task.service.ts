import type { User } from '../../db/schema';
import { getGradeAsNumber } from '../../utils/get-grade-as-number.util';
import { Operator, type Condition, type FieldCondition, type CompositeCondition } from './task.types';

/**
 * Result of evaluating a user's eligibility for a task variant.
 */
export interface TaskVariantEligibilityResult {
  /** True if the user is assigned/eligible for this task variant */
  isAssigned: boolean;
  /** True if the task variant is optional for this user (only meaningful if isAssigned is true) */
  isOptional: boolean;
}

/**
 * Data structure expected by condition evaluation.
 * Maps user fields into the structure that conditions reference.
 */
export interface ConditionUserData {
  studentData: {
    grade: number | null;
    statusEll: string | null;
    statusIep: string | null;
    statusFrl: string | null;
    dob: string | null;
    gender: string | null;
    race: string | null;
    hispanicEthnicity: boolean | null;
    homeLanguage: string | null;
  };
}

/**
 * Get a nested value from an object using dot notation.
 *
 * @param obj - The object to traverse
 * @param path - Dot-notation path (e.g., "studentData.grade")
 * @returns The value at the path, or undefined if not found
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Type guard for FieldCondition.
 */
function isFieldCondition(condition: Condition): condition is FieldCondition {
  return (
    typeof condition === 'object' &&
    condition !== null &&
    'field' in condition &&
    'op' in condition &&
    'value' in condition
  );
}

/**
 * Type guard for CompositeCondition.
 */
function isCompositeCondition(condition: Condition): condition is CompositeCondition {
  return (
    typeof condition === 'object' &&
    condition !== null &&
    'op' in condition &&
    'conditions' in condition &&
    (condition.op === 'AND' || condition.op === 'OR')
  );
}

/**
 * Evaluate a field condition against user data.
 *
 * @param userData - The user data to evaluate against
 * @param condition - The field condition to evaluate
 * @returns True if the condition passes, false otherwise
 */
function evaluateFieldCondition(userData: Record<string, unknown>, condition: FieldCondition): boolean {
  const actualValue = getNestedValue(userData, condition.field);
  const expectedValue = condition.value;

  // If the field doesn't exist or is null/undefined, the condition fails
  if (actualValue === undefined || actualValue === null) {
    return false;
  }

  // Handle grade comparisons specially (convert both values to numbers)
  // Reference implementation converts both fieldValue and referenceValue through getGrade
  if (condition.field === 'studentData.grade' || condition.field.endsWith('.grade')) {
    const actualGrade = getGradeAsNumber(actualValue as string | number | null);
    const expectedGrade = getGradeAsNumber(expectedValue as string | number | null);

    if (actualGrade === null || expectedGrade === null) {
      return false;
    }

    return compareValues(actualGrade, expectedGrade, condition.op);
  }

  if (typeof expectedValue === 'boolean') {
    // Handle boolean comparisons
    return compareValues(Boolean(actualValue), expectedValue, condition.op);
  }

  if (expectedValue instanceof Date) {
    // Handle date comparisons
    const actualDate = actualValue instanceof Date ? actualValue : new Date(String(actualValue));
    if (isNaN(actualDate.getTime())) {
      return false;
    }
    return compareValues(actualDate.getTime(), expectedValue.getTime(), condition.op);
  }

  if (typeof expectedValue === 'number') {
    // Handle numeric comparisons
    const actualNum = typeof actualValue === 'number' ? actualValue : parseFloat(String(actualValue));
    if (isNaN(actualNum)) {
      return false;
    }
    return compareValues(actualNum, expectedValue, condition.op);
  }

  // Handle string comparisons
  return compareValues(String(actualValue), String(expectedValue), condition.op);
}

/**
 * Compare two values using the specified operator.
 *
 * @param actual - The actual value
 * @param expected - The expected value
 * @param op - The comparison operator
 * @returns True if the comparison passes
 */
function compareValues<T extends number | string | boolean>(actual: T, expected: T, op: Operator): boolean {
  switch (op) {
    case Operator.EQUAL:
      return actual === expected;
    case Operator.NOT_EQUAL:
      return actual !== expected;
    case Operator.LESS_THAN:
      return actual < expected;
    case Operator.GREATER_THAN:
      return actual > expected;
    case Operator.LESS_THAN_OR_EQUAL:
      return actual <= expected;
    case Operator.GREATER_THAN_OR_EQUAL:
      return actual >= expected;
    default:
      return false;
  }
}

/**
 * TaskService
 *
 * Provides task-related business logic operations including condition evaluation
 * for determining user eligibility for task variants.
 *
 * @returns TaskService - An object with task service methods.
 */
export function TaskService() {
  /**
   * Evaluate a condition against user data.
   *
   * Supports three condition types:
   * - SelectAllCondition (true): Always returns true
   * - FieldCondition: Compares a field value against a target
   * - CompositeCondition: Combines conditions with AND/OR logic
   *
   * @param userData - The user data to evaluate against
   * @param condition - The condition to evaluate
   * @returns True if the condition passes, false otherwise
   */
  function evaluateCondition(userData: Record<string, unknown>, condition: Condition): boolean {
    // SelectAllCondition (true) always passes
    if (condition === true) {
      return true;
    }

    // FieldCondition
    if (isFieldCondition(condition)) {
      return evaluateFieldCondition(userData, condition);
    }

    // CompositeCondition
    if (isCompositeCondition(condition)) {
      if (condition.op === 'AND') {
        return condition.conditions.every((c) => evaluateCondition(userData, c));
      }
      if (condition.op === 'OR') {
        return condition.conditions.some((c) => evaluateCondition(userData, c));
      }
    }

    // Unknown condition type - fail safe
    return false;
  }

  /**
   * Map a User entity to the condition data structure expected by conditions.
   *
   * Conditions reference fields like "studentData.grade", "studentData.statusEll", etc.
   * This function transforms the flat User entity into the nested structure.
   *
   * @param user - The User entity from the database
   * @returns The user data in the format expected by condition evaluation
   */
  function mapUserToConditionData(user: User): ConditionUserData {
    return {
      studentData: {
        grade: getGradeAsNumber(user.grade),
        statusEll: user.statusEll,
        statusIep: user.statusIep,
        statusFrl: user.statusFrl,
        dob: user.dob,
        gender: user.gender,
        race: user.race,
        hispanicEthnicity: user.hispanicEthnicity,
        homeLanguage: user.homeLanguage,
      },
    };
  }

  /**
   * Evaluate a user's eligibility and optionality for a task variant.
   *
   * This method correctly interprets the two condition types:
   * - `conditionsAssignment` (assigned_if): Determines if the task variant is VISIBLE/assigned to the user.
   *   A null value means the variant is assigned to all users.
   * - `conditionsRequirements` (optional_if): Determines if an assigned variant is OPTIONAL for the user.
   *   A null value means the variant is required for all assigned users.
   *
   * @param user - The User entity to evaluate
   * @param conditionsAssignment - assigned_if condition (null = assigned to all)
   * @param conditionsRequirements - optional_if condition (null = required for all)
   * @returns Object with isAssigned and isOptional flags
   */
  function evaluateTaskVariantEligibility(
    user: User,
    conditionsAssignment: Condition | null,
    conditionsRequirements: Condition | null,
  ): TaskVariantEligibilityResult {
    // assigned_if: determines if user is assigned this variant
    const isAssigned = evaluateConditionForUser(user, conditionsAssignment);

    if (!isAssigned) {
      return { isAssigned: false, isOptional: false };
    }

    // optional_if: if null, required; if condition passes, optional
    const isOptional = conditionsRequirements === null ? false : evaluateConditionForUser(user, conditionsRequirements);

    return { isAssigned, isOptional };
  }

  /**
   * Evaluate a condition for a user.
   *
   * Convenience method that maps user data and evaluates the condition.
   * A null condition is treated as passing (no restriction).
   *
   * @param user - The User entity to evaluate for
   * @param condition - The condition to evaluate (or null)
   * @returns True if the condition passes (or is null), false otherwise
   */
  function evaluateConditionForUser(user: User, condition: Condition | null): boolean {
    if (!condition) {
      return true;
    }

    const userData = mapUserToConditionData(user) as unknown as Record<string, unknown>;
    return evaluateCondition(userData, condition);
  }

  return { evaluateTaskVariantEligibility };
}
