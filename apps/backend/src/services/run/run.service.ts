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
import { AuthorizationService } from '../authorization/authorization.service';
import { FgaType, FgaRelation } from '../authorization/fga-constants';
import { ANONYMOUS_RUN_ADMINISTRATION_ID } from '../../constants/run';

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
 * @param options.authorizationService - FGA authorization service (default: AuthorizationService())
 * @returns Object with create method for creating new runs
 */
export function RunService({
  runRepository = new RunRepository(),
  administrationService = AdministrationService(),
  taskVariantRepository = new TaskVariantRepository(),
  authorizationService = AuthorizationService(),
}: {
  runRepository?: RunRepository;
  administrationService?: ReturnType<typeof AdministrationService>;
  taskVariantRepository?: TaskVariantRepository;
  authorizationService?: ReturnType<typeof AuthorizationService>;
} = {}) {
  /**
   * Verify that the authenticated user has access to the target user.
   *
   * Performs a two-step check:
   * 1. User can access their own runs (userId === targetUserId)
   * 2. User has CAN_READ_CHILD permission on target user (e.g., parent/guardian access)
   * 3. Super admins have unrestricted access
   *
   * @param authContext - User's auth context (id and super admin flag)
   * @param targetUserId - The user ID to verify access for
   * @throws {ApiError} FORBIDDEN if user lacks access
   */
  async function verifyUserAccess(authContext: AuthContext, targetUserId: string): Promise<void> {
    const { userId, isSuperAdmin } = authContext;

    // Super admins have unrestricted access
    if (isSuperAdmin) {
      return;
    }

    // User can access their own runs
    if (userId === targetUserId) {
      return;
    }

    // Check if user has permission to act on behalf of target user (e.g., parent/guardian)
    // Find all families where the user is a parent and has can_read_child permission
    const accessibleFamilies = await authorizationService.listAccessibleObjects(
      userId,
      FgaRelation.CAN_READ_CHILD,
      FgaType.FAMILY,
    );

    // If the user has can_read_child on any family, they can create runs for users in that family
    // The FGA model ensures that only parents can have can_read_child, so this is a safe check
    if (accessibleFamilies.length === 0) {
      throw new ApiError(ApiErrorMessage.FORBIDDEN, {
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
        context: { userId, targetUserId },
      });
    }
  }

  /**
   * Creates a new run (assessment session instance).
   *
   * Performs the following validations and operations:
   * 1. Verifies user has access to the target user via FGA
   * 2. Rejects anonymous runs that include an administrationId
   * 3. For non-anonymous runs, validates that the administration exists and user has access
   * 4. For non-anonymous, non-super-admin users, checks can_create_run via FGA
   * 5. Resolves the taskId from the provided taskVariantId
   * 6. Creates the run record (anonymous runs use the sentinel administration ID)
   *
   * @param authContext - Authentication context with userId and isSuperAdmin flag
   * @param targetUserId - The user ID who will own the run (from path parameter)
   * @param body - Request body containing taskVariantId, taskVersion, optional isAnonymous flag,
   *   administrationId (required for non-anonymous runs), and optional metadata
   * @returns Promise resolving to object with id
   * @throws ApiError with FORBIDDEN if user lacks access to target user
   * @throws ApiError with UNPROCESSABLE_ENTITY if administrationId or taskVariantId are invalid
   * @throws ApiError with FORBIDDEN if user lacks permission to create run
   * @throws ApiError with INTERNAL_SERVER_ERROR if database operation fails
   */
  async function create(
    authContext: AuthContext,
    targetUserId: string,
    body: CreateRunRequestBody,
  ): Promise<{ id: string }> {
    const { userId, isSuperAdmin } = authContext;
    const { isAnonymous } = body;

    // Verify user has access to the target user
    await verifyUserAccess(authContext, targetUserId);

    // Note: Zod schema validation already rejects isAnonymous && administrationId combination,
    // so we don't need to check it here. This is caught at the request level (400 BAD_REQUEST).

    if (!isAnonymous) {
      try {
        await administrationService.verifyAdministrationAccess(authContext, body.administrationId!);
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
        // FGA checks if the user has can_create_run on this administration
        await authorizationService.requirePermission(
          userId,
          FgaRelation.CAN_CREATE_RUN,
          `${FgaType.ADMINISTRATION}:${body.administrationId!}`,
        );
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
        userId: targetUserId,
        taskId: result.taskId,
        taskVariantId: body.taskVariantId,
        taskVersion: body.taskVersion,
        administrationId: isAnonymous ? ANONYMOUS_RUN_ADMINISTRATION_ID : body.administrationId!,
        isAnonymous,
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
            isAnonymous,
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
