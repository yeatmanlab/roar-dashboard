import type { TaskVariant, NewTaskVariant, NewTaskVariantParameter, TaskVariantParameter } from '../../db/schema';
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
   * Create a new task variant for an existing task with its parameters.
   *
   * Creates the variant and all its parameters atomically within a transaction.
   * If any parameter creation fails, the entire operation is rolled back.
   *
   * Validates that the parent task exists before creating the variant.
   *
   * @param authContext - User's auth context (id for logging/auditing)
   * @param data - Task variant data including taskId, name, description, status, and parameters
   * @returns The created task variant
   * @throws {ApiError} NOT_FOUND if the parent task doesn't exist
   * @throws {ApiError} INTERNAL_SERVER_ERROR if the database operation fails
   */
  async function createTaskVariant(
    authContext: AuthContext,
    data: CreateTaskVariantData,
  ): Promise<Partial<TaskVariant>> {
    const { userId, isSuperAdmin } = authContext;

    if (!isSuperAdmin) {
      throw new ApiError(ApiErrorMessage.UNAUTHORIZED, {
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
      const variant = await taskVariantRepository.runTransaction<Partial<TaskVariant>>({
        fn: async (tx) => {
          const variantData: NewTaskVariant = {
            taskId: data.taskId,
            status: data.status,
            name: data.name,
            description: data.description,
          };

          const newVariant = await taskVariantRepository.create({
            data: variantData as TaskVariant,
            transaction: tx,
          });

          if (!newVariant) {
            throw new ApiError('Failed to create task variant', {
              statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
              code: ApiErrorCode.INTERNAL,
              context: { userId, isSuperAdmin, taskId: data.taskId },
            });
          }

          const taskVariantParameterData: NewTaskVariantParameter[] = data.parameters.map((newParameter) => ({
            taskVariantId: newVariant.id,
            name: newParameter.name,
            value: newParameter.value,
          }));

          if (taskVariantParameterData.length === 0) {
            throw new ApiError('At least one parameter required', {
              statusCode: StatusCodes.BAD_REQUEST,
              code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
              context: { userId, isSuperAdmin, taskId: data.taskId },
            });
          }

          const newTaskVariantParameters = await taskVariantParameterRepository.createMany({
            data: taskVariantParameterData as TaskVariantParameter[],
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

      // TODO: Create a more specific error code for Postgres conflict on task variant name
      // 409

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
