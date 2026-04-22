import { StatusCodes } from 'http-status-codes';
import { FamilyRepository } from '../../repositories/family.repository';
import { ApiError } from '../../errors/api-error';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { ApiErrorMessage } from '../../enums/api-error-message.enum';
import { logger } from '../../logger';
import type { PaginatedResult } from '../../repositories/base.repository';
import type { AuthContext } from '../../types/auth-context';
import { AuthorizationService } from '../authorization/authorization.service';
import { FgaType, FgaRelation } from '../authorization/fga-constants';
import type {
  EnrolledFamilyUsersQuery,
  EnrolledFamilyUserEntity,
  ListEnrolledFamilyUsersOptions,
} from '../../types/user';

/**
 * Family Service
 *
 * Business logic layer for family operations.
 * Handles authorization (super admin vs regular user) and delegates to repository.
 */
export function FamilyService({
  familyRepository = new FamilyRepository(),
  authorizationService = AuthorizationService(),
}: {
  familyRepository?: FamilyRepository;
  authorizationService?: ReturnType<typeof AuthorizationService>;
} = {}) {
  /**
   * Get users enrolled in a family.
   *
   * super_admin users can see all enrolled family members.
   * Only users with the `can_list_users` permission on the family can see other enrolled family members.
   *
   * Returns all users who have an active enrollment in the specified family.
   * Only includes users with active enrollments (joined_start <= now and
   * left_on is null or >= now).
   *
   * @param authContext - User's auth context (id and super admin flag)
   * @param familyId - The family ID to get enrolled users for
   * @param options - Pagination, sorting, and filtering options
   * @returns Paginated result with users
   * @throws {ApiError} NOT_FOUND if family doesn't exist
   * @throws {ApiError} FORBIDDEN if user lacks access to the family
   * @throws {ApiError} INTERNAL_SERVER_ERROR if the database query fails
   */
  async function listUsers(
    authContext: AuthContext,
    familyId: string,
    options: EnrolledFamilyUsersQuery,
  ): Promise<PaginatedResult<EnrolledFamilyUserEntity>> {
    const { userId, isSuperAdmin } = authContext;
    try {
      const family = await familyRepository.getById({ id: familyId });

      if (!family) {
        throw new ApiError(ApiErrorMessage.NOT_FOUND, {
          statusCode: StatusCodes.NOT_FOUND,
          code: ApiErrorCode.RESOURCE_NOT_FOUND,
          context: { userId: authContext.userId, familyId },
        });
      }

      const queryParams: ListEnrolledFamilyUsersOptions = {
        page: options.page,
        perPage: options.perPage,
        orderBy: { field: options.sortBy, direction: options.sortOrder },
        ...(options.role && { role: options.role }),
        ...(options.grade && { grade: options.grade }),
      };

      if (!isSuperAdmin) {
        await authorizationService.requirePermission(
          userId,
          FgaRelation.CAN_LIST_USERS,
          `${FgaType.FAMILY}:${familyId}`,
        );
      }

      return await familyRepository.getUsersByFamilyId(familyId, queryParams);
    } catch (error) {
      if (error instanceof ApiError) throw error;

      logger.error(
        { err: error, context: { userId: authContext.userId, familyId, options } },
        'Failed to list family users',
      );

      throw new ApiError('Failed to retrieve family users', {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
        context: { userId: authContext.userId, familyId },
        cause: error,
      });
    }
  }

  return {
    listUsers,
  };
}
