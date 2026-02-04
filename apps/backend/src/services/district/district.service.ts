import { StatusCodes } from 'http-status-codes';
import { DistrictRepository, type District, type DistrictWithCounts } from '../../repositories/district.repository';
import { rolesForPermission } from '../../constants/role-permissions';
import { Permissions } from '../../constants/permissions';
import { ApiError } from '../../errors/api-error';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { logger } from '../../logger';
import type { PaginatedResult } from '../../repositories/base.repository';

/**
 * Auth context passed from controller/middleware
 */
export interface AuthContext {
  userId: string;
  isSuperAdmin: boolean;
}

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
 * District Service Dependencies (for testing)
 */
export interface DistrictServiceDeps {
  districtRepository?: DistrictRepository;
}

/**
 * Sort field mapping from API contract to database columns
 */
const SORT_FIELD_TO_COLUMN: Record<string, string> = {
  name: 'name',
  abbreviation: 'abbreviation',
  createdAt: 'createdAt',
};

/**
 * District Service
 *
 * Business logic layer for district operations.
 * Handles authorization (super admin vs regular user) and delegates to repository.
 */
export function DistrictService(deps: DistrictServiceDeps = {}) {
  const districtRepository = deps.districtRepository ?? new DistrictRepository();

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
          field: SORT_FIELD_TO_COLUMN[options.sortBy] ?? 'createdAt',
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
      if (error instanceof ApiError) throw error;

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
   * super_admin users have unrestricted access to any district.
   * Other users can only access districts they're assigned to via org/class/group membership.
   *
   * @param authContext - User's auth context (id and super admin flag)
   * @param id - District ID
   * @param options - Options for embedding children
   * @returns District or null if not found or user lacks access
   * @throws {ApiError} If the database query fails
   */
  async function getById(
    authContext: AuthContext,
    id: string,
    options: { embedChildren?: boolean } = {},
  ): Promise<DistrictWithEmbeds | null> {
    const { userId, isSuperAdmin } = authContext;
    const { embedChildren = false } = options;

    let district: District | null;

    try {
      // Fetch district based on user role and authorization
      if (isSuperAdmin) {
        district = await districtRepository.getById(id);
      } else {
        const allowedRoles = rolesForPermission(Permissions.Organizations.LIST);
        district = await districtRepository.getByIdAuthorized(id, { userId, allowedRoles });
      }

      if (!district) {
        return null;
      }

      // Fetch children if requested
      if (embedChildren) {
        const children = await districtRepository.getChildren(id, false);
        return { ...district, children };
      }

      return district;
    } catch (error) {
      logger.error({ err: error, context: { userId, districtId: id } }, 'Failed to get district by ID');

      throw new ApiError('Failed to retrieve district', {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
        context: { userId, districtId: id },
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
