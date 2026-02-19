import type { NewTaskVariant, NewTaskVariantParameter } from '../../db/schema';
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
import { isUniqueViolation } from '../../errors';

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
 * TaskService
 *
 * Provides task-related business logic operations including tasks, variants, and parameters.
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

      // Check for Postgres unique constraint violation
      if (isUniqueViolation(error)) {
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

  return {
    createTaskVariant,
  };
}
