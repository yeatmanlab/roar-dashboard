import { StatusCodes } from 'http-status-codes';
import type { PaginatedResult, EnrolledUsersQuery } from '@roar-dashboard/api-contract';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { ApiErrorMessage } from '../../enums/api-error-message.enum';
import { ApiError } from '../../errors/api-error';
import { logger } from '../../logger';
import { GroupRepository } from '../../repositories/group.repository';
import type { AuthContext } from '../../types/auth-context';
import type { EnrolledUserEntity, ListEnrolledUsersOptions } from '../../types/user';
import { AuthorizationService } from '../authorization/authorization.service';
import { FgaType, FgaRelation } from '../authorization/fga-constants';

export function GroupService({
  groupRepository = new GroupRepository(),
  authorizationService = AuthorizationService(),
}: {
  groupRepository?: GroupRepository;
  authorizationService?: ReturnType<typeof AuthorizationService>;
} = {}) {
  /**
   * Performs authorization checks for sub-resource listing.
   * Verifies group exists and user has can_list_users permission via FGA.
   *
   * FGA's can_list_users on group requires supervisory_tier_group, which encodes
   * both the access check and the supervisory role requirement in a single call.
   *
   * @param authContext - User's auth context (id and super admin flag)
   * @param groupId - The group ID to verify access for
   * @throws {ApiError} NOT_FOUND if group doesn't exist
   * @throws {ApiError} FORBIDDEN if user lacks can_list_users permission
   */
  async function authorizeSubResourceAccess(authContext: AuthContext, groupId: string): Promise<void> {
    const { userId, isSuperAdmin } = authContext;

    // Verify group exists (404 before 403)
    const groupEntity = await groupRepository.getById({ id: groupId });
    if (!groupEntity) {
      throw new ApiError(ApiErrorMessage.NOT_FOUND, {
        statusCode: StatusCodes.NOT_FOUND,
        code: ApiErrorCode.RESOURCE_NOT_FOUND,
        context: { userId, groupId },
      });
    }

    if (isSuperAdmin) return;

    // FGA checks both access and supervisory role in one call
    await authorizationService.requirePermission(userId, FgaRelation.CAN_LIST_USERS, `${FgaType.GROUP}:${groupId}`);
  }

  /**
   * List users assigned to a group with access control.
   *
   * Authorization behavior:
   * - Super admin: sees all users assigned to the group
   * - Users with can_list_users on group (supervisory_tier_group): sees all users in the group
   * - All other roles: returns 403 Forbidden
   *
   * @param authContext - User's auth context (id and type)
   * @param groupId - The group ID to get users for
   * @param options - Pagination and sorting options
   * @returns Paginated result with users
   * @throws {ApiError} NOT_FOUND if group doesn't exist
   * @throws {ApiError} FORBIDDEN if user lacks access to the group or has supervised role
   * @throws {ApiError} INTERNAL_SERVER_ERROR if the database query fails
   */
  async function listUsers(
    authContext: AuthContext,
    groupId: string,
    options: EnrolledUsersQuery,
  ): Promise<PaginatedResult<EnrolledUserEntity>> {
    const { userId } = authContext;

    try {
      await authorizeSubResourceAccess(authContext, groupId);

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
      return await groupRepository.getUsersByGroupId(groupId, queryParams);
    } catch (error) {
      if (error instanceof ApiError) throw error;

      logger.error({ err: error, context: { userId, groupId, options } }, 'Failed to list group users');

      throw new ApiError('Failed to retrieve group users', {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
        context: { userId, groupId },
        cause: error,
      });
    }
  }

  return {
    listUsers,
  };
}
