import type { Administration } from '../../db/schema';
import {
  AdministrationRepository,
  type AdministrationQueryOptions,
  type AdministrationSortField,
} from '../../repositories/administration.repository';
import { AuthorizationService } from '../authorization/authorization.service';
import type { PaginatedResult } from '@roar-dashboard/api-contract';
import type { UserType } from '../../enums/user-type.enum';
import { isUnrestrictedResource } from '../../utils/resource-scope.utils';

/**
 * Maps API sort field names to database column names.
 *
 * @TODO: Check with team whether to rename DB column 'nameInternal' to 'name'
 * to eliminate this mapping.
 */
const SORT_FIELD_TO_COLUMN: Record<AdministrationSortField, string> = {
  name: 'nameInternal',
  createdAt: 'createdAt',
  dateStart: 'dateStart',
  dateEnd: 'dateEnd',
};

/**
 * Auth context containing user identity and role.
 */
interface AuthContext {
  userId: string;
  userType: UserType;
}

/**
 * AdministrationService
 *
 * Provides administration-related business logic operations.
 * Follows the factory pattern with dependency injection.
 *
 * @param params - Configuration object containing repository instances (optional)
 * @returns AdministrationService - An object with administration service methods.
 */
export function AdministrationService({
  administrationRepository = new AdministrationRepository(),
  authorizationService = AuthorizationService(),
}: {
  administrationRepository?: AdministrationRepository;
  authorizationService?: ReturnType<typeof AuthorizationService>;
} = {}) {
  /**
   * List administrations accessible to a user with pagination, search, and sorting.
   *
   * Users with unrestricted scope have access to all administrations.
   * Users with scoped access only see administrations they're assigned to.
   */
  async function list(
    authContext: AuthContext,
    options: AdministrationQueryOptions,
  ): Promise<PaginatedResult<Administration>> {
    const { userId, userType } = authContext;
    const scope = await authorizationService.getAdministrationsScope(userId, userType);

    // Transform API contract format to repository format
    const queryParams = {
      page: options.page,
      perPage: options.perPage,
      orderBy: {
        field: SORT_FIELD_TO_COLUMN[options.sortBy],
        direction: options.sortOrder,
      },
    };

    if (isUnrestrictedResource(scope)) {
      return administrationRepository.getAll(queryParams);
    }

    return administrationRepository.getByIds(scope.ids, queryParams);
  }

  return { list };
}
