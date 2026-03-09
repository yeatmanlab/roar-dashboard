import { StatusCodes } from 'http-status-codes';
import { DistrictRepository, type District, type DistrictWithCounts } from '../../repositories/district.repository';
import { rolesForPermission } from '../../constants/role-permissions';
import { Permissions } from '../../constants/permissions';
import { ApiError } from '../../errors/api-error';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { ApiErrorMessage } from '../../enums/api-error-message.enum';
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
  // Use injected repository or create default instance.
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
   * @param authContext - User's auth context (id and super admin flag)
   * @param districtId - UUID of the district to retrieve
   * @returns The district if found and authorized
   * @throws {ApiError} 404 if not found, 403 if unauthorized, 500 on database errors
   */
  async function getById(authContext: AuthContext, districtId: string): Promise<District> {
    const { userId, isSuperAdmin } = authContext;

    try {
      // 1. Look up unrestricted first — distinguishes 404 from 403
      const district = await repo.getUnrestrictedById(districtId);
      if (!district) {
        throw new ApiError(ApiErrorMessage.NOT_FOUND, {
          statusCode: StatusCodes.NOT_FOUND,
          code: ApiErrorCode.RESOURCE_NOT_FOUND,
          context: { userId, districtId },
        });
      }

      // 2. Super admins bypass access checks
      if (isSuperAdmin) return district;

      // 3. Check access via org hierarchy joins
      const allowedRoles = rolesForPermission(Permissions.Organizations.READ);
      const authorized = await repo.getAuthorizedById({ userId, allowedRoles }, districtId);
      if (!authorized) {
        logger.warn({ userId, districtId }, 'User attempted to access district without permission');
        throw new ApiError(ApiErrorMessage.FORBIDDEN, {
          statusCode: StatusCodes.FORBIDDEN,
          code: ApiErrorCode.AUTH_FORBIDDEN,
          context: { userId, districtId },
        });
      }

      return authorized;
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
