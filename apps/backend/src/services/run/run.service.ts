import { StatusCodes } from 'http-status-codes';
import type { CreateRunRequestBody } from '@roar-dashboard/api-contract';
import { ApiError } from '../../errors/api-error';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { ApiErrorMessage } from '../../enums/api-error-message.enum';
import { logger } from '../../logger';
import { RunRepository } from '../../repositories/run.repository';
import { TaskVariantRepository } from '../../repositories/task-variant.repository';
import { AdministrationService } from '../administration/administration.service';
import type { NewRun } from '../../db/schema';

import type { AuthContext } from '../../types/auth-context';
import { Permissions } from '../../constants/permissions';
import { rolesForPermission } from '../../constants/role-permissions';
import { AdministrationAccessControls } from '../../repositories/access-controls/administration.access-controls';
import { type UserRole as UserRoleType } from '../../enums/user-role.enum';

/**
 * RunService factory function.
 *
 * Creates a service for managing run operations including creation, completion, and event handling.
 * Supports dependency injection for testing and flexibility.
 *
 * @param options - Configuration options for the service
 * @param options.runRepository - Repository for run data access (default: new RunRepository())
 * @param options.administrationService - Service for administration operations (default: AdministrationService())
 * @param options.taskVariantRepository - Repository for task variant data access (default: new TaskVariantRepository())
 * @param options.administrationAccessControls - Access control service for authorization (default: new AdministrationAccessControls())
 * @returns Object with create method for creating new runs
 */
export function RunService({
  runRepository = new RunRepository(),
  administrationService = AdministrationService(),
  taskVariantRepository = new TaskVariantRepository(),
  administrationAccessControls = new AdministrationAccessControls(),
}: {
  runRepository?: RunRepository;
  administrationService?: ReturnType<typeof AdministrationService>;
  taskVariantRepository?: TaskVariantRepository;
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
   * @param body - Request body containing taskVariantId, taskVersion, administrationId, and optional metadata
   * @returns Promise resolving to object with id
   * @throws ApiError with UNPROCESSABLE_ENTITY if administrationId or taskVariantId are invalid
   * @throws ApiError with FORBIDDEN if user lacks permission to create run
   * @throws ApiError with INTERNAL_SERVER_ERROR if database operation fails
   */
  async function create(authContext: AuthContext, body: CreateRunRequestBody): Promise<{ id: string }> {
    const { userId, isSuperAdmin } = authContext;

    try {
      await administrationService.verifyAdministrationAccess({ userId, isSuperAdmin }, body.administrationId);
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.statusCode === StatusCodes.NOT_FOUND) {
          throw new ApiError('Invalid administration ID', {
            statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
            code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
            context: { userId, administrationId: body.administrationId },
            cause: error,
          });
        }

        if (error.statusCode === StatusCodes.FORBIDDEN) {
          throw new ApiError(ApiErrorMessage.FORBIDDEN, {
            statusCode: StatusCodes.FORBIDDEN,
            code: ApiErrorCode.AUTH_FORBIDDEN,
            context: { userId, administrationId: body.administrationId },
            cause: error,
          });
        }
      }
      throw error;
    }

    if (!isSuperAdmin) {
      const userRoles = (await administrationAccessControls.getUserRolesForAdministration(
        userId,
        body.administrationId,
      )) as UserRoleType[];

      const allowedRoles = rolesForPermission(Permissions.Runs.CREATE);

      const hasPermission = userRoles.some((role) => allowedRoles.includes(role));

      if (!hasPermission) {
        throw new ApiError(ApiErrorMessage.FORBIDDEN, {
          statusCode: StatusCodes.FORBIDDEN,
          code: ApiErrorCode.AUTH_FORBIDDEN,
          context: { userId, administrationId: body.administrationId, userRoles, allowedRoles },
        });
      }
    }

    try {
      const result = await taskVariantRepository.getTaskIdByVariantId(body.taskVariantId);

      if (!result) {
        throw new ApiError('Invalid task variant ID', {
          statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
          code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
          context: { userId, taskVariantId: body.taskVariantId },
        });
      }

      const data: NewRun = {
        userId,
        taskId: result.taskId,
        taskVariantId: body.taskVariantId,
        taskVersion: body.taskVersion,
        administrationId: body.administrationId,
        ...(body.metadata ? { metadata: body.metadata } : {}),
      };

      const run = await runRepository.create({ data });

      return { id: run.id };
    } catch (error) {
      if (error instanceof ApiError) throw error;

      logger.error(
        {
          err: error,
          context: {
            userId,
            taskVariantId: body.taskVariantId,
            taskVersion: body.taskVersion,
            administrationId: body.administrationId,
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
