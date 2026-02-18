import { StatusCodes } from 'http-status-codes';
import type { CreateRunRequestBody } from '@roar-dashboard/api-contract';
import { ApiError } from '../../errors/api-error';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { logger } from '../../logger';
import { RunsRepository } from '../../repositories/runs.repository';
import { AdministrationService } from '../administration/administration.service';
import type { TaskService } from '../task/task.service';
import type { NewRun } from '../../db/schema';

import type { AuthContext } from '../../types/auth-context';
import { Permissions } from '../../constants/permissions';
import { rolesForPermission } from '../../constants/role-permissions';
import { AdministrationAccessControls } from '../../repositories/access-controls/administration.access-controls';

/**
 * RunService factory function.
 *
 * Creates a service for managing run operations including creation, completion, and event handling.
 * Supports dependency injection for testing and flexibility.
 *
 * @param options - Configuration options for the service
 * @param options.runsRepository - Repository for run data access (default: new RunsRepository())
 * @param options.administrationService - Service for administration operations (default: AdministrationService())
 * @param options.taskService - Service for task operations (required for create method)
 * @param options.administrationAccessControls - Access control service for authorization (default: new AdministrationAccessControls())
 * @returns Object with create method for creating new runs
 */
export function RunService({
  runsRepository = new RunsRepository(),
  administrationService = AdministrationService(),
  taskService,
  administrationAccessControls = new AdministrationAccessControls(),
}: {
  runsRepository?: RunsRepository;
  administrationService?: ReturnType<typeof AdministrationService>;
  taskService?: ReturnType<typeof TaskService>;
  administrationAccessControls?: AdministrationAccessControls;
} = {}) {
  /**
   * Creates a new run (assessment session instance).
   *
   * Performs the following validations and operations:
   * 1. Validates that taskService is configured
   * 2. Validates that the administration exists and user has access
   * 3. For non-super-admin users, checks if they have Runs.CREATE permission
   * 4. Resolves the taskId from the provided taskVariantId
   * 5. Creates the run record in the database
   *
   * @param authContext - Authentication context with userId and isSuperAdmin flag
   * @param body - Request body containing task_variant_id, task_version, administration_id, and optional metadata
   * @returns Promise resolving to object with runId
   * @throws ApiError with INTERNAL_SERVER_ERROR if taskService not configured
   * @throws ApiError with UNPROCESSABLE_ENTITY if administration_id or task_variant_id are invalid
   * @throws ApiError with FORBIDDEN if user lacks permission to create run
   * @throws ApiError with INTERNAL_SERVER_ERROR if database operation fails
   */
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
          context: { userId, administrationId: body.administration_id },
          cause: error,
        });
      }
      throw error;
    }

    if (!isSuperAdmin) {
      const userRoles = await administrationAccessControls.getUserRolesForAdministration(
        userId,
        body.administration_id,
      );

      const allowedRoles = rolesForPermission(Permissions.Runs.CREATE);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const hasPermission = userRoles.some((role) => allowedRoles.includes(role as any));

      if (!hasPermission) {
        throw new ApiError('Forbidden', {
          statusCode: StatusCodes.FORBIDDEN,
          code: ApiErrorCode.AUTH_FORBIDDEN,
          context: { userId, administrationId: body.administration_id, userRoles, allowedRoles },
        });
      }
    }

    let taskId: string;
    try {
      const result = await taskService.getTaskIdByVariantId(body.task_variant_id);
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

    try {
      const data: NewRun = {
        userId,
        taskId,
        taskVariantId: body.task_variant_id,
        taskVersion: body.task_version,
        administrationId: body.administration_id,
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
