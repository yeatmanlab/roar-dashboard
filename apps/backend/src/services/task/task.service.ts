import type { NewTaskVariant, NewTaskVariantParameter, User } from '../../db/schema';
import type { TaskVariantStatus } from '../../enums/task-variant-status.enum';
import type { AuthContext } from '../../types/auth-context';
import { StatusCodes } from 'http-status-codes';
import { logger } from '../../logger';
import { TaskVariantRepository } from '../../repositories/task-variant.repository';
import { TaskVariantParameterRepository } from '../../repositories/task-variant-parameter.repository';
import { TaskRepository } from '../../repositories/task.repository';
import { ApiError } from '../../errors/api-error';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { ApiErrorMessage } from '../../enums/api-error-message.enum';
import { isUniqueViolation, unwrapDrizzleError } from '../../errors';
import { Operator, type Condition, type FieldCondition, type CompositeCondition } from './task.types';

/**
 * Parameter data for creating task variant parameters.
 * Value is JSONB and can be any JSON-serializable type (string, number, boolean, object, array, null).
 */
export interface CreateTaskVariantParameterData {
  name: string;
  value: unknown;
}

/**
 * Data required to create a new task variant.
 */
export interface CreateTaskVariantData {
  taskId: string;
  name: string;
  description: string;
  status: TaskVariantStatus;
  parameters: CreateTaskVariantParameterData[];
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
 * Grade values mapped to numeric values for comparison.
 * Maps Grade enum values (from gradeEnum in db/schema/enums.ts) to numbers.
 *
 * InfantToddler/Preschool = -2, PreKindergarten = -1, Kindergarten/TK = 0, grades 1-13.
 * Special values (Ungraded, PostGraduate, Other, empty) return null via getGradeAsNumber.
 */
const GRADE_MAP: Record<string, number> = {
  // Grade enum values (exact matches from DB)
  infanttoddler: -2,
  preschool: -2,
  prekindergarten: -1,
  transitionalkindergarten: 0,
  kindergarten: 0,
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
};

/**
 * Convert a grade string to a numeric value for comparison.
 *
 * @param grade - Grade string (e.g., "kindergarten", "5", "12")
 * @returns Numeric grade value, or null if invalid/unknown
 */
function getGradeAsNumber(grade: string | null): number | null {
  if (grade === null) return null;

  const normalized = grade.toLowerCase().trim();
  const mapped = GRADE_MAP[normalized];

  if (mapped !== undefined) {
    return mapped;
  }

  // Try parsing as number for grades like "1st" → "1"
  const parsed = parseInt(normalized, 10);
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

  // Handle grade comparisons specially (convert strings to numbers)
  if (condition.field === 'studentData.grade' || condition.field.endsWith('.grade')) {
    const actualGrade = getGradeAsNumber(String(actualValue));
    const expectedGrade = typeof expectedValue === 'number' ? expectedValue : getGradeAsNumber(String(expectedValue));

    if (actualGrade === null || expectedGrade === null) {
      return false;
    }

    return compareValues(actualGrade, expectedGrade, condition.op);
  }

  // Handle boolean comparisons
  if (typeof expectedValue === 'boolean') {
    return compareValues(Boolean(actualValue), expectedValue, condition.op);
  }

  // Handle date comparisons
  if (expectedValue instanceof Date) {
    const actualDate = actualValue instanceof Date ? actualValue : new Date(String(actualValue));
    if (isNaN(actualDate.getTime())) {
      return false;
    }
    return compareValues(actualDate.getTime(), expectedValue.getTime(), condition.op);
  }

  // Handle numeric comparisons
  if (typeof expectedValue === 'number') {
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
 * Provides task-related business logic operations including tasks, variants, parameters,
 * and condition evaluation for determining user eligibility for task variants.
 * Follows the factory pattern with dependency injection.
 *
 * @param params - Configuration object containing repository instances (optional)
 * @returns TaskService - An object with task service methods.
 */
export function TaskService({
  taskRepository = new TaskRepository(),
  taskVariantRepository = new TaskVariantRepository(),
  taskVariantParameterRepository = new TaskVariantParameterRepository(),
}: {
  taskRepository?: TaskRepository;
  taskVariantRepository?: TaskVariantRepository;
  taskVariantParameterRepository?: TaskVariantParameterRepository;
} = {}) {
  /**
   * Creates a new task variant with its required parameters.
   *
   * Task variants require at least one parameter to be valid. The variant and all its
   * parameters are created atomically within a database transaction - if any operation
   * fails, the entire operation is rolled back to prevent orphaned or incomplete data.
   *
   * This method validates that the parent task exists before creating the variant,
   * ensuring referential integrity.
   *
   * @param authContext - User's auth context (requires super admin privileges)
   * @param data - Task variant data including taskId, name, description, status, and required parameters array
   * @returns The created task variant (without full parameter details)
   * @throws {ApiError} FORBIDDEN if user is not a super admin
   * @throws {ApiError} BAD_REQUEST if parameters array is empty
   * @throws {ApiError} NOT_FOUND if the parent task doesn't exist
   * @throws {ApiError} INTERNAL if variant or any parameter creation fails
   * @throws {ApiError} DATABASE_QUERY_FAILED if an unexpected database error occurs
   *
   * @example
   * ```typescript
   * const variant = await taskService.createTaskVariant(authContext, {
   *   taskId: 'task-uuid',
   *   name: 'easy-mode',
   *   description: 'Easy difficulty configuration',
   *   status: 'published',
   *   parameters: [
   *     { name: 'difficulty', value: 'easy' },
   *     { name: 'timeLimit', value: 120 },
   *     { name: 'hintsEnabled', value: true }
   *   ]
   * });
   * ```
   */
  async function createTaskVariant(authContext: AuthContext, data: CreateTaskVariantData): Promise<{ id: string }> {
    const { userId, isSuperAdmin } = authContext;
    const { taskId, name, status, description } = data;

    if (!isSuperAdmin) {
      throw new ApiError(ApiErrorMessage.FORBIDDEN, {
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
        context: { userId, isSuperAdmin },
      });
    }

    try {
      // Verify the parent task exists
      const task = await taskRepository.getById({ id: data.taskId });

      if (!task) {
        throw new ApiError(ApiErrorMessage.NOT_FOUND, {
          statusCode: StatusCodes.NOT_FOUND,
          code: ApiErrorCode.RESOURCE_NOT_FOUND,
          context: { userId, taskId: data.taskId },
        });
      }

      // Create the task variant and parameters within a transaction to prevent orphaned data
      const variant = await taskVariantRepository.runTransaction({
        fn: async (tx) => {
          const variantData: NewTaskVariant = {
            taskId,
            status,
            name,
            description,
          };

          const newVariant = await taskVariantRepository.create({
            data: variantData,
            transaction: tx,
          });

          if (!newVariant) {
            throw new ApiError('Failed to create task variant', {
              statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
              code: ApiErrorCode.INTERNAL,
              context: { userId, isSuperAdmin, taskId: data.taskId },
            });
          }

          const { id: taskVariantId } = newVariant;

          const taskVariantParameterData: NewTaskVariantParameter[] = data.parameters.map(({ name, value }) => ({
            taskVariantId,
            name,
            value,
          }));

          // Check if any parameters are missing
          if (taskVariantParameterData.length === 0) {
            throw new ApiError('At least one parameter required', {
              statusCode: StatusCodes.BAD_REQUEST,
              code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
              context: { userId, isSuperAdmin, taskId: data.taskId },
            });
          }

          const newTaskVariantParameters = await taskVariantParameterRepository.createMany({
            data: taskVariantParameterData,
            transaction: tx,
          });

          // Verify all parameters were created successfully
          if (newTaskVariantParameters.length !== taskVariantParameterData.length) {
            throw new ApiError('Failed to create all task variant parameters', {
              statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
              code: ApiErrorCode.INTERNAL,
              context: {
                userId,
                isSuperAdmin,
                expected: taskVariantParameterData.length,
                created: newTaskVariantParameters.length,
              },
            });
          }

          return newVariant;
        },
      });

      logger.info(
        { userId, taskId: data.taskId, variantId: variant.id, parameterCount: data.parameters.length },
        'Created task variant with parameters',
      );

      return variant;
    } catch (error) {
      if (error instanceof ApiError) throw error;

      // Unwrap the Drizzle error to get the underlying database error with SQLSTATE codes
      const dbError = unwrapDrizzleError(error);

      // Check for Postgres unique constraint violation
      if (isUniqueViolation(dbError)) {
        throw new ApiError(ApiErrorMessage.CONFLICT, {
          statusCode: StatusCodes.CONFLICT,
          code: ApiErrorCode.RESOURCE_CONFLICT,
          context: { userId, taskId: data.taskId, variantName: data.name },
          cause: error,
        });
      }

      logger.error({ err: error, context: { userId, taskId: data.taskId } }, 'Failed to create task variant');

      throw new ApiError('Failed to create task variant', {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
        context: { userId, taskId: data.taskId },
        cause: error,
      });
    }
  }

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

  return {
    createTaskVariant,
    evaluateCondition,
    mapUserToConditionData,
    isUserEligibleForTaskVariant,
  };
}
