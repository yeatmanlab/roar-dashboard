import { StatusCodes } from 'http-status-codes';
import type { District, DistrictWithCounts } from '../../repositories/district.repository';
import { DistrictRepository } from '../../repositories/district.repository';
import { AuthorizationService } from '../authorization/authorization.service';
import { FgaType, FgaRelation } from '../authorization/fga-constants';
import { extractFgaObjectId } from '../authorization/helpers/extract-fga-object-id.helper';
import type { SchoolWithCounts } from '../../repositories/school.repository';
import { SchoolRepository } from '../../repositories/school.repository';
import { ApiError } from '../../errors/api-error';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { ApiErrorMessage } from '../../enums/api-error-message.enum';
import { logger } from '../../logger';
import type { PaginatedResult } from '../../repositories/base.repository';
import type { AuthContext } from '../../types/auth-context';
import type { EnrolledUsersQuery, EnrolledOrgUserEntity, ListEnrolledUsersOptions } from '../../types/user';
/**
 * Options for listing districts
 */
export interface ListOptions {
  page: number;
  perPage: number;
  sortBy: 'name' | 'abbreviation';
  sortOrder: 'asc' | 'desc';
  includeEnded?: boolean;
  embedCounts?: boolean;
}

/**
 * Options for listing schools within a district
 */
export interface ListDistrictSchoolsOptions {
  page: number;
  perPage: number;
  sortBy: 'name' | 'abbreviation';
  sortOrder: 'asc' | 'desc';
  includeEnded?: boolean;
  embedCounts?: boolean;
}

/**
 * District with optional embeds
 * Note: children embed will be added in future GET /districts/:id implementation
 */
export type DistrictWithEmbeds = DistrictWithCounts;

/**
 * District Service
 *
 * Business logic layer for district operations.
 * Handles authorization (super admin vs regular user) and delegates to repository.
 */
