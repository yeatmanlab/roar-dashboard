import { StatusCodes } from 'http-status-codes';
import type { Org } from '../../db/schema';
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
 * Options for getting a district by ID.
 */
export interface GetByIdOptions {
  embedChildren?: boolean;
}

/**
 * Option for getting administration statistics for a district.
 */
export interface GetAdministrationStatsOptions {
  taskId?: string | undefined;
}

/**
 * District with optional embedded data.
 */
export interface DistrictWithEmbeds extends DistrictWithCounts {
  children?: Org[];
}

/**
 * District Service
 *
 * Business logic layer for district operations.
 * Handles authorization (super admin vs regular user) and delegates to repository.
 * Follows the factory pattern with dependency injection.
 */
export function DistrictService({
  districtRepository = new DistrictRepository(),
}: {
  districtRepository?: DistrictRepository;
} = {}) {
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
        result = await districtRepository.listAll(queryParams);
      } else {
        const allowedRoles = rolesForPermission(Permissions.Organizations.LIST);
        result = await districtRepository.listAuthorized({ userId, allowedRoles }, queryParams);
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
   * Get a district by ID with optional embeds.
   *
   * Enforces access control:
   * - Super admins can access any district
   * - Regular users can only access districts where they have active membership
   *
   * @param id - District UUID
   * @param authContext - Authenticated user context
   * @param options - Optional embeds (children)
   * @returns District with optional embeds
   * @throws ApiError 400 if ID is invalid UUID format
   * @throws ApiError 403 if user lacks access to the district
   * @throws ApiError 404 if district not found or not a district type
   */
  async function getById(
    id: string,
    authContext: AuthContext,
    options: GetByIdOptions = {},
  ): Promise<DistrictWithEmbeds> {
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      logger.warn(`Invalid UUID format for district ID: ${id}`);
      throw new ApiError('Invalid UUID format', {
        statusCode: StatusCodes.BAD_REQUEST,
        code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
      });
    }

    // Build access control filter
    const accessControlFilter = {
      userId: authContext.userId,
      allowedRoles: rolesForPermission(Permissions.Organizations.LIST),
    };

    // Fetch district with optional embeds
    const district = await districtRepository.getByIdWithEmbeds(
      id,
      accessControlFilter,
      options.embedChildren ?? false,
    );

    if (!district) {
      // District not found or user lacks access
      // We don't distinguish between these cases for security reasons
      logger.warn(`District not found or access denied: ${id} for user ${authContext.userId}`);
      throw new ApiError('District not found', {
        statusCode: StatusCodes.NOT_FOUND,
        code: ApiErrorCode.RESOURCE_NOT_FOUND,
      });
    }

    return district;
  }

  /**
   * Get administration statistics for this district.
   *
   * Enforces access control:
   * - Super admins can access any district or administration.
   * - Regular users can only access districts where they have active
   *   membership AND are able to see the requested administration per
   *   the org hierarchy rules.
   *
   * @param districtId - District UUID
   * @param administrationId - Administration UUID
   * @param authContext - Authenticated user context
   * @param options - Optional query parameters
   * @returns Administration statistics for this district
   */
  async function getAdministrationStatsById(
    districtId: string,
    administrationId: string,
    authContext: AuthContext,
    options: GetAdministrationStatsOptions = {},
  ) {
    // 1. Pull info out from authContext
    const { userId } = authContext;
    // 2. Validate that the user has access to the district

    // 3. Validate that the administration is visible to the user per the org hierarchy rules
    // 4. Fetch the administration stats
  }

  return {
    list,
    getById,
    getAdministrationStatsById,
  };
}

export type IDistrictService = ReturnType<typeof DistrictService>;
