import { StatusCodes } from 'http-status-codes';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { ResourceScopeType } from '../../enums/resource-scope-type.enum';
import UserType, { type UserType as UserTypeValue } from '../../enums/user-type.enum';
import { ApiError } from '../../errors/api-error';
import { logger } from '../../logger';
import { AuthorizationRepository } from '../../repositories/authorization.repository';
import type { ResourceScope } from '../../types/resource-scope';

/**
 * AuthorizationService
 *
 * Provides authorization-related business logic operations.
 * Determines what resources a user can access based on their memberships.
 *
 * @param params - Configuration object containing repository instances (optional)
 * @returns AuthorizationService - An object with authorization service methods.
 */
export function AuthorizationService({
  authorizationRepository = new AuthorizationRepository(),
}: {
  authorizationRepository?: AuthorizationRepository;
} = {}) {
  /**
   * Get the scope of administrations a user can access.
   *
   * @returns ResourceScope - unrestricted for super_admin, scoped with IDs for all other users
   * @throws {ApiError} If the database query fails.
   */
  async function getAdministrationsScope(userId: string, userType: UserTypeValue): Promise<ResourceScope> {
    // Super admin users bypass RBAC and have access to all administrations
    if (userType === UserType.SUPER_ADMIN) {
      return { type: ResourceScopeType.UNRESTRICTED };
    }

    try {
      const ids = await authorizationRepository.getAccessibleAdministrationIds(userId);
      return { type: ResourceScopeType.SCOPED, ids };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error({ err: error, userId, userType }, 'Failed to get administrations scope');
      throw new ApiError('Failed to retrieve authorization scope', {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
        context: { userId, userType },
        cause: error,
      });
    }
  }

  return { getAdministrationsScope };
}
