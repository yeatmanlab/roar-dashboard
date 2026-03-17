import { StatusCodes } from 'http-status-codes';
import { SchoolRepository, type School, type SchoolWithCounts } from '../../repositories/school.repository';
import { rolesForPermission } from '../../constants/role-permissions';
import { Permissions } from '../../constants/permissions';
import { ApiError } from '../../errors/api-error';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { logger } from '../../logger';
import type { PaginatedResult } from '../../repositories/base.repository';
import type { AuthContext } from '../../types/auth-context';

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
export interface SchoolWithEmbeds extends SchoolWithCounts {
  children?: School[];
}

/**
 * School Service
 *
 * Business logic layer for school operations.
 * Handles authorization (super admin vs regular user) and delegates to repository.
 */
export function SchoolService({
  schoolRepository,
}: {
  schoolRepository?: SchoolRepository;
} = {}) {
  // Use injected repository or create default instance.
  const repo = schoolRepository ?? new SchoolRepository();

  /**
   * List schools accessible to a user with pagination and sorting.
   *
   * super_admin users have unrestricted access to all schools.
   * Other users only see schools they're assigned to via org/class/group membership.
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
        result = await repo.listAll(queryParams);
      } else {
        const allowedRoles = rolesForPermission(Permissions.Organizations.LIST);
        result = await repo.listAuthorized({ userId, allowedRoles }, queryParams);
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

  return {
    list,
  };
}

export type ISchoolService = ReturnType<typeof SchoolService>;
