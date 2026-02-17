import { StatusCodes } from 'http-status-codes';
import { ApiError } from '../../errors/api-error';
import { ApiErrorCode } from '../../enums/api-error-code.enum';

import { TaskVariantRepository } from '../../repositories/task-variant.repository';

/**
 * TaskService factory function.
 *
 * Creates a service for managing task operations including task variant resolution.
 * Supports dependency injection for testing and flexibility.
 *
 * @param options - Configuration options for the service
 * @param options.taskVariantRepository - Repository for task variant data access (default: new TaskVariantRepository())
 * @returns Object with getTaskIdByVariantId method for resolving task IDs from variant IDs
 */
export function TaskService({
  taskVariantRepository = new TaskVariantRepository(),
}: {
  taskVariantRepository?: TaskVariantRepository;
} = {}) {
  /**
   * Resolves the taskId from a given taskVariantId.
   *
   * This method performs semantic validation of the task variant ID.
   * If the variant ID is invalid or not found, it returns a 422 UNPROCESSABLE_ENTITY
   * error rather than a 404 NOT_FOUND, because this is a request validation failure,
   * not a missing resource problem.
   *
   * @param taskVariantId - The UUID of the task variant to resolve
   * @returns Promise resolving to object with taskId
   * @throws ApiError with UNPROCESSABLE_ENTITY if taskVariantId is invalid or not found
   */
  async function getTaskIdByVariantId(taskVariantId: string): Promise<{ taskId: string }> {
    const taskId = await taskVariantRepository.getTaskIdByVariantId(taskVariantId);

    if (!taskId) {
      throw new ApiError('Invalid task_variant_id', {
        statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
        code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
        context: { taskVariantId },
      });
    }

    return { taskId };
  }

  return { getTaskIdByVariantId };
}
