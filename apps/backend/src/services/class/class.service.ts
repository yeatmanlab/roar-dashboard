import { StatusCodes } from 'http-status-codes';
import { ClassRepository } from '../../repositories/class.repository';
import type { User, Class } from '../../db/schema';
import { rolesForPermission } from '../../constants/role-permissions';
import { Permissions } from '../../constants/permissions';
import { ApiError } from '../../errors/api-error';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { ApiErrorMessage } from '../../enums/api-error-message.enum';
import { logger } from '../../logger';
import type { PaginatedResult } from '../../repositories/base.repository';
import type { UserSortField } from '@roar-dashboard/api-contract';
import type { AuthContext } from '../../types/auth-context';
import { hasSupervisoryRole } from '../../utils/has-supervisory-role.util';

export interface ListUserOptions {
  page: number;
  perPage: number;
  sortBy: UserSortField;
  sortOrder: 'asc' | 'desc';
}

export function ClassService({
  classRepository = new ClassRepository(),
}: {
  classRepository?: ClassRepository;
} = {}) {
  /**
   * Verify that a class exists and the user has access to it.
   *
   * Performs a two-step check:
   * 1. Verify the class exists (returns 404 if not)
   * 2. Verify the user has access (returns 403 if not, skipped for super admins)
   *
   * @param authContext - User's auth context (id and super admin flag)
   * @param classId - The class ID to verify access for
   * @returns The class if found and accessible
   * @throws {ApiError} NOT_FOUND if class doesn't exist
   * @throws {ApiError} FORBIDDEN if user lacks access
   */
  async function verifyClassAccess(authContext: AuthContext, classId: string): Promise<Class> {
    const { userId, isSuperAdmin } = authContext;

    const classEntity = await classRepository.getById({ id: classId });

    if (!classEntity) {
      throw new ApiError('Class not found', {
        statusCode: StatusCodes.NOT_FOUND,
        code: ApiErrorCode.RESOURCE_NOT_FOUND,
        context: { userId, classId },
      });
    }

    if (isSuperAdmin) {
      return classEntity;
    }

    const allowedRoles = rolesForPermission(Permissions.Classes.LIST);
    const authorized = await classRepository.getAuthorizedById({ userId, allowedRoles }, classId);

    if (!authorized) {
      logger.warn({ userId, classId }, 'User attempted to access administration without permission');
      throw new ApiError(ApiErrorMessage.FORBIDDEN, {
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
        context: { userId, classId },
      });
    }

    return authorized;
  }

  /**
   * Performs authorization checks for sub-resource listing (supervisory roles only).
   * Throws if user lacks access or is a supervised user.
   *
   * @param authContext - User's auth context (id and super admin flag)
   * @param classId - The class ID to verify access for
   * @throws {ApiError} NOT_FOUND if class doesn't exist
   * @throws {ApiError} FORBIDDEN if user lacks access or is a supervised user
   */
  async function authorizeSubResourceAccess(authContext: AuthContext, classId: string): Promise<void> {
    const { userId, isSuperAdmin } = authContext;

    await verifyClassAccess(authContext, classId);

    if (isSuperAdmin) return;

    const userRoles = await classRepository.getUserRolesForClass(userId, classId);

    if (!hasSupervisoryRole(userRoles)) {
      logger.warn({ userId, classId, userRoles }, 'Supervised user attempted to list class sub-resources');
      throw new ApiError(ApiErrorMessage.FORBIDDEN, {
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
      });
    }
  }

  /**
   * List users assigned to a class with access control.
   *
   * Authorization behavior:
   * - Super admin: sees all users assigned to the class
   * - Supervisory roles: sees only users if assigned to that class or if they belong to orgs in their accessible org tree
   *   - Excludes caregiver role
   * - Supervised roles (student/guardian/parent/relative): returns 403 Forbidden
   *
   * @param authContext - User's auth context (id and type)
   * @param classId - The class ID to get users for
   * @param options - Pagination and sorting options
   * @returns Paginated result with users
   * @throws {ApiError} NOT_FOUND if class doesn't exist
   * @throws {ApiError} FORBIDDEN if user lacks access to the class or has supervised role
   * @throws {ApiError} INTERNAL_SERVER_ERROR if the database query fails
   */
  async function listUsers(
    authContext: AuthContext,
    classId: string,
    options: ListUserOptions,
  ): Promise<PaginatedResult<User>> {
    const { userId, isSuperAdmin } = authContext;

    try {
      await authorizeSubResourceAccess(authContext, classId);

      const queryParams = {
        page: options.page,
        perPage: options.perPage,
        orderBy: {
          field: options.sortBy,
          direction: options.sortOrder,
        },
      };

      if (!isSuperAdmin) {
        const allowedRoles = rolesForPermission(Permissions.Users.LIST);
        const userRoles = await classRepository.getUserRolesForClass(userId, classId);
        if (!userRoles.some((role) => allowedRoles.includes(role))) {
          throw new ApiError(ApiErrorMessage.FORBIDDEN, {
            statusCode: StatusCodes.FORBIDDEN,
            code: ApiErrorCode.AUTH_FORBIDDEN,
          });
        }
      }

      return await classRepository.getUsersByClassId(classId, queryParams);
    } catch (error) {
      if (error instanceof ApiError) throw error;

      logger.error({ err: error, context: { userId, classId, options } }, 'Failed to list class users');

      throw new ApiError('Failed to retrieve class users', {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
        context: { userId, classId },
        cause: error,
      });
    }
  }

  return {
    listUsers,
  };
}
