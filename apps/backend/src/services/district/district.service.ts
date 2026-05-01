import { StatusCodes } from 'http-status-codes';
import type { CreateDistrictInput, District, DistrictWithCounts } from '../../repositories/district.repository';
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
import type { EnrolledUserEntity, EnrolledUsersQuery, ListEnrolledUsersOptions } from '../../types/user';
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
 * Service-layer input for creating a district.
 *
 * Mirrors the API contract's CreateDistrictRequest shape (nested location and
 * identifiers). The service flattens this into the repository's column-shaped
 * CreateDistrictInput. Defined here rather than imported from the api-contract
 * so the service stays decoupled from transport concerns
 * (see backend-service-pattern.md "Service Type Independence").
 */
export interface CreateDistrictServiceInput {
  name: string;
  abbreviation: string;
  location?:
    | {
        addressLine1?: string | undefined;
        addressLine2?: string | undefined;
        city?: string | undefined;
        stateProvince?: string | undefined;
        postalCode?: string | undefined;
        country?: string | undefined;
      }
    | undefined;
  identifiers?:
    | {
        mdrNumber?: string | undefined;
        ncesId?: string | undefined;
        stateId?: string | undefined;
      }
    | undefined;
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

      // getUnrestrictedById is used deliberately here rather than getById(authContext).
      // Reasons:
      //   1. Separates 404 (district doesn't exist) from 403 (district exists but user
      //      lacks access), matching the backend-authorization-pattern rule.
      //   2. Filters by orgType=district, so a school ID passed as districtId correctly
      //      returns null → 404 rather than a false-positive existence hit.
      //   3. Avoids a redundant FGA call: getById checks can_read, but this endpoint gates
      //      on can_list. Using getById would fire two FGA checks for non-super-admins.
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

        // TODO: listObjects returns all globally accessible schools, then SQL filters to this
        // district. Acceptable for now because user school lists are small, but if FGA adds
        // scoped listing (objects within a subtree), prefer that to bound the IN clause.
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
  ): Promise<PaginatedResult<EnrolledUserEntity>> {
    const { userId, isSuperAdmin } = authContext;
    try {
      // getUnrestrictedById: separates 404 from 403, guards orgType so a school ID
      // won't masquerade as a district, and avoids firing a can_read FGA check when
      // this endpoint gates on can_list_users. See listDistrictSchools for full rationale.
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

  /**
   * Create a new district.
   *
   * Restricted to super admins. Districts are roots of the org hierarchy:
   * `parentOrgId` is null, `path` is computed by a database trigger from the
   * generated id, and `isRosteringRootOrg` is true (enforced server-side
   * because the validate_org_hierarchy_fn trigger requires root orgs to have
   * isRosteringRootOrg = true).
   *
   * No FGA tuples are written by this endpoint. FGA tuples are user-to-org
   * relationships and are written when users are assigned to the district
   * via memberships. See `packages/authz/README.md` for the FGA model.
   *
   * @param authContext - Authentication context with userId and isSuperAdmin
   * @param input - District fields the caller is allowed to set
   * @returns The new district id
   * @throws {ApiError} 403 if the caller is not a super admin
   * @throws {ApiError} 500 if the database insert fails
   */
  async function create(authContext: AuthContext, input: CreateDistrictServiceInput): Promise<{ id: string }> {
    const { userId, isSuperAdmin } = authContext;

    if (!isSuperAdmin) {
      logger.warn({ userId }, 'Non-super admin attempted to create a district');
      throw new ApiError(ApiErrorMessage.FORBIDDEN, {
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
        context: { userId },
      });
    }

    try {
      const repoInput: CreateDistrictInput = {
        name: input.name,
        abbreviation: input.abbreviation,
        ...(input.location?.addressLine1 !== undefined && { locationAddressLine1: input.location.addressLine1 }),
        ...(input.location?.addressLine2 !== undefined && { locationAddressLine2: input.location.addressLine2 }),
        ...(input.location?.city !== undefined && { locationCity: input.location.city }),
        ...(input.location?.stateProvince !== undefined && { locationStateProvince: input.location.stateProvince }),
        ...(input.location?.postalCode !== undefined && { locationPostalCode: input.location.postalCode }),
        ...(input.location?.country !== undefined && { locationCountry: input.location.country }),
        ...(input.identifiers?.mdrNumber !== undefined && { mdrNumber: input.identifiers.mdrNumber }),
        ...(input.identifiers?.ncesId !== undefined && { ncesId: input.identifiers.ncesId }),
        ...(input.identifiers?.stateId !== undefined && { stateId: input.identifiers.stateId }),
      };

      return await districtRepository.createDistrict(repoInput);
    } catch (error) {
      if (error instanceof ApiError) throw error;

      logger.error({ err: error, context: { userId } }, 'Failed to create district');

      throw new ApiError(ApiErrorMessage.INTERNAL_SERVER_ERROR, {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
        context: { userId },
        cause: error,
      });
    }
  }

  return {
    create,
    list,
    listUsers,
    getById,
    listDistrictSchools,
  };
}

export type IDistrictService = ReturnType<typeof DistrictService>;
