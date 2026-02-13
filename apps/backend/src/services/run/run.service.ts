import { StatusCodes } from 'http-status-codes';
import type { CreateRunRequestBody } from '@roar-dashboard/api-contract';
import { ApiError } from '../../errors/api-error';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { logger } from '../../logger';
import { RunsRepository } from '../../repositories/runs.repository';
import { AdministrationService } from '../administration/administration.service';
import type { TaskService } from '../task/task.service';
import type { NewRun } from '../../db/schema';

/**
 * Authentication context containing user identity and privilege level.
 */
interface AuthContext {
  userId: string;
  isSuperAdmin: boolean;
}

export function RunService({
  runsRepository = new RunsRepository(),
  administrationService = AdministrationService(),
  taskService,
}: {
  runsRepository?: RunsRepository;
  administrationService?: ReturnType<typeof AdministrationService>;
  taskService?: ReturnType<typeof TaskService>;
} = {}) {
  async function create(authContext: AuthContext, body: CreateRunRequestBody): Promise<{ runId: string }> {
    const { userId, isSuperAdmin } = authContext;

    if (!taskService) {
      throw new ApiError('TaskService not configured', {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
        context: {
          userId,
          taskVariantId: body.task_variant_id,
          taskVersion: body.task_version,
          administrationId: body.administration_id,
        },
      });
    }

    try {
      await administrationService.getById({ userId, isSuperAdmin }, body.administration_id);
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === StatusCodes.NOT_FOUND) {
        throw new ApiError('Invalid administration_id', {
          statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
          code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
          context: {
            userId,
            taskVariantId: body.task_variant_id,
            taskVersion: body.task_version,
            administrationId: body.administration_id,
          },
          cause: error,
        });
      }
      throw error;
    }

    let taskId: string;
    try {
      const result = await taskService.getTaskByVariantId(body.task_variant_id);
      taskId = result.taskId;
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === StatusCodes.NOT_FOUND) {
        throw new ApiError('Invalid task_variant_id', {
          statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
          code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
          context: { userId, taskVariantId: body.task_variant_id },
          cause: error,
        });
      }
      throw error;
    }

    await taskService.validateTaskVersion(taskId, body.task_version);

    try {
      const data: NewRun = {
        userId,
        taskId,
        taskVariantId: body.task_variant_id,
        taskVersion: body.task_version,
        administrationId: body.administration_id, // no optional spread
        ...(body.metadata ? { metadata: body.metadata } : {}),
      };

      const run = await runsRepository.create({ data });
      return { runId: run.id as string };
    } catch (error) {
      if (error instanceof ApiError) throw error;

      logger.error(
        {
          err: error,
          context: {
            userId,
            taskId,
            taskVariantId: body.task_variant_id,
            taskVersion: body.task_version,
            administrationId: body.administration_id,
          },
        },
        'Failed to create run',
      );

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
