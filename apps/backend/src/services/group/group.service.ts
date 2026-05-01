import { StatusCodes } from 'http-status-codes';
import type { PaginatedResult } from '@roar-dashboard/api-contract';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { ApiErrorMessage } from '../../enums/api-error-message.enum';
import { ApiError } from '../../errors/api-error';
import { logger } from '../../logger';
import type { CreateGroupInput } from '../../repositories/group.repository';
import { GroupRepository } from '../../repositories/group.repository';
import type { AuthContext } from '../../types/auth-context';
import type { EnrolledUserEntity, EnrolledUsersQuery, ListEnrolledUsersOptions } from '../../types/user';
import { AuthorizationService } from '../authorization/authorization.service';
import { FgaType, FgaRelation } from '../authorization/fga-constants';
import type { GroupType } from '@roar-dashboard/api-contract';

/**
 * Service-layer input for creating a group.
 *
 * Mirrors the API contract's CreateGroupRequest shape (nested location). The
 * service flattens this into the repository's column-shaped CreateGroupInput.
 * Defined here rather than imported from the api-contract so the service stays
 * decoupled from transport concerns (see backend-service-pattern.md
 * "Service Type Independence").
 */
export interface CreateGroupServiceInput {
  name: string;
  abbreviation: string;
  groupType: GroupType;
  location?: {
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    stateProvince?: string;
    postalCode?: string;
    country?: string;
  };
}

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

  /**
   * Create a new group.
   *
   * Restricted to super admins. Groups are flat — no parent verification, no
   * derived columns, no path computation. The service runs the super-admin
   * gate, flattens the nested service input, and delegates to the repository.
   *
   * No FGA tuples are written by this endpoint. FGA tuples are user-to-group
   * relationships and are written when users are assigned to the group via
   * memberships.
   *
   * @param authContext - Authentication context with userId and isSuperAdmin
   * @param input - Group fields the caller is allowed to set
   * @returns The new group id
   * @throws {ApiError} 403 if the caller is not a super admin
   * @throws {ApiError} 500 if the database insert fails
   */
  async function create(authContext: AuthContext, input: CreateGroupServiceInput): Promise<{ id: string }> {
    const { userId, isSuperAdmin } = authContext;

    if (!isSuperAdmin) {
      logger.warn({ userId }, 'Non-super admin attempted to create a group');
      throw new ApiError(ApiErrorMessage.FORBIDDEN, {
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
        context: { userId },
      });
    }

    try {
      const repoInput: CreateGroupInput = {
        name: input.name,
        abbreviation: input.abbreviation,
        groupType: input.groupType,
        ...(input.location?.addressLine1 !== undefined && { locationAddressLine1: input.location.addressLine1 }),
        ...(input.location?.addressLine2 !== undefined && { locationAddressLine2: input.location.addressLine2 }),
        ...(input.location?.city !== undefined && { locationCity: input.location.city }),
        ...(input.location?.stateProvince !== undefined && { locationStateProvince: input.location.stateProvince }),
        ...(input.location?.postalCode !== undefined && { locationPostalCode: input.location.postalCode }),
        ...(input.location?.country !== undefined && { locationCountry: input.location.country }),
      };

      return await groupRepository.createGroup(repoInput);
    } catch (error) {
      if (error instanceof ApiError) throw error;

      logger.error({ err: error, context: { userId } }, 'Failed to create group');

      throw new ApiError('Failed to create group', {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
        context: { userId },
        cause: error,
      });
    }
  }

  return {
    create,
    listUsers,
  };
}
