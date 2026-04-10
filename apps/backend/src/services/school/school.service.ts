import { StatusCodes } from 'http-status-codes';
import type { SchoolWithCounts } from '../../repositories/school.repository';
import { SchoolRepository } from '../../repositories/school.repository';
import { ApiError } from '../../errors/api-error';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { ApiErrorMessage } from '../../enums/api-error-message.enum';
import { logger } from '../../logger';
import type { PaginatedResult } from '../../repositories/base.repository';
import type { AuthContext } from '../../types/auth-context';
import type { Class } from '../../db/schema';
import { ClassRepository } from '../../repositories/class.repository';
import type { ParsedFilter, FilterOperator } from '../../types/filter';
import { AuthorizationService } from '../authorization/authorization.service';
import { FgaType, FgaRelation } from '../authorization/fga-constants';
import { extractFgaObjectId } from '../authorization/helpers/extract-fga-object-id.helper';

/** Type safe constant for 'eq' filter operator */
const EQ_OPERATOR: FilterOperator = 'eq';

/**
 * Options for listing schools
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
 * School with optional embeds
 */
export type SchoolWithEmbeds = SchoolWithCounts;

/**
 * Options for listing school classes
 */
export interface ListSchoolClassesOptions {
  page: number;
  perPage: number;
  sortBy: 'name' | 'createdAt';
  sortOrder: 'asc' | 'desc';
  filter?: ParsedFilter[];
}

/**
 * School Service
 *
 * Business logic layer for school operations.
 * Handles authorization (super admin vs regular user) and delegates to repository.
 */
