import { StatusCodes } from 'http-status-codes';
import type { StartRunRequestBody } from '@roar-dashboard/api-contract';
import { ApiError } from '../../errors/api-error';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { logger } from '../../logger';
import { RunsRepository } from '../../repositories/runs.repository';
import { AdministrationService } from '../administration/administration.service';
import { TaskService } from '../task/task.service';

/**
 * Authentication context containing user identity and privilege level.
 */
interface AuthContext {
  userId: string;
  isSuperAdmin: boolean;
}

/**
 * RunService
 *
 * Orchestrates the creation of new run (assessment session) instances.
 * Handles validation, authorization, and persistence of run records.
 *
 * @param runsRepository - Data access layer for runs table
 * @param administrationService - Service for administration context validation and access control
 * @param taskService - Service for task variant resolution and version validation
 */
export function RunService({
  runsRepository = new RunsRepository(),
  administrationService = AdministrationService(),
  taskService = TaskService(),
}: {
  runsRepository?: RunsRepository;
  administrationService?: ReturnType<typeof AdministrationService>;
  taskService?: ReturnType<typeof TaskService>;
} = {}) {
  /**
   * Create a new run instance.
   *
   * Flow:
   * 1. Validate required fields (defense-in-depth; contract should already validate)
   * 2. Validate administration context and user access (throws 404 if not found, 403 if forbidden)
   * 3. Resolve taskId from task_variant_id and validate task version
   * 4. Insert run record into assessment database
   *
   * @param authContext - User identity and privilege information
   * @param body - Request body containing task_variant_id, task_version, administration_id, and optional metadata
   * @returns Object containing the newly created runId
   * @throws ApiError with appropriate status codes (400, 403, 404, 500)
   */
  async function create(authContext: AuthContext, body: StartRunRequestBody): Promise<{ runId: string }> {
    const { userId, isSuperAdmin } = authContext;

    // Defense-in-depth validation (contract should already validate)
    if (!body.task_variant_id || !body.task_version || !body.administration_id) {
      throw new ApiError('Missing required fields', {
        statusCode: StatusCodes.BAD_REQUEST,
        code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
        context: { userId },
      });
    }

    // Validate administration context and access (404 vs 403 handled by administrationService)
    await administrationService.getById({ userId, isSuperAdmin }, body.administration_id);

    // Resolve taskId from variant and validate version
    const { taskId } = await taskService.getTaskByVariantId(body.task_variant_id);
    await taskService.validateTaskVersion(taskId, body.task_version);

    // Create run in assessment database
    try {
      const run = await runsRepository.create({
        data: {
          userId,
          taskId,
          taskVariantId: body.task_variant_id,
          taskVersion: body.task_version,
          administrationId: body.administration_id,
          ...(body.metadata ? { metadata: body.metadata } : {}),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any, // if Drizzle insert typing complains, we can tighten this based on runs.$inferInsert
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return { runId: (run as any).id };
    } catch (error) {
      if (error instanceof ApiError) throw error;

      logger.error({ err: error, context: { userId, body } }, 'Failed to create run');

      throw new ApiError('Failed to create run', {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
        context: { userId },
        cause: error,
      });
    }
  }

  return { create };
}
