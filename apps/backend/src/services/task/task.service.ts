import { StatusCodes } from 'http-status-codes';
import { ApiError } from '../../errors/api-error';
import { ApiErrorCode } from '../../enums/api-error-code.enum';

/**
 * Represents a task variant record from the task database.
 */
export interface TaskVariantRecord {
  id: string;
  taskId: string;
}

/**
 * Function signature for resolving a task variant by its ID.
 * Should query the non-assessment database where task variants are stored.
 */
type GetTaskVariantByIdFn = (variantId: string) => Promise<TaskVariantRecord | null>;

/**
 * Function signature for validating a task version.
 * Returns true if the version is valid for the given task, false otherwise.
 */
type IsTaskVersionValidFn = (taskId: string, version: string) => Promise<boolean>;

/**
 * TaskService
 *
 * Provides task-related operations for run creation:
 * - Resolves taskId from task_variant_id (queries non-assessment DB)
 * - Validates task versions
 *
 * @param getTaskVariantById - Optional function to resolve task variants (must be provided for production)
 * @param isTaskVersionValid - Optional function to validate task versions (defaults to non-empty string check)
 */
export function TaskService({
  getTaskVariantById,
  isTaskVersionValid,
}: {
  getTaskVariantById?: GetTaskVariantByIdFn;
  isTaskVersionValid?: IsTaskVersionValidFn;
} = {}) {
  const getTaskVariantByIdImpl = getTaskVariantById;
  // Default version validation: non-empty string
  const isTaskVersionValidImpl: IsTaskVersionValidFn =
    isTaskVersionValid ?? (async (_taskId, version) => typeof version === 'string' && version.trim().length > 0);

  /**
   * Resolve taskId from a task variant ID.
   *
   * Queries the non-assessment database to find the task variant and extract its taskId.
   *
   * @param taskVariantId - UUID of the task variant
   * @returns Object containing the resolved taskId
   * @throws ApiError with 500 if resolver not configured
   * @throws ApiError with 404 if variant not found
   */
  async function getTaskByVariantId(taskVariantId: string): Promise<{ taskId: string }> {
    if (!getTaskVariantByIdImpl) {
      throw new ApiError('Task variant resolver not configured', {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
        context: { taskVariantId },
      });
    }

    const variant = await getTaskVariantByIdImpl(taskVariantId);

    if (!variant) {
      throw new ApiError('Task variant not found', {
        statusCode: StatusCodes.NOT_FOUND,
        code: ApiErrorCode.RESOURCE_NOT_FOUND,
        context: { taskVariantId },
      });
    }

    return { taskId: variant.taskId };
  }

  /**
   * Validate that a task version is valid for the given task.
   *
   * @param taskId - ID of the task to validate against
   * @param version - Version string to validate
   * @throws ApiError with 422 if version is invalid
   */
  async function validateTaskVersion(taskId: string, version: string): Promise<void> {
    const ok = await isTaskVersionValidImpl(taskId, version);

    if (!ok) {
      throw new ApiError('Invalid task version', {
        statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
        code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
        context: { taskId, version },
      });
    }
  }

  return { getTaskByVariantId, validateTaskVersion };
}
