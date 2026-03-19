import { StatusCodes } from 'http-status-codes';
import type { AuthContext } from '../../types/auth-context';
import type { User } from '../../db/schema';
import { Permissions, type Permission } from '../../constants/permissions';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { ApiErrorMessage } from '../../enums/api-error-message.enum';
import { ApiError } from '../../errors/api-error';
import { logger } from '../../logger';
import { UserRepository } from '../../repositories/user.repository';
import { rolesForPermission } from '../../constants/role-permissions';

/**
 * UserService
 *
 * Provides user-related business logic operations.
 * Follows the firebase-functions factory pattern with dependency injection.
 * Repository is auto-instantiated by default, but can be injected for testing.
 *
 * @param params - Configuration object containing repository instances (optional)
 * @returns UserService - An object with user service methods.
 *
 * @example
 * ```typescript
 * // Production usage (auto-instantiates repository)
 * const user = await UserService().findByAuthId('firebase-uid');
 *
 * // Testing usage (inject mock)
 * const userService = UserService({ userRepository: mockRepo });
 * ```
 */
export function UserService({
  userRepository = new UserRepository(),
}: {
  userRepository?: UserRepository;
} = {}) {
  /**
   * Verify that a user exists and that the requestor has the required permission.
   *
   * Performs a two-step check:
   * 1. Looks up the user by ID to verify they exist
   * 2. Checks if the requestor is a super admin or has the required permission
   *
   * @param authContext - User's auth context (id and super admin flag)
   * @param id - The user's ID to verify
   * @param permission - The permission to check (default: Permissions.Users.READ)
   * @returns The user record if access is granted, null otherwise
   * @throws {ApiError} NOT_FOUND if user doesn't exist
   * @throws {ApiError} FORBIDDEN if user doesn't have the required permission
   * @throws {ApiError} INTERNAL_SERVER_ERROR if the database query fails
   */
  async function verifySupervisoryAccess(
    authContext: AuthContext,
    id: string,
    permission: Permission = Permissions.Users.READ,
  ): Promise<User> {
    const { userId, isSuperAdmin } = authContext;

    // Look up the user first to distinguish between not found and permission issues
    const user = await userRepository.getById({ id });

    if (!user) {
      throw new ApiError(ApiErrorMessage.NOT_FOUND, {
        statusCode: StatusCodes.NOT_FOUND,
        code: ApiErrorCode.RESOURCE_NOT_FOUND,
        context: { id, userId },
      });
    }

    // Super admins bypass permission checks
    if (isSuperAdmin) {
      return user;
    }

    // Users can always access their own profile
    // Fast path - no database query needed
    if (userId === id) {
      return user;
    }

    // Check access for non-super admin users
    const allowedRoles = rolesForPermission(permission);
    const authorized = await userRepository.getAuthorizedById({ userId, allowedRoles }, id);

    if (!authorized) {
      logger.warn({ userId, id }, 'User attempted to access another user without permission');
      throw new ApiError(ApiErrorMessage.FORBIDDEN, {
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
        context: { userId, id },
      });
    }
    return authorized;
  }

  /**
   * Find a user by their Firebase authentication ID.
   *
   * @param authId - The Firebase UID to look up.
   * @returns The user record if found, null otherwise.
   * @throws {ApiError} If the database query fails.
   */
  async function findByAuthId(authId: string): Promise<User | null> {
    try {
      return await userRepository.findByAuthId(authId);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error({ err: error, context: { authId } }, 'Failed to find user by auth ID');
      throw new ApiError('Failed to retrieve user', {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
        context: { authId },
        cause: error,
      });
    }
  }

  /**
   * Get a user by their ID with access control.
   *
   * A user can access their own record.
   * Users with supervisory roles can access users in their district, school, or class.
   * Super admin users can access any user.
   *
   *
   * @param id - The user's UUID.
   * @returns The user record if found, null otherwise.
   * @throws {ApiError} If the database query fails.
   */
  async function getById(authContext: AuthContext, id: string): Promise<User> {
    const { userId } = authContext;

    try {
      return await verifySupervisoryAccess(authContext, id);
    } catch (error) {
      if (error instanceof ApiError) throw error;

      logger.error({ err: error, context: { userId } }, 'Failed to get user by ID');

      throw new ApiError(ApiErrorMessage.INTERNAL_SERVER_ERROR, {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
        context: { userId, requestedUserId: id },
        cause: error,
      });
    }
  }

  return { findByAuthId, getById };
}
