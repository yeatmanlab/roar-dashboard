import { StatusCodes } from 'http-status-codes';
import { DistrictRepository, type District, type DistrictWithCounts } from '../../repositories/district.repository';
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
 * District with optional embeds
 */
export interface DistrictWithEmbeds extends DistrictWithCounts {
  children?: District[];
}

/**
 * District Service
 *
 * Business logic layer for district operations.
 * Handles authorization (super admin vs regular user) and delegates to repository.
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

    let result;

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
        embedCounts: options.embedCounts ?? false,
      };

      // Fetch districts based on user role and authorization
      if (isSuperAdmin) {
        result = await repo.listAll(queryParams);
      } else {
        const allowedRoles = rolesForPermission(Permissions.Organizations.LIST);
        result = await repo.listAuthorized({ userId, allowedRoles }, queryParams);
      }
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

    return result;
  }

  /**
   * Get a single district by ID.
   *
   * super_admin users can access any district.
   * Other users can only access districts they're assigned to.
   *
   * @param districtId - UUID of the district to retrieve
   * @param authContext - User's auth context (id and super admin flag)
   * @returns The district if found and authorized
   * @throws {ApiError} 404 if not found or not authorized, 500 on database errors
   */
  async function getById(districtId: string, authContext: AuthContext): Promise<District> {
    const { userId, isSuperAdmin } = authContext;

    try {
      let district;

      if (isSuperAdmin) {
        district = await repo.getByIdUnrestricted(districtId);
      } else {
        const allowedRoles = rolesForPermission(Permissions.Organizations.READ);
        district = await repo.getAuthorizedById(districtId, { userId, allowedRoles });
      }

      if (!district) {
        logger.warn({ districtId, userId }, 'District not found or access denied');
        throw new ApiError('District not found', {
          statusCode: StatusCodes.NOT_FOUND,
          code: ApiErrorCode.RESOURCE_NOT_FOUND,
          context: { districtId, userId },
        });
      }

      return district;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      logger.error({ err: error, context: { districtId, userId } }, 'Failed to retrieve district');

      throw new ApiError('Failed to retrieve district', {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
        context: { districtId, userId },
        cause: error,
      });
    }
  }

  return {
    list,
    getById,
  };
}

export type IDistrictService = ReturnType<typeof DistrictService>;
