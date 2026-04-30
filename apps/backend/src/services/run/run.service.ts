import { StatusCodes } from 'http-status-codes';
import type { CreateRunRequestBody } from '@roar-dashboard/api-contract';
import { ApiError } from '../../errors/api-error';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { ApiErrorMessage } from '../../enums/api-error-message.enum';
import { logger } from '../../logger';
import { RunRepository } from '../../repositories/run.repository';
import { TaskVariantRepository } from '../../repositories/task-variant.repository';
import { FamilyRepository } from '../../repositories/family.repository';
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
  familyRepository = new FamilyRepository(),
}: {
  runRepository?: RunRepository;
  administrationService?: ReturnType<typeof AdministrationService>;
  taskVariantRepository?: TaskVariantRepository;
  authorizationService?: ReturnType<typeof AuthorizationService>;
  familyRepository?: FamilyRepository;
} = {}) {
  /**
   * Verify that the authenticated user has access to the target user.
   *
   * Performs a two-step check:
   * 1. User can access their own runs (userId === targetUserId)
   * 2. User has CAN_READ_CHILD permission on target user (e.g., parent/guardian access)
   * 3. Super admins have unrestricted access
   *
   * Returns the target user's family IDs when cross-user access is granted via CAN_READ_CHILD,
   * allowing callers to reuse this data for subsequent FGA checks (e.g., CAN_CREATE_RUN_FOR_CHILD)
   * without redundant database queries.
   *
   * @param authContext - User's auth context (id and super admin flag)
   * @param targetUserId - The user ID to verify access for
   * @returns Family IDs of the target user if cross-user access granted, empty array otherwise
   * @throws {ApiError} FORBIDDEN if user lacks access
   */
  async function verifyUserAccess(authContext: AuthContext, targetUserId: string): Promise<string[]> {
    const { userId, isSuperAdmin } = authContext;

    // Super admins have unrestricted access
    if (isSuperAdmin) {
      return [];
    }

    // User can access their own runs
    if (userId === targetUserId) {
      return [];
    }

    // Check if user has permission to act on behalf of target user (e.g., parent/guardian)
    // 1. Look up families the target user belongs to
    // 2. Check if the authenticated user has CAN_READ_CHILD on any of those families
    const targetFamilyIds = await familyRepository.getFamilyIdsForUser(targetUserId);
    const familyObjects = targetFamilyIds.map((id) => `${FgaType.FAMILY}:${id}`);
    const hasAccess = await authorizationService.hasAnyPermission(userId, FgaRelation.CAN_READ_CHILD, familyObjects);

    if (!hasAccess) {
      throw new ApiError(ApiErrorMessage.FORBIDDEN, {
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
        context: { userId, targetUserId },
      });
    }

    // Return family IDs so caller can reuse them for CAN_CREATE_RUN_FOR_CHILD check
    return targetFamilyIds;
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
    const { userId: requesterUserId, isSuperAdmin } = authContext;
    const { isAnonymous } = body;

    // Verify user has access to the target user and get family IDs for potential reuse
    const targetFamilyIds = await verifyUserAccess(authContext, targetUserId);

    // Note: Zod schema validation already rejects isAnonymous && administrationId combination,
    // so we don't need to check it here. This is caught at the request level (400 BAD_REQUEST).

    if (!isAnonymous) {
      // When a parent creates a run for their child, the child is the one who needs
      // access to the administration and CAN_CREATE_RUN permission — not the parent.
      // The parent's authorization is verified separately via CAN_CREATE_RUN_FOR_CHILD.
      // Super admins always use their own context (they bypass FGA checks anyway).
      const isParentForChildRun = requesterUserId !== targetUserId && !isSuperAdmin;
      const administrationAuthContext: AuthContext = isParentForChildRun
        ? { userId: targetUserId, isSuperAdmin: false }
        : authContext;

      try {
        await administrationService.verifyAdministrationAccess(administrationAuthContext, body.administrationId!);
      } catch (error) {
        if (error instanceof ApiError) {
          if (error.statusCode === StatusCodes.NOT_FOUND) {
            throw new ApiError('Invalid administration ID', {
              statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
              code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
              context: { requesterUserId, targetUserId, administrationId: body.administrationId },
              cause: error,
            });
          }

          if (error.statusCode === StatusCodes.FORBIDDEN) {
            throw new ApiError(ApiErrorMessage.FORBIDDEN, {
              statusCode: StatusCodes.FORBIDDEN,
              code: ApiErrorCode.AUTH_FORBIDDEN,
              context: { requesterUserId, targetUserId, administrationId: body.administrationId },
              cause: error,
            });
          }
        }
        throw error;
      }

      if (!isSuperAdmin) {
        // FGA checks if the run owner has can_create_run on this administration.
        // For self-runs, this is the requester. For parent-for-child runs, this is the child.
        await authorizationService.requirePermission(
          isParentForChildRun ? targetUserId : requesterUserId,
          FgaRelation.CAN_CREATE_RUN,
          `${FgaType.ADMINISTRATION}:${body.administrationId!}`,
        );
      }

      if (isParentForChildRun) {
        // Requester is creating a run for a different user (e.g., parent creating for child).
        // Check if requester has can_create_run_for_child permission on any family containing the target user.
        // Super admins bypass this check.
        // Reuse targetFamilyIds from verifyUserAccess to avoid redundant database query.
        const familyObjects = targetFamilyIds.map((id) => `${FgaType.FAMILY}:${id}`);
        const hasAccess = await authorizationService.hasAnyPermission(
          requesterUserId,
          FgaRelation.CAN_CREATE_RUN_FOR_CHILD,
          familyObjects,
        );

        if (!hasAccess) {
          throw new ApiError(ApiErrorMessage.FORBIDDEN, {
            statusCode: StatusCodes.FORBIDDEN,
            code: ApiErrorCode.AUTH_FORBIDDEN,
            context: { requesterUserId, targetUserId },
          });
        }
      }
    }

    try {
      const result = await taskVariantRepository.getTaskIdByVariantId(body.taskVariantId);

      if (!result) {
        throw new ApiError('Invalid task variant ID', {
          statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
          code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
          context: { targetUserId, requesterUserId, taskVariantId: body.taskVariantId },
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
            targetUserId,
            requesterUserId,
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
        context: { targetUserId, requesterUserId },
        cause: error,
      });
    }
  }

  return { create };
}
