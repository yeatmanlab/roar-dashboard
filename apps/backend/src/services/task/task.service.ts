import type { NewTaskVariant, NewTaskVariantParameter, Task, TaskVariant, NewTask } from '../../db/schema';
import type { AuthContext } from '../../types/auth-context';
import type { PaginatedResult } from '../../repositories/base.repository';
import type { Condition, FieldCondition, CompositeCondition, ConditionEvaluationUser } from '../../types/condition';
import type { ListTaskVariantsOptions } from '../../repositories/task-variant.repository';
import type { ListTasksOptions } from '../../repositories/task.repository';
import { TaskVariantStatus } from '../../enums/task-variant-status.enum';
import { StatusCodes } from 'http-status-codes';
import { logger } from '../../logger';
import { TaskVariantRepository } from '../../repositories/task-variant.repository';
import { TaskVariantParameterRepository } from '../../repositories/task-variant-parameter.repository';
import { TaskRepository } from '../../repositories/task.repository';
import { ApiError } from '../../errors/api-error';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { ApiErrorMessage } from '../../enums/api-error-message.enum';
import { isUniqueViolation, unwrapDrizzleError } from '../../errors';
import { getGradeAsNumber } from '../../utils/get-grade-as-number.util';
import { isValidUuid } from '../../utils/is-valid-uuid.util';
import { Operator } from '../../types/condition';

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
 *
 * NOTE: taskId is passed separately as a path parameter.
 * NOTE: We union optional fields with 'undefined' to satisfy 'exactOptionalPropertyTypes' type checking.
 */
export interface CreateTaskVariantData {
  name?: string | undefined;
  description?: string | undefined;
  status: TaskVariantStatus;
  parameters: CreateTaskVariantParameterData[];
}

/**
 * Data for updating an existing task variant.
 * All fields are optional - only provided fields will be updated.
 *
 * NOTE: taskId and variantId are passed separately as path parameters.
 * NOTE: We union optional fields with 'null' and 'undefined' to satisfy 'exactOptionalPropertyTypes' type checking.
 */
export interface UpdateTaskVariantData {
  name?: string | null | undefined;
  description?: string | null | undefined;
  status?: TaskVariantStatus | undefined;
  parameters?: CreateTaskVariantParameterData[] | undefined;
}

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
 * Represents a single task variant parameter.
 * Parameters are key-value pairs that configure a task variant.
 */
export type TaskVariantParameter = {
  name: string;
  value: unknown;
};

export type TaskFields = Pick<Task, 'name' | 'slug' | 'image'>;

/**
 * Represents a task variant with its parameters.
 * Used as the return type for variant retrieval operations where parameter context is needed.
 */
export type TaskVariantWithParameters = TaskVariant & {
  parameters: TaskVariantParameter[];
};

/**
 * Data required to create a new task.
 *
 * NOTE: While identical to the request body schema, this interface maintains
 * a clear separation between API contract and service layer implementation.
 */
export interface CreateTaskData {
  slug: string;
  name: string;
  nameSimple: string;
  nameTechnical: string;
  taskConfig: unknown;
  description?: string | null | undefined;
  image?: string | null | undefined;
  tutorialVideo?: string | null | undefined;
}

/**
 * Data structure expected by condition evaluation.
 * Maps user fields into the structure that conditions reference.
 * Grade conversion happens in evaluateFieldCondition, not here.
 */
