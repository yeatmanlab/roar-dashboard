import { StatusCodes } from 'http-status-codes';
import type { PaginatedResult } from '@roar-dashboard/api-contract';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { ApiErrorMessage } from '../../enums/api-error-message.enum';
import { ApiError } from '../../errors/api-error';
import { logger } from '../../logger';
import { ClassRepository } from '../../repositories/class.repository';
import type { AuthContext } from '../../types/auth-context';
import type { EnrolledUserEntity, EnrolledUsersQuery, ListEnrolledUsersOptions } from '../../types/user';
import { AuthorizationService } from '../authorization/authorization.service';
import { FgaType, FgaRelation } from '../authorization/fga-constants';

export function ClassService({
  classRepository = new ClassRepository(),
  authorizationService = AuthorizationService(),
}: {
  classRepository?: ClassRepository;
  authorizationService?: ReturnType<typeof AuthorizationService>;
} = {}) {
  /**
   * Performs authorization checks for sub-resource listing.
   * Verifies class exists and user has can_list_users permission via FGA.
   *
   * FGA's can_list_users on class requires supervisory_tier_group, which encodes
   * both the access check and the supervisory role requirement in a single call.
   *
   * @param authContext - User's auth context (id and super admin flag)
   * @param classId - The class ID to verify access for
   * @throws {ApiError} NOT_FOUND if class doesn't exist
   * @throws {ApiError} FORBIDDEN if user lacks can_list_users permission
   */
  async function authorizeSubResourceAccess(authContext: AuthContext, classId: string): Promise<void> {
    const { userId, isSuperAdmin } = authContext;

    // Verify class exists (404 before 403)
    const classEntity = await classRepository.getById({ id: classId });
    if (!classEntity) {
      throw new ApiError(ApiErrorMessage.NOT_FOUND, {
        statusCode: StatusCodes.NOT_FOUND,
        code: ApiErrorCode.RESOURCE_NOT_FOUND,
        context: { userId, classId },
      });
    }

    if (isSuperAdmin) return;

    // FGA checks both access and supervisory role in one call
    await authorizationService.requirePermission(userId, FgaRelation.CAN_LIST_USERS, `${FgaType.CLASS}:${classId}`);
  }

  /**
   * List users assigned to a class with access control.
   *
   * Authorization behavior:
   * - Super admin: sees all users assigned to the class
   * - Users with can_list_users on class (supervisory_tier_group): sees all users in the class
   * - All other roles: returns 403 Forbidden
   *
   * @param authContext - User's auth context (id and type)
   * @param classId - The class ID to get users for
   * @param options - Pagination and sorting options
   * @returns Paginated result with users
   * @throws {ApiError} NOT_FOUND if class doesn't exist
   * @throws {ApiError} FORBIDDEN if user lacks access to the class or has supervised role
   * @throws {ApiError} INTERNAL_SERVER_ERROR if the database query fails
   */
  async function listUsers(
    authContext: AuthContext,
    classId: string,
    options: EnrolledUsersQuery,
  ): Promise<PaginatedResult<EnrolledUserEntity>> {
    const { userId } = authContext;

    try {
      await authorizeSubResourceAccess(authContext, classId);

      const queryParams: ListEnrolledUsersOptions = {
        page: options.page,
        perPage: options.perPage,
        orderBy: {
          field: options.sortBy,
          direction: options.sortOrder,
        },
        ...(options.role && { role: options.role }),
        ...(options.grade && { grade: options.grade }),
      };

      // FGA already verified permission — use unrestricted query for all authorized users
      return await classRepository.getUsersByClassId(classId, queryParams);
    } catch (error) {
      if (error instanceof ApiError) throw error;

      logger.error({ err: error, context: { userId, classId, options } }, 'Failed to list class users');

      throw new ApiError('Failed to retrieve class users', {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
        context: { userId, classId },
        cause: error,
      });
    }
  }

  return {
    listUsers,
  };
}
