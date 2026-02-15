import type { User } from '../../db/schema';
import { Operator, type Condition, type FieldCondition, type CompositeCondition } from './task.types';

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
 * Grade values mapped to numeric values for comparison.
 * Keys are exact matches for the gradeEnum values from db/schema/enums.ts.
 *
 * Numeric mapping matches the reference implementation:
 * - All early childhood grades (infant through kindergarten) map to 0
 * - Grades 1-12 map to their numeric values
 * - Post-secondary grades map to 13
 *
 * Special values (Ungraded, Other) return null via getGradeAsNumber.
 */
const GRADE_MAP: Record<string, number> = {
  // Early childhood - all map to 0 (matching reference)
  InfantToddler: 0,
  Preschool: 0,
  PreKindergarten: 0,
  TransitionalKindergarten: 0,
  Kindergarten: 0,
  // Grades 1-13 (string enum values)
  '1': 1,
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  '10': 10,
  '11': 11,
  '12': 12,
  '13': 13,
  // Post-secondary
  PostGraduate: 13,
};

/**
 * Convert a grade to a numeric value for comparison.
 * Accepts exact gradeEnum values from the database or numeric values.
 *
 * @param grade - Grade enum value (e.g., "Kindergarten", "5") or number
 * @returns Numeric grade value, or null if invalid/unknown (e.g., "Ungraded")
 */
function getGradeAsNumber(grade: string | number | null): number | null {
  if (grade === null) return null;

  // If already a number, just validate and return
  if (typeof grade === 'number') {
    return isNaN(grade) ? null : grade;
  }

  // Direct lookup using exact enum value
  const mapped = GRADE_MAP[grade];
  if (mapped !== undefined) {
    return mapped;
  }

  // Try parsing as number (handles numeric strings not in map)
  const parsed = parseInt(grade, 10);
  return isNaN(parsed) ? null : parsed;
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
   * Check if a user is eligible for a task variant based on its conditions.
   *
   * Both conditionsAssignment (eligibility) and conditionsRequirements (requirements)
   * must pass for the user to be eligible. A null condition is treated as passing
   * (no restriction).
   *
   * @param user - The User entity to check eligibility for
   * @param conditionsAssignment - The assignment/eligibility condition (or null)
   * @param conditionsRequirements - The requirements condition (or null)
   * @returns True if the user is eligible for the task variant
   */
  function isUserEligibleForTaskVariant(
    user: User,
    conditionsAssignment: Condition | null,
    conditionsRequirements: Condition | null,
  ): boolean {
    const userData = mapUserToConditionData(user) as unknown as Record<string, unknown>;

    // Null conditions are treated as passing (no restriction)
    const passesAssignment = !conditionsAssignment || evaluateCondition(userData, conditionsAssignment);
    const passesRequirements = !conditionsRequirements || evaluateCondition(userData, conditionsRequirements);

    return passesAssignment && passesRequirements;
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

  return { evaluateCondition, mapUserToConditionData, isUserEligibleForTaskVariant, evaluateConditionForUser };
}