export interface ConditionUserData {
  studentData: {
    grade: string | null;
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
   * List task variants for a given task.
   * Supports lookup by task ID (UUID) or slug (case-sensitive).
   * Supports filtering by status and pagination.
   *
   * Authorization:
   * - Super admins can filter by any status or see all variants (no status filter)
   * - Regular users can only see published variants (status defaults to 'published')
   *
   * @param authContext - User's authentication context
   * @param taskId - The UUID of the parent task or the task's slug
   * @param options - Pagination, sorting, search, and status filter options
   * @returns Paginated result with task variants and task info
   * @throws {ApiError} NOT_FOUND if the parent task doesn't exist
   * @throws {ApiError} DATABASE_QUERY_FAILED if an unexpected database error occurs
   */
  async function listTaskVariants(
    authContext: AuthContext,
    taskId: string,
    options: ListTaskVariantsOptions,
  ): Promise<PaginatedResult<TaskVariantWithParameters> & { task: TaskFields }> {
    const { userId, isSuperAdmin } = authContext;

    try {
      // Parse taskId: if it's a UUID format, look up by ID; otherwise by slug
      let task: Task | null = null;

      if (isValidUuid(taskId)) {
        task = await taskRepository.getById({ id: taskId });
      } else {
        task = await taskRepository.getBySlug(taskId);
      }

      if (!task) {
        throw new ApiError(ApiErrorMessage.NOT_FOUND, {
          statusCode: StatusCodes.NOT_FOUND,
          code: ApiErrorCode.RESOURCE_NOT_FOUND,
          context: { userId, taskId },
        });
      }

      // Super admins can use any status filter (or none to see all)
      // Non-super admins are restricted to 'published' only
      const status = isSuperAdmin ? options.status : TaskVariantStatus.PUBLISHED;
      const filter = status ? { taskId: task.id, status } : { taskId: task.id };
      const variants = await taskVariantRepository.listByTaskId(filter, options);

      // Fetch all parameters for all variants in a single query
      const variantIds = variants.items.map((v) => v.id);
      const allParams = await taskVariantParameterRepository.getByTaskVariantIds(variantIds);

      // Group parameters by variant ID
      const paramsByVariantId = new Map<string, TaskVariantParameter[]>();
      for (const param of allParams) {
        const existing = paramsByVariantId.get(param.taskVariantId) ?? [];
        existing.push({ name: param.name, value: param.value });
        paramsByVariantId.set(param.taskVariantId, existing);
      }

      // Attach parameters to each variant
      const variantsWithParams = variants.items.map((variant) => ({
        ...variant,
        parameters: paramsByVariantId.get(variant.id) ?? [],
      }));

      return {
        items: variantsWithParams,
        totalItems: variants.totalItems,
        task: { name: task.name, slug: task.slug, image: task.image },
      };
    } catch (error) {
      if (error instanceof ApiError) throw error;

      logger.error({ err: error, context: { userId, taskId } }, 'Failed to list task variants');

      throw new ApiError(ApiErrorMessage.INTERNAL_SERVER_ERROR, {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
        context: { userId, taskId },
        cause: error,
      });
    }
  }

  /**
   * Retrieves a single task variant by its ID.
   * Supports lookup by task ID (UUID) or task slug.
   * Task slugs are case-sensitive.
   *
   * Authorization:
   * - Super admins can retrieve any variant regardless of status
   * - Regular users can only retrieve published variants
   *
   * @param authContext - The user's authentication context
   * @param taskId - The ID of the task; can be a task UUID or a task slug
   * @param variantId - The ID of the task variant
   * @returns The requested task variant with task information
   * @throws {ApiError} NOT_FOUND if task doesn't exist, variant doesn't exist, variant belongs to different task, or variant is unpublished and user is not super admin
   * @throws {ApiError} DATABASE_QUERY_FAILED if an unexpected database error occurs
   */
  async function getTaskVariant(
    authContext: AuthContext,
    taskId: string,
    variantId: string,
  ): Promise<TaskVariantWithParameters & { task: TaskFields }> {
    const { userId, isSuperAdmin } = authContext;

    try {
      // Parse taskId: if it's a UUID format, look up by ID; otherwise by slug
      let task: Task | null = null;

      if (isValidUuid(taskId)) {
        task = await taskRepository.getById({ id: taskId });
      } else {
        task = await taskRepository.getBySlug(taskId);
      }

      if (!task) {
        throw new ApiError(ApiErrorMessage.NOT_FOUND, {
          statusCode: StatusCodes.NOT_FOUND,
          code: ApiErrorCode.RESOURCE_NOT_FOUND,
          context: { userId, taskId },
        });
      }

      // Fetch the variant and verify it belongs to this task
      const variant = await taskVariantRepository.getById({ id: variantId });

      if (!variant) {
        throw new ApiError(ApiErrorMessage.NOT_FOUND, {
          statusCode: StatusCodes.NOT_FOUND,
          code: ApiErrorCode.RESOURCE_NOT_FOUND,
          context: { userId, taskId, variantId },
        });
      }

      // Verify variant belongs to the requested task
      if (variant.taskId !== task.id) {
        throw new ApiError(ApiErrorMessage.NOT_FOUND, {
          statusCode: StatusCodes.NOT_FOUND,
          code: ApiErrorCode.RESOURCE_NOT_FOUND,
          context: { userId, taskId, variantId },
        });
      }

      // Check authorization based on variant status
      // Information disclosure prevention: return 404 for draft or unpublished variants instead of 403
      if (!isSuperAdmin && variant.status !== TaskVariantStatus.PUBLISHED) {
        logger.warn(
          { userId, taskId, variantId, variantStatus: variant.status },
          'Non-super-admin attempted to access unpublished task variant',
        );
        throw new ApiError(ApiErrorMessage.NOT_FOUND, {
          statusCode: StatusCodes.NOT_FOUND,
          code: ApiErrorCode.RESOURCE_NOT_FOUND,
          context: { userId, taskId, variantId },
        });
      }

      // Fetch parameters
      const parameters = await taskVariantParameterRepository.getByTaskVariantId(variantId);
      // Simplify parameters to only include name and value
      const simplifiedParameters = parameters.map(({ name, value }) => ({ name, value }));

      return {
        ...variant,
        parameters: simplifiedParameters,
        task: { name: task.name, slug: task.slug, image: task.image },
      };
    } catch (error) {
      if (error instanceof ApiError) throw error;

      logger.error({ err: error, context: { userId, taskId, variantId } }, 'Failed to fetch task variant');

      throw new ApiError(ApiErrorMessage.INTERNAL_SERVER_ERROR, {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
        context: { userId, taskId, variantId },
      });
    }
  }

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
   * @param taskId - The UUID of the parent task
   * @param body - Task variant data including name, description, status, and required parameters array
   * @returns An object containing the created task variant's UUID
   * @throws {ApiError} FORBIDDEN if user is not a super admin
   * @throws {ApiError} BAD_REQUEST if parameters array is empty
   * @throws {ApiError} NOT_FOUND if the parent task doesn't exist
   * @throws {ApiError} CONFLICT if a variant with the same name already exists for this task
   * @throws {ApiError} INTERNAL if variant or any parameter creation fails
   * @throws {ApiError} DATABASE_QUERY_FAILED if an unexpected database error occurs
   *
   * @example
   * ```typescript
   * const result = await taskService.createTaskVariant(
   *   authContext,
   *   'task-uuid',
   *   {
   *     name: 'easy-mode',
   *     description: 'Easy difficulty configuration',
   *     status: 'published',
   *     parameters: [
   *       { name: 'difficulty', value: 'easy' },
   *       { name: 'timeLimit', value: 120 },
   *       { name: 'hintsEnabled', value: true }
   *     ]
   *   }
   * );
   * console.log(result.id); // 'variant-uuid'
   * ```
   */
  async function createTaskVariant(
    authContext: AuthContext,
    taskId: string,
    body: CreateTaskVariantData,
  ): Promise<{ id: string }> {
    const { userId, isSuperAdmin } = authContext;
    const { name, status, description } = body;

    if (!isSuperAdmin) {
      throw new ApiError(ApiErrorMessage.FORBIDDEN, {
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
        context: { userId, isSuperAdmin },
      });
    }

    try {
      // Verify the parent task exists
      const task = await taskRepository.getById({ id: taskId });

      if (!task) {
        throw new ApiError(ApiErrorMessage.NOT_FOUND, {
          statusCode: StatusCodes.NOT_FOUND,
          code: ApiErrorCode.RESOURCE_NOT_FOUND,
          context: { userId, taskId },
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
              context: { userId, isSuperAdmin, taskId },
            });
          }

          const { id: taskVariantId } = newVariant;

          // Only create parameters if any were provided
          if (body.parameters.length > 0) {
            const taskVariantParameterData: NewTaskVariantParameter[] = body.parameters.map(({ name, value }) => ({
              taskVariantId,
              name,
              value,
            }));

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
          }

          return newVariant;
        },
      });

