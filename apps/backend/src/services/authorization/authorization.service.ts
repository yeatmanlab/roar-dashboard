import { AuthorizationRepository } from '../../repositories/authorization.repository';
import UserType, { type UserType as UserTypeValue } from '../../enums/user-type.enum';
import { ResourceScopeType } from '../../enums/resource-scope-type.enum';
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
   * @returns ResourceScope - unrestricted for admins, scoped with IDs for others
   */
  async function getAdministrationsScope(userId: string, userType: UserTypeValue): Promise<ResourceScope> {
    // Admin users have access to all administrations
    // @TODO: Fix this check to only apply to site_administrators
    if (userType === UserType.ADMIN) {
      return { type: ResourceScopeType.UNRESTRICTED };
    }

    const ids = await authorizationRepository.getAccessibleAdministrationIds(userId);
    return { type: ResourceScopeType.SCOPED, ids };
  }

  return { getAdministrationsScope };
}
