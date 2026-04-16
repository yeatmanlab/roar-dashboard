import { StatusCodes } from 'http-status-codes';
import type { District, DistrictWithCounts } from '../../repositories/district.repository';
import { DistrictRepository } from '../../repositories/district.repository';
import { AuthorizationService } from '../authorization/authorization.service';
import { FgaType, FgaRelation } from '../authorization/fga-constants';
import { extractFgaObjectId } from '../authorization/helpers/extract-fga-object-id.helper';
import type { SchoolWithCounts } from '../../repositories/school.repository';
import { SchoolRepository } from '../../repositories/school.repository';
import { rolesForPermission } from '../../constants/role-permissions';
import { Permissions } from '../../constants/permissions';
import { hasSupervisoryRole } from '../../utils/has-supervisory-role.util';
import { ApiError } from '../../errors/api-error';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { ApiErrorMessage } from '../../enums/api-error-message.enum';
import { logger } from '../../logger';
import type { PaginatedResult } from '../../repositories/base.repository';
import type { AuthContext } from '../../types/auth-context';
import type { EnrolledUsersQuery, EnrolledUserEntity, ListEnrolledUsersOptions } from '../../types/user';
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
   * Verify that a district exists and the user has access to it.
   *
   * @param authContext - User's auth context
   * @param districtId - The district ID to verify access for
   * @returns The district if found and accessible
   * @throws {ApiError} NOT_FOUND if district doesn't exist
   * @throws {ApiError} FORBIDDEN if user lacks access
   */
  async function verifyDistrictAccess(authContext: AuthContext, districtId: string): Promise<District> {
    const { userId, isSuperAdmin } = authContext;

    // Look up the district first to distinguish 404 from 403
    const district = await districtRepository.getUnrestrictedById(districtId);

    if (!district) {
      throw new ApiError(ApiErrorMessage.NOT_FOUND, {
        statusCode: StatusCodes.NOT_FOUND,
        code: ApiErrorCode.RESOURCE_NOT_FOUND,
        context: { userId, districtId },
      });
    }

    // Super admins have unrestricted access
    if (isSuperAdmin) {
      return district;
    }

    // Check access for non-super admin users
    const allowedRoles = rolesForPermission(Permissions.Organizations.READ);
    const authorized = await districtRepository.getAuthorizedById({ userId, allowedRoles }, districtId);
    if (!authorized) {
      logger.warn({ userId, districtId }, 'User attempted to access district without permission');
      throw new ApiError(ApiErrorMessage.FORBIDDEN, {
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
        context: { userId, districtId },
      });
    }

    return authorized;
  }

  /**
   * Performs authorization checks for sub-resource listing (supervisory roles only).
   * Throws if user lacks access or is a supervised user.
   *
   * @param authContext - User's auth context (id and super admin flag)
   * @param districtId - The district ID to verify access for
   * @returns The district path if authorized
   * @throws {ApiError} NOT_FOUND if district doesn't exist
   * @throws {ApiError} FORBIDDEN if user lacks access or is a supervised user
   */
  async function authorizeSubResourceAccess(authContext: AuthContext, districtId: string): Promise<string> {
    const { userId, isSuperAdmin } = authContext;

    // Verifies user has access to organizations
    const district = await getById(authContext, districtId);

    if (isSuperAdmin) return district.path;

    const userRoles = await districtRepository.getUserRolesForDistrict(userId, districtId);

    if (!hasSupervisoryRole(userRoles)) {
      logger.warn({ userId, districtId, userRoles }, 'User lacks district supervisory role for sub-resource listing');
      throw new ApiError(ApiErrorMessage.FORBIDDEN, {
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
        context: { userId, districtId, userRoles },
      });
    }

    return district.path;
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
   * @throws {ApiError} FORBIDDEN if user lacks access to the district or has supervised role
   * @throws {ApiError} INTERNAL_SERVER_ERROR if the database query fails
   */
  async function listDistrictSchools(
    authContext: AuthContext,
    districtId: string,
    options: ListDistrictSchoolsOptions,
  ): Promise<PaginatedResult<SchoolWithCounts>> {
    const { userId, isSuperAdmin } = authContext;

    try {
      // 1. Verify district exists and user has access
      await verifyDistrictAccess(authContext, districtId);

      // 2. Check for supervisory role (non-super admins cannot list sub-resources if supervised)
      if (!isSuperAdmin) {
        const userRoles = await districtRepository.getUserRolesForDistrict(userId, districtId);

        if (!hasSupervisoryRole(userRoles)) {
          logger.warn({ userId, districtId, userRoles }, 'Supervised user attempted to list district schools');
          throw new ApiError(ApiErrorMessage.FORBIDDEN, {
            statusCode: StatusCodes.FORBIDDEN,
            code: ApiErrorCode.AUTH_FORBIDDEN,
          });
        }
      }

      // 3. Query schools for this district with access control
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

      // For super admins, get all schools in district
      if (isSuperAdmin) {
        return await schoolRepository.listAllByDistrictId(districtId, queryParams);
      }

      // For regular users, apply access control filtering
      const allowedRoles = rolesForPermission(Permissions.Organizations.LIST);
      return await schoolRepository.listAuthorizedByDistrictId({ userId, allowedRoles }, districtId, queryParams);
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
   * Returns all users who have an active enrollment in the specified district.
   * Only includes users with active enrollments (enrollment_start <= now and
   * enrollment_end is null or >= now).
   *
   * @param districtId - The district ID to get users for
   * @param options - Pagination, sorting, and filtering options
   * @returns Paginated result with users
   */
  async function listUsers(
    authContext: AuthContext,
    districtId: string,
    options: EnrolledUsersQuery,
  ): Promise<PaginatedResult<EnrolledUserEntity>> {
    const { userId, isSuperAdmin } = authContext;
    try {
      const districtPath = await authorizeSubResourceAccess(authContext, districtId);

      const queryParams: ListEnrolledUsersOptions = {
        page: options.page,
        perPage: options.perPage,
        orderBy: {
          field: options.sortBy,
          direction: options.sortOrder,
        },
        ...(options.role && { role: options.role }),
        ...(options.grade && { grade: options.grade }),
      };

      if (isSuperAdmin) {
        return await districtRepository.getUsersByDistrictPath(districtPath, queryParams);
      }

      const allowedRoles = rolesForPermission(Permissions.Users.LIST);
      return await districtRepository.getAuthorizedUsersByDistrictId(
        { userId, allowedRoles },
        districtId,
        districtPath,
        queryParams,
      );
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