      logger.info(
        { userId, taskId, variantId: variant.id, parameterCount: body.parameters.length },
        'Created task variant with parameters',
      );

      return { id: variant.id };
    } catch (error) {
      if (error instanceof ApiError) throw error;

      // Unwrap the Drizzle error to get the underlying database error with SQLSTATE codes
      const dbError = unwrapDrizzleError(error);

      // Check for Postgres unique constraint violation
      if (isUniqueViolation(dbError)) {
        throw new ApiError(ApiErrorMessage.CONFLICT, {
          statusCode: StatusCodes.CONFLICT,
          code: ApiErrorCode.RESOURCE_CONFLICT,
          context: { userId, taskId, variantName: body.name },
          cause: error,
        });
      }

      logger.error({ err: error, context: { userId, taskId } }, 'Failed to create task variant');

      throw new ApiError('Failed to create task variant', {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
        context: { userId, taskId },
        cause: error,
      });
    }
  }

  /**
   * Updates an existing task variant.
   *
   * Only super admins can update task variants.
   * All fields in the request are optional - only provided fields will be updated.
   * When parameters are provided, they replace all existing parameters (not merged).
   *
   * @param authContext - User's authentication context
   * @param params - Object containing taskId and variantId path parameters
   * @param body - Fields to update (all optional: name, description, status, parameters)
   * @returns Promise that resolves when update is complete
   * @throws {ApiError} FORBIDDEN if user is not a super admin
   * @throws {ApiError} NOT_FOUND if task or variant doesn't exist, or if variant belongs to different task
   * @throws {ApiError} CONFLICT if name update would create a duplicate
   * @throws {ApiError} DATABASE_QUERY_FAILED if an unexpected database error occurs
   */
  async function updateTaskVariant(
    authContext: AuthContext,
    params: { taskId: string; variantId: string },
    body: UpdateTaskVariantData,
  ): Promise<void> {
    const { userId, isSuperAdmin } = authContext;
    const { taskId, variantId } = params;
    const { name, status, description, parameters } = body;

    if (!isSuperAdmin) {
      throw new ApiError(ApiErrorMessage.FORBIDDEN, {
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
        context: { userId, isSuperAdmin },
      });
    }

    try {
      // Verify that the variant exists and belongs to the task
      const existingVariant = await taskVariantRepository.getTaskIdByVariantId(variantId);

      if (!existingVariant || existingVariant.taskId !== taskId) {
        throw new ApiError(ApiErrorMessage.NOT_FOUND, {
          statusCode: StatusCodes.NOT_FOUND,
          code: ApiErrorCode.RESOURCE_NOT_FOUND,
          context: { userId, taskId, variantId },
        });
      }

      // Check for early return condition where no updates are needed
      const hasFieldUpdates = name !== undefined || description !== undefined || status !== undefined;
      const hasParameterUpdates = parameters !== undefined;
      if (!hasFieldUpdates && !hasParameterUpdates) return;

      // Update task variant and parameters if needed
      await taskVariantRepository.runTransaction({
        fn: async (tx) => {
          if (hasFieldUpdates) {
            await taskVariantRepository.update({
              id: variantId,
              data: {
                ...(name !== undefined && { name }),
                ...(description !== undefined && { description }),
                ...(status !== undefined && { status }),
              },
              transaction: tx,
            });
          }
          if (hasParameterUpdates) {
            await taskVariantParameterRepository.deleteByTaskVariantId({
              taskVariantId: variantId,
              transaction: tx,
            });
            if (parameters.length > 0) {
              await taskVariantParameterRepository.createMany({
                data: parameters.map(({ name, value }) => ({ taskVariantId: variantId, name, value })),
                transaction: tx,
              });
            }
          }
        },
      });

      logger.info(
        {
          userId,
          taskId,
          variantId,
          hasFieldUpdates,
          parametersUpdated: parameters !== undefined,
          parameterCount: parameters?.length ?? 0,
        },
        'Updated task variant',
      );
    } catch (error) {
      if (error instanceof ApiError) throw error;

      // Unwrap the Drizzle error to get the underlying database error with SQLSTATE codes
      const dbError = unwrapDrizzleError(error);

      // Check for Postgres unique constraint violation
      if (isUniqueViolation(dbError)) {
        throw new ApiError(ApiErrorMessage.CONFLICT, {
          statusCode: StatusCodes.CONFLICT,
          code: ApiErrorCode.RESOURCE_CONFLICT,
          context: { userId, taskId, variantId, variantName: name },
          cause: error,
        });
      }

      logger.error({ err: error, context: { userId, taskId, variantId } }, 'Failed to update task variant');

      throw new ApiError('Failed to update task variant', {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
        context: { userId, taskId, variantId },
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
   * Database conditions store field paths like "studentData.grade", "studentData.statusEll",
   * etc. This wrapper is required because the condition evaluator uses these paths to
   * traverse the data structure via getNestedValue(). The User entity has flat fields
   * (user.grade, user.statusEll), so we wrap them in { studentData: { ... } } to match
   * the expected path structure.
   *
   * @param user - Any object with the demographic fields needed for condition evaluation
   * @returns The user data in the format expected by condition evaluation
   */
  function mapUserToConditionData(user: ConditionEvaluationUser): ConditionUserData {
    return {
      studentData: {
        grade: user.grade,
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
   * @param user - Any object with the demographic fields needed for condition evaluation
   * @param conditionsAssignment - assigned_if condition (null = assigned to all)
   * @param conditionsRequirements - optional_if condition (null = required for all)
   * @returns Object with isAssigned and isOptional flags
   */
  function evaluateTaskVariantEligibility(
    user: ConditionEvaluationUser,
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
  function evaluateConditionForUser(user: ConditionEvaluationUser, condition: Condition | null): boolean {
    if (!condition) {
      return true;
    }

    const userData = mapUserToConditionData(user) as unknown as Record<string, unknown>;
    return evaluateCondition(userData, condition);
  }

  /**
   * List all tasks with optional filtering and sorting.
   *
   * Tasks are global resources (not tied to org hierarchy), so all authenticated
   * users can view all tasks. No authorization filtering is applied.
   *
   * @param authContext - User's authentication context (used for logging)
   * @param options - Pagination, sorting, and filter options
   * @returns Paginated result with tasks
   * @throws {ApiError} DATABASE_QUERY_FAILED if an unexpected database error occurs
   */
  async function list(authContext: AuthContext, options: ListTasksOptions): Promise<PaginatedResult<Task>> {
    const { userId } = authContext;

    try {
      return await taskRepository.listAll(options);
    } catch (error) {
      if (error instanceof ApiError) throw error;

      logger.error({ err: error, context: { userId } }, 'Failed to list tasks');

      throw new ApiError(ApiErrorMessage.INTERNAL_SERVER_ERROR, {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
        context: { userId },
        cause: error,
      });
    }
  }

  /**
   * Get a task by ID.
   *
   * Searches by task ID (UUID) or slug (case-sensitive).
   *
   * Tasks are global resources (not tied to org hierarchy), so all authenticated
   * users can view any task. No authorization filtering is applied.
   *
   * @param authContext - User's authentication context (used for logging)
   * @param taskId - The task ID (UUID) or slug to search for
   * @returns The task with the given ID
   * @throws {ApiError} NOT_FOUND if no task exists with the given ID
   * @throws {ApiError} DATABASE_QUERY_FAILED if an unexpected database error occurs
   */
  async function getById(authContext: AuthContext, taskId: string): Promise<Task> {
    const { userId } = authContext;

    try {
      // Parse taskId: if it's a UUID format, look up by ID; otherwise by slug
      let task: Task | null = null;

      if (isValidUuid(taskId)) {
        task = await taskRepository.getById({ id: taskId });
      } else {
        task = await taskRepository.getBySlug(taskId);
      }

      if (!task) {
        throw new ApiError(ApiErrorMessage.NOT_FOUND, {
          statusCode: StatusCodes.NOT_FOUND,
          code: ApiErrorCode.RESOURCE_NOT_FOUND,
          context: { userId, taskId },
        });
      }

      return task;
    } catch (error) {
      if (error instanceof ApiError) throw error;

      logger.error({ err: error, context: { userId, taskId } }, 'Failed to get task by ID');

      throw new ApiError(ApiErrorMessage.INTERNAL_SERVER_ERROR, {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
        context: { userId, taskId },
        cause: error,
      });
    }
  }

  /**
   * Creates a new task.
   *
   * Only super admins can create tasks.
   *
   * @param authContext - User's auth context (requires super admin privileges)
   * @param body - Task data including slug, name, nameSimple, nameTechnical, taskConfig, and optional fields
   * @returns An object containing the created task's UUID
   * @throws {ApiError} FORBIDDEN if user is not a super admin
   * @throws {ApiError} CONFLICT if a task with the same slug already exists
   * @throws {ApiError} DATABASE_QUERY_FAILED if an unexpected database error occurs
   */
  async function create(authContext: AuthContext, body: CreateTaskData): Promise<{ id: string }> {
    const { userId, isSuperAdmin } = authContext;

    if (!isSuperAdmin) {
      throw new ApiError(ApiErrorMessage.FORBIDDEN, {
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
        context: { userId, isSuperAdmin },
      });
    }

    try {
      const taskData: NewTask = {
        slug: body.slug,
        name: body.name,
        nameSimple: body.nameSimple,
        nameTechnical: body.nameTechnical,
        taskConfig: body.taskConfig,
        ...(body.description !== undefined && { description: body.description }),
        ...(body.image !== undefined && { image: body.image }),
        ...(body.tutorialVideo !== undefined && { tutorialVideo: body.tutorialVideo }),
      };

      const result = await taskRepository.create({ data: taskData });

      logger.info({ userId, taskId: result.id, slug: body.slug }, 'Created task');

      return result;
    } catch (error) {
      if (error instanceof ApiError) throw error;

      const dbError = unwrapDrizzleError(error);

      if (isUniqueViolation(dbError)) {
        throw new ApiError(ApiErrorMessage.CONFLICT, {
          statusCode: StatusCodes.CONFLICT,
          code: ApiErrorCode.RESOURCE_CONFLICT,
          context: { userId, slug: body.slug },
          cause: error,
        });
      }

      logger.error({ err: error, context: { userId, slug: body.slug } }, 'Failed to create task');

      throw new ApiError(ApiErrorMessage.INTERNAL_SERVER_ERROR, {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
        context: { userId, slug: body.slug },
        cause: error,
      });
    }
  }

  return {
    list,
    getById,
    create,
    listTaskVariants,
    getTaskVariant,
    createTaskVariant,
    updateTaskVariant,
    evaluateTaskVariantEligibility,
  };
}