export function SchoolService({
  schoolRepository = new SchoolRepository(),
  classRepository = new ClassRepository(),
  authorizationService = AuthorizationService(),
}: {
  schoolRepository?: SchoolRepository;
  classRepository?: ClassRepository;
  authorizationService?: ReturnType<typeof AuthorizationService>;
} = {}) {
  /**
   * List schools accessible to a user with pagination and sorting.
   *
   * Authorization:
   * - Super admins have unrestricted access to all schools
   * - Regular users see only schools for which FGA grants can_list
   *
   * @param authContext - User's auth context (id and super admin flag)
   * @param options - Query options including pagination and sorting
   * @returns Paginated result with schools
   * @throws {ApiError} If the database query fails
   */
  async function list(authContext: AuthContext, options: ListOptions): Promise<PaginatedResult<SchoolWithEmbeds>> {
    const { userId, isSuperAdmin } = authContext;

    let result: PaginatedResult<SchoolWithEmbeds>;

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

      // Fetch schools based on user role and authorization
      if (isSuperAdmin) {
        result = await schoolRepository.listAll(queryParams);
      } else {
        // Resolve accessible school IDs from FGA, then fetch by those IDs
        const fgaObjects = await authorizationService.listAccessibleObjects(
          userId,
          FgaRelation.CAN_LIST,
          FgaType.SCHOOL,
        );
        const schoolIds = fgaObjects.map(extractFgaObjectId);

        if (schoolIds.length === 0) {
          return { items: [], totalItems: 0 };
        }

        result = await schoolRepository.listByIds(schoolIds, queryParams);
      }
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      logger.error({ err: error, context: { userId } }, 'Failed to list schools');

      throw new ApiError('Failed to retrieve schools', {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
        context: { userId },
        cause: error,
      });
    }

    return result;
  }

  /**
   * Get a single school by ID.
   *
   * Authorization:
   * - Super admins can retrieve any school
   * - Regular users can only retrieve schools for which they are an active member
   *
   * @param authContext - User's auth context (id and super admin flag)
   * @param schoolId - UUID of the school to retrieve
   * @returns The school if found and authorized
   * @throws {ApiError} 404 if not found, 403 if unauthorized, 500 on database errors
   */
  async function getById(authContext: AuthContext, schoolId: string): Promise<SchoolWithEmbeds> {
    const { userId, isSuperAdmin } = authContext;

    try {
      // 1. Look up unrestricted first — distinguishes 404 from 403
      const school = await schoolRepository.getUnrestrictedById(schoolId);
      if (!school) {
        throw new ApiError(ApiErrorMessage.NOT_FOUND, {
          statusCode: StatusCodes.NOT_FOUND,
          code: ApiErrorCode.RESOURCE_NOT_FOUND,
          context: { userId, schoolId },
        });
      }

      // 2. Super admins bypass access checks
      if (isSuperAdmin) {
        return school;
      }

      // 3. Check access via FGA
      await authorizationService.requirePermission(userId, FgaRelation.CAN_READ, `${FgaType.SCHOOL}:${schoolId}`);

      // 4. Check if school has ended rostering (business rule, not authorization)
      // Return 404 instead of showing ended schools to regular users
      if (school.rosteringEnded) {
        throw new ApiError(ApiErrorMessage.NOT_FOUND, {
          statusCode: StatusCodes.NOT_FOUND,
          code: ApiErrorCode.RESOURCE_NOT_FOUND,
          context: { userId, schoolId },
        });
      }

      return school;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      logger.error({ err: error, context: { schoolId, userId } }, 'Failed to retrieve school');

      throw new ApiError('Failed to retrieve school', {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
        context: { schoolId, userId },
        cause: error,
      });
    }
  }

  /**
   * Authorize sub-resource access (requires supervisory role via FGA).
   *
   * Checks that the school exists and the user has can_list_users permission,
   * which requires supervisory_tier_group in the FGA model.
   *
   * @param authContext - User's auth context (id and super admin flag)
   * @param schoolId - The school ID to verify access for
   * @throws {ApiError} NOT_FOUND if school doesn't exist
   * @throws {ApiError} FORBIDDEN if user lacks supervisory permission
   */
  async function authorizeSchoolSubResourceAccess(authContext: AuthContext, schoolId: string): Promise<void> {
    const { userId } = authContext;

    // Verify school exists (404 before 403)
    const school = await schoolRepository.getUnrestrictedById(schoolId);
    if (!school) {
      throw new ApiError(ApiErrorMessage.NOT_FOUND, {
        statusCode: StatusCodes.NOT_FOUND,
        code: ApiErrorCode.RESOURCE_NOT_FOUND,
        context: { userId, schoolId },
      });
    }

    // FGA handles both access check and supervisory role requirement
    await authorizationService.requirePermission(userId, FgaRelation.CAN_LIST_CLASSES, `${FgaType.SCHOOL}:${schoolId}`);
  }

  /**
   * List classes in a school with access control.
   *
   * Authorization behavior:
   * - Super admin: sees all active classes in the school
   * - Supervisory roles: sees all active classes in the school
   * - Supervised roles: returns 403 Forbidden
   *
   * @param authContext - User's auth context (id and super admin flag)
   * @param schoolId - The school ID to list classes for
   * @param options - Pagination, sorting, and filtering options
   * @returns Paginated result with classes
   * @throws {ApiError} NOT_FOUND if school doesn't exist
   * @throws {ApiError} FORBIDDEN if user lacks supervisory permission
   * @throws {ApiError} INTERNAL_SERVER_ERROR if the database query fails
   */
  async function listSchoolClasses(
    authContext: AuthContext,
    schoolId: string,
    options: ListSchoolClassesOptions,
  ): Promise<PaginatedResult<Class>> {
    const { userId } = authContext;

    try {
      // Validate filter operators — only 'eq' is supported for class filters
      if (options.filter) {
        for (const f of options.filter) {
          if (f.operator !== EQ_OPERATOR) {
            throw new ApiError(ApiErrorMessage.REQUEST_VALIDATION_FAILED, {
              statusCode: StatusCodes.BAD_REQUEST,
              code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
              context: { userId, field: f.field, operator: f.operator },
            });
          }
        }
      }

      // Verify school access and user has supervisory role
      await authorizeSchoolSubResourceAccess(authContext, schoolId);

      // All authorized users (super admin and supervisory) can list classes
      const result = await classRepository.listBySchoolId(schoolId, {
        page: options.page,
        perPage: options.perPage,
        orderBy: {
          field: options.sortBy,
          direction: options.sortOrder,
        },
        ...(options.filter ? { filter: options.filter } : {}),
      });

      return result;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      logger.error({ err: error, context: { userId, schoolId, options } }, 'Failed to list school classes');

      throw new ApiError(ApiErrorMessage.INTERNAL_SERVER_ERROR, {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
        context: { userId, schoolId },
        cause: error,
      });
    }
  }

  return {
    list,
    getById,
    listSchoolClasses,
  };
}

export type ISchoolService = ReturnType<typeof SchoolService>;
