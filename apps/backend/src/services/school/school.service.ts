import { StatusCodes } from 'http-status-codes';
import type { SchoolWithCounts } from '../../repositories/school.repository';
import { SchoolRepository } from '../../repositories/school.repository';
import { ApiError } from '../../errors/api-error';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { ApiErrorMessage } from '../../enums/api-error-message.enum';
import { logger } from '../../logger';
import type { PaginatedResult } from '../../repositories/base.repository';
import type { AuthContext } from '../../types/auth-context';
import { AuthorizationService } from '../authorization/authorization.service';
import { FgaType, FgaRelation } from '../authorization/fga-constants';
import { extractFgaObjectId } from '../authorization/helpers/extract-fga-object-id.helper';

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
 * School Service
 *
 * Business logic layer for school operations.
 * Handles authorization (super admin vs regular user) and delegates to repository.
 */
export function SchoolService({
  schoolRepository = new SchoolRepository(),
  authorizationService = AuthorizationService(),
}: {
  schoolRepository?: SchoolRepository;
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

  return {
    list,
    getById,
  };
}

export type ISchoolService = ReturnType<typeof SchoolService>;