export function DistrictService({
  districtRepository = new DistrictRepository(),
  authorizationService = AuthorizationService(),
  schoolRepository = new SchoolRepository(),
}: {
  districtRepository?: DistrictRepository;
  authorizationService?: ReturnType<typeof AuthorizationService>;
  schoolRepository?: SchoolRepository;
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

    let result: PaginatedResult<DistrictWithEmbeds>;

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
        // FGA resolves which districts the user can access based on their
        // role memberships and the org hierarchy
        const objects = await authorizationService.listAccessibleObjects(
          userId,
          FgaRelation.CAN_LIST,
          FgaType.DISTRICT,
        );
        const ids = objects.map(extractFgaObjectId);
        if (ids.length === 0) {
          return { items: [], totalItems: 0 };
        }
        result = await districtRepository.listByIds(ids, queryParams);
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
      const district = await districtRepository.getUnrestrictedById(districtId);

      if (!district) {
        throw new ApiError(ApiErrorMessage.NOT_FOUND, {
          statusCode: StatusCodes.NOT_FOUND,
          code: ApiErrorCode.RESOURCE_NOT_FOUND,
          context: { userId, districtId },
        });
      }

      // 2. Super admins bypass access checks
      if (isSuperAdmin) return district;

      // 3. Check access via FGA permission check
      await authorizationService.requirePermission(userId, FgaRelation.CAN_READ, `${FgaType.DISTRICT}:${districtId}`);

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

  /**
   * List schools within a district with access control.
   *
   * Authorization behavior:
   * - Super admin: sees all schools in the district
   * - Supervisory roles: sees only schools within their accessible org tree
   * - Supervised roles (student/guardian/parent/relative): returns 403 Forbidden
   *
   * @param authContext - User's auth context (id and type)
   * @param districtId - The district ID to get schools for
   * @param options - Pagination and sorting options
   * @returns Paginated result with schools
   * @throws {ApiError} NOT_FOUND if district doesn't exist
   * @throws {ApiError} FORBIDDEN if user lacks access to the district
   * @throws {ApiError} INTERNAL_SERVER_ERROR if the database query fails
   */
  async function listDistrictSchools(
    authContext: AuthContext,
    districtId: string,
    options: ListDistrictSchoolsOptions,
  ): Promise<PaginatedResult<SchoolWithCounts>> {
    const { userId, isSuperAdmin } = authContext;

    try {
      // Transform API contract format to repository format
      const listOptions = {
        page: options.page,
        perPage: options.perPage,
        orderBy: {
          field: options.sortBy,
          direction: options.sortOrder,
        },
        includeEnded: options.includeEnded ?? false,
        embedCounts: options.embedCounts ?? false,
      };

      const district = await districtRepository.getUnrestrictedById(districtId);

      if (!district) {
        throw new ApiError(ApiErrorMessage.NOT_FOUND, {
          statusCode: StatusCodes.NOT_FOUND,
          code: ApiErrorCode.RESOURCE_NOT_FOUND,
          context: { userId, districtId },
        });
      }

      if (!isSuperAdmin) {
        await authorizationService.requirePermission(userId, FgaRelation.CAN_LIST, `${FgaType.DISTRICT}:${districtId}`);

        const objects = await authorizationService.listAccessibleObjects(userId, FgaRelation.CAN_LIST, FgaType.SCHOOL);
        const accessibleSchools = objects.map(extractFgaObjectId);

        if (!accessibleSchools.length) {
          return { items: [], totalItems: 0 };
        }

        return await schoolRepository.listAccessibleByDistrictId(districtId, accessibleSchools, listOptions);
      }

      // Super admins get unrestricted access to all schools in the district
      return await schoolRepository.listAllByDistrictId(districtId, listOptions);
    } catch (error) {
      if (error instanceof ApiError) throw error;

      logger.error({ err: error, context: { userId, districtId, options } }, 'Failed to list district schools');

      throw new ApiError(ApiErrorMessage.INTERNAL_SERVER_ERROR, {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
        context: { userId, districtId },
        cause: error,
      });
    }
  }

  /**
   * Get users enrolled in a district.
   *
   * super_admin users can see all enrolled users.
   * Other users can only see enrolled users if they have the `can_list_users` permission on the district.
   *
   * Returns all users who have an active enrollment in the specified district.
   * Only includes users with active enrollments (enrollment_start <= now and
   * enrollment_end is null or >= now).
   *
   * @param authContext - User's auth context (id and super admin flag)
   * @param districtId - The district ID to get enrolled users for
   * @param options - Pagination, sorting, and filtering options
   * @returns Paginated result with users
   * @throws {ApiError} NOT_FOUND if district doesn't exist
   * @throws {ApiError} FORBIDDEN if user lacks access to the district
   * @throws {ApiError} INTERNAL_SERVER_ERROR if the database query fails
   */
  async function listUsers(
    authContext: AuthContext,
    districtId: string,
    options: EnrolledUsersQuery,
  ): Promise<PaginatedResult<EnrolledOrgUserEntity>> {
    const { userId, isSuperAdmin } = authContext;
    try {
      const district = await districtRepository.getUnrestrictedById(districtId);

      if (!district) {
        throw new ApiError(ApiErrorMessage.NOT_FOUND, {
          statusCode: StatusCodes.NOT_FOUND,
          code: ApiErrorCode.RESOURCE_NOT_FOUND,
          context: { userId, districtId },
        });
      }

      const queryParams: ListEnrolledUsersOptions = {
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
          `${FgaType.DISTRICT}:${districtId}`,
        );
      }
      return await districtRepository.getUsersByDistrictPath(district.path, queryParams);
    } catch (error) {
      if (error instanceof ApiError) throw error;

      logger.error({ err: error, context: { userId, districtId, options } }, 'Failed to list district users');

      throw new ApiError('Failed to retrieve district users', {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
        context: { userId, districtId },
        cause: error,
      });
    }
  }

  return {
    list,
    listUsers,
    getById,
    listDistrictSchools,
  };
}

export type IDistrictService = ReturnType<typeof DistrictService>;
