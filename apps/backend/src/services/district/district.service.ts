import { StatusCodes } from 'http-status-codes';
import { DistrictRepository, type DistrictWithCounts } from '../../repositories/district.repository';
import { rolesForPermission } from '../../constants/role-permissions';
import { Permissions } from '../../constants/permissions';
import { ApiError } from '../../errors/api-error';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { logger } from '../../logger';
import type { PaginatedResult } from '../../repositories/base.repository';
import type { AuthContext } from '../../types/auth-context';

/**
 * Options for listing districts
 */
export interface ListOptions {
  page: number;
  perPage: number;
  sortBy: 'name' | 'abbreviation' | 'createdAt';
  sortOrder: 'asc' | 'desc';
  includeEnded?: boolean;
  embedCounts?: boolean;
}

/**
 * District with optional embedded data.
 */
export type DistrictWithEmbeds = DistrictWithCounts;

/**
 * District Service
 *
 * Business logic layer for district operations.
 * Handles authorization (super admin vs regular user) and delegates to repository.
 * Follows the factory pattern with dependency injection.
 */
export function DistrictService({
  districtRepository,
}: {
  districtRepository?: DistrictRepository;
} = {}) {
  // Lazy initialize repository to avoid creating it before database is initialized
  const repo = districtRepository ?? new DistrictRepository();
  /**
   * List districts accessible to a user with pagination and sorting.
   *
   * super_admin users have unrestricted access to all districts.
   * Other users only see districts they're assigned to via org/class/group membership.
   *
   * @param authContext - User's auth context (id and super admin flag)
   * @param options - Query options including pagination and sorting
   * @returns Paginated result with districts
   * @throws {ApiError} If the database query fails
   */
  async function list(authContext: AuthContext, options: ListOptions): Promise<PaginatedResult<DistrictWithEmbeds>> {
    const { userId, isSuperAdmin } = authContext;

    try {
      // Transform API contract format to repository format
      const queryParams = {
        page: options.page,
        perPage: options.perPage,
        orderBy: {
          field: options.sortBy,
          direction: options.sortOrder,
        },
        includeEnded: options.includeEnded ?? false,
      };

      // Fetch base districts based on user role and authorization
      const result = isSuperAdmin
        ? await repo.listAll(queryParams)
        : await repo.listAuthorized(
            { userId, allowedRoles: rolesForPermission(Permissions.Organizations.LIST) },
            queryParams,
          );

      // If counts not requested, return as-is
      if (!options.embedCounts) {
        return result;
      }

      // Early return if no items to embed data onto
      if (result.items.length === 0) {
        return result;
      }

      // Fetch and attach counts
      const districtIds = result.items.map((d) => d.id);
      const countsMap = await repo.fetchDistrictCounts(districtIds, options.includeEnded ?? false);

      return {
        items: result.items.map((district) => ({
          ...district,
          counts: countsMap.get(district.id) ?? { users: 0, schools: 0, classes: 0 },
        })),
        totalItems: result.totalItems,
      };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      logger.error({ err: error, context: { userId } }, 'Failed to list districts');

      throw new ApiError('Failed to retrieve districts', {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
        context: { userId },
        cause: error,
      });
    }
  }

  /**
   * Get a district by ID.
   *
   * Enforces access control:
   * - Super admins can access any district
   * - Regular users can only access districts where they have active membership
   *
   * @param id - District UUID
   * @param authContext - Authenticated user context
   * @returns District
   * @throws ApiError 403 if user lacks access to the district
   * @throws ApiError 404 if district not found or not a district type
   */
  async function getById(id: string, authContext: AuthContext): Promise<DistrictWithEmbeds> {
    let district: DistrictWithEmbeds | null;

    // Super admins get unrestricted access
    if (authContext.isSuperAdmin) {
      district = await repo.getByIdUnrestricted(id);
    } else {
      // Regular users need authorization checks
      const accessControlFilter = {
        userId: authContext.userId,
        allowedRoles: rolesForPermission(Permissions.Organizations.LIST),
      };

      district = await repo.getAuthorizedById(id, accessControlFilter);
    }

    if (!district) {
      // District not found or user lacks access
      // We don't distinguish between these cases for security reasons
      logger.warn({ districtId: id, userId: authContext.userId }, 'District not found or access denied');
      throw new ApiError('District not found', {
        statusCode: StatusCodes.NOT_FOUND,
        code: ApiErrorCode.RESOURCE_NOT_FOUND,
      });
    }

    return district;
  }

  return {
    list,
    getById,
  };
}

export type IDistrictService = ReturnType<typeof DistrictService>;
