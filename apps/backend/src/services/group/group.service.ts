import { StatusCodes } from 'http-status-codes';
import type { PaginatedResult, EnrolledUsersQuery } from '@roar-dashboard/api-contract';
import { Permissions } from '../../constants/permissions';
import { rolesForPermission } from '../../constants/role-permissions';
import type { Group } from '../../db/schema';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { ApiErrorMessage } from '../../enums/api-error-message.enum';
import { ApiError } from '../../errors/api-error';
import { logger } from '../../logger';
import { GroupRepository } from '../../repositories/group.repository';
import type { AuthContext } from '../../types/auth-context';
import type { EnrolledUserEntity, ListEnrolledUsersOptions } from '../../types/user';
import { hasSupervisoryRole } from '../../utils/has-supervisory-role.util';

export function GroupService({
  groupRepository = new GroupRepository(),
}: {
  groupRepository?: GroupRepository;
} = {}) {
  /**
   * Verify that a group exists and the user has access to it.
   *
   * Performs a two-step check:
   * 1. Verify the group exists (returns 404 if not)
   * 2. Verify the user has access (returns 403 if not, skipped for super admins)
   *
   * @param authContext - User's auth context (id and super admin flag)
   * @param groupId - The group ID to verify access for
   * @returns The group if found and accessible
   * @throws {ApiError} NOT_FOUND if group doesn't exist
   * @throws {ApiError} FORBIDDEN if user lacks access
   */
  async function verifyGroupAccess(authContext: AuthContext, groupId: string): Promise<Group> {
    const { userId, isSuperAdmin } = authContext;

    const groupEntity = await groupRepository.getById({ id: groupId });

    if (!groupEntity) {
      throw new ApiError(ApiErrorMessage.NOT_FOUND, {
        statusCode: StatusCodes.NOT_FOUND,
        code: ApiErrorCode.RESOURCE_NOT_FOUND,
        context: { userId, groupId },
      });
    }

    if (isSuperAdmin) {
      return groupEntity;
    }

    const allowedRoles = rolesForPermission(Permissions.Groups.LIST);
    const authorized = await groupRepository.getAuthorizedById({ userId, allowedRoles }, groupId);

    if (!authorized) {
      logger.warn({ userId, groupId }, 'User attempted to access group resource without permission');
      throw new ApiError(ApiErrorMessage.FORBIDDEN, {
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
        context: { userId, groupId },
      });
    }

    return authorized;
  }

  /**
   * Performs authorization checks for sub-resource listing (supervisory roles only).
   * Throws if user lacks access or is a supervised user.
   *
   * @param authContext - User's auth context (id and super admin flag)
   * @param groupId - The group ID to verify access for
   * @throws {ApiError} NOT_FOUND if group doesn't exist
   * @throws {ApiError} FORBIDDEN if user lacks access or is a supervised user
   */
  async function authorizeSubResourceAccess(authContext: AuthContext, groupId: string): Promise<void> {
    const { userId, isSuperAdmin } = authContext;

    await verifyGroupAccess(authContext, groupId);

    if (isSuperAdmin) return;

    const userRoles = await groupRepository.getUserRolesForGroup(userId, groupId);

    if (!hasSupervisoryRole(userRoles)) {
      logger.warn({ userId, groupId, userRoles }, 'Supervised user attempted to list group sub-resources');
      throw new ApiError(ApiErrorMessage.FORBIDDEN, {
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
        context: { userId, groupId, userRoles },
      });
    }
  }

  /**
   * List users assigned to a group with access control.
   *
   * Authorization behavior:
   * - Super admin: sees all users assigned to the group
   * - Supervisory roles: sees users only for groups they are directly assigned to (via group membership)
   *   - Excludes caregiver role
   * - Supervised roles (student/guardian/parent/relative): returns 403 Forbidden
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
    const { userId, isSuperAdmin } = authContext;

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

      if (isSuperAdmin) {
        return await groupRepository.getUsersByGroupId(groupId, queryParams);
      }

      const allowedRoles = rolesForPermission(Permissions.Users.LIST);
      return await groupRepository.getAuthorizedUsersByGroupId({ userId, allowedRoles }, groupId, queryParams);
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
