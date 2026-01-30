import { StatusCodes } from 'http-status-codes';
import { DistrictRepository, type District } from '../../repositories/district.repository';
import { rolesForPermission } from '../../constants/role-permissions';
import { Permissions } from '../../constants/permissions';
import { ApiError, ApiErrorCode } from '../../errors/api-error';
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
}

/**
 * District with optional embeds
 */
export interface DistrictWithEmbeds extends District {
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
          field: SORT_FIELD_TO_COLUMN[options.sortBy],
          direction: options.sortOrder,
        },
        includeEnded: options.includeEnded ?? false,
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
   * @param authContext - User's auth context
   * @param id - District ID
   * @returns District or null if not found
   * @throws {ApiError} If the database query fails
   */
  async function getById(authContext: AuthContext, id: string): Promise<District | null> {
    const { userId } = authContext;

    try {
      return await districtRepository.getById(id);
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

  /**
   * Get child organizations of a district.
   *
   * @param authContext - User's auth context
   * @param districtId - Parent district ID
   * @param includeEnded - Whether to include organizations with rosteringEnded set
   * @returns List of child organizations
   * @throws {ApiError} If the database query fails
   */
  async function getChildren(authContext: AuthContext, districtId: string, includeEnded = false): Promise<District[]> {
    const { userId } = authContext;

    try {
      return await districtRepository.getChildren(districtId, includeEnded);
    } catch (error) {
      logger.error({ err: error, context: { userId, districtId } }, 'Failed to get district children');

      throw new ApiError('Failed to retrieve district children', {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
        context: { userId, districtId },
        cause: error,
      });
    }
  }

  return {
    list,
    getById,
    getChildren,
  };
}

export type IDistrictService = ReturnType<typeof DistrictService>;
