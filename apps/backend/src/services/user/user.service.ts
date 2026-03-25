import type { AuthContext } from '../../types/auth-context';
import type { User } from '../../db/schema';
import type { UserType } from '../../enums/user-type.enum';
import type { Grade } from '../../enums/grade.enum';
import type { FreeReducedLunchStatus } from '../../enums/frl-status.enum';
import type { Permission } from '../../constants/permissions';
import { StatusCodes } from 'http-status-codes';
import { Permissions } from '../../constants/permissions';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { ApiErrorMessage } from '../../enums/api-error-message.enum';
import { ApiError } from '../../errors/api-error';
import { isUniqueViolation, unwrapDrizzleError } from '../../errors';
import { logger } from '../../logger';
import { UserRepository } from '../../repositories/user.repository';
import { rolesForPermission } from '../../constants/role-permissions';

/**
 * The subset of user fields that may be updated via PATCH /users/:id.
 *
 * System-managed fields (id, assessmentPid, authId, authProvider, isSuperAdmin,
 * schoolLevel, createdAt, updatedAt) are intentionally excluded.
 *
 * All fields are optional — only those present in the request body are applied.
 * Nullable fields may be set to null to clear their stored value.
 */
interface UpdateUserData {
  nameFirst?: string | null | undefined;
  nameMiddle?: string | null | undefined;
  nameLast?: string | null | undefined;
  username?: string | null | undefined;
  email?: string | null | undefined;
  userType?: UserType | undefined;
  dob?: string | null | undefined;
  grade?: Grade | null | undefined;
  statusEll?: string | null | undefined;
  statusFrl?: FreeReducedLunchStatus | null | undefined;
  statusIep?: string | null | undefined;
  studentId?: string | null | undefined;
  sisId?: string | null | undefined;
  stateId?: string | null | undefined;
  localId?: string | null | undefined;
  gender?: string | null | undefined;
  race?: string | null | undefined;
  hispanicEthnicity?: boolean | null | undefined;
  homeLanguage?: string | null | undefined;
}

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
   * @returns {Promise<User>} The user record if access is granted.
   * @throws {ApiError} NOT_FOUND if user doesn't exist
   * @throws {ApiError} FORBIDDEN if user doesn't have the required permission
   * @throws {ApiError} INTERNAL_SERVER_ERROR if the database query fails
   */
  async function verifyUserAccess(
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
   * @param authContext - Requesting user's authentication context.
   * @param id - UUID of the user to retrieve.
   * @returns The user record if access is granted.
   * @throws {ApiError} NOT_FOUND if the user does not exist.
   * @throws {ApiError} FORBIDDEN if the requestor lacks permission to access this user.
   * @throws {ApiError} INTERNAL_SERVER_ERROR if the database query fails.
   */
  async function getById(authContext: AuthContext, id: string): Promise<User> {
    const { userId } = authContext;

    try {
      return await verifyUserAccess(authContext, id);
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

  /**
   * Partially update a user by ID.
   *
   * Only fields present in the request body are written — omitted fields are left unchanged.
   * Nullable fields may be set to null to clear their stored value.
   *
   * Authorization: currently restricted to super admins only.
   * To expand access to lower-tiered roles when ready:
   *   1. Assign Permissions.Users.UPDATE to the appropriate roles in role-permissions.ts
   *   2. Remove the isSuperAdmin guard below
   *   3. Remove the manual getById 404 check below
   *   4. Replace both with: await verifyUserAccess(authContext, id, Permissions.Users.UPDATE)
   *      which already handles 404-before-403, super-admin bypass, self-access, and role-based checks
   *
   * @param authContext - Requesting user's authentication context.
   * @param id - UUID of the user to update.
   * @param data - Partial user fields to apply.
   * @throws {ApiError} FORBIDDEN if the requestor is not a super admin.
   * @throws {ApiError} NOT_FOUND if the target user does not exist.
   * @throws {ApiError} CONFLICT if a unique field (email or username) collides with an existing user.
   * @throws {ApiError} INTERNAL_SERVER_ERROR if the database query fails.
   */
  async function update(authContext: AuthContext, id: string, data: UpdateUserData): Promise<void> {
    const { userId, isSuperAdmin } = authContext;

    // Authorization: super admins only (see JSDoc above for the expansion path)
    if (!isSuperAdmin) {
      logger.warn({ userId, id }, 'Non-super admin attempted to update user');
      throw new ApiError(ApiErrorMessage.FORBIDDEN, {
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
        context: { userId, id },
      });
    }

    const {
      nameFirst,
      nameMiddle,
      nameLast,
      username,
      email,
      userType,
      dob,
      grade,
      statusEll,
      statusFrl,
      statusIep,
      studentId,
      sisId,
      stateId,
      localId,
      gender,
      race,
      hispanicEthnicity,
      homeLanguage,
    } = data;

    try {
      // Verify the target user exists.
      // Note: verifySupervisoryAccess handles this automatically when the guard above is expanded.
      const user = await userRepository.getById({ id });
      if (!user) {
        throw new ApiError(ApiErrorMessage.NOT_FOUND, {
          statusCode: StatusCodes.NOT_FOUND,
          code: ApiErrorCode.RESOURCE_NOT_FOUND,
          context: { userId, id },
        });
      }

      await userRepository.update({
        id,
        data: {
          ...(nameFirst !== undefined && { nameFirst }),
          ...(nameMiddle !== undefined && { nameMiddle }),
          ...(nameLast !== undefined && { nameLast }),
          ...(username !== undefined && { username }),
          ...(email !== undefined && { email }),
          ...(userType !== undefined && { userType }),
          ...(dob !== undefined && { dob }),
          ...(grade !== undefined && { grade }),
          ...(statusEll !== undefined && { statusEll }),
          ...(statusFrl !== undefined && { statusFrl }),
          ...(statusIep !== undefined && { statusIep }),
          ...(studentId !== undefined && { studentId }),
          ...(sisId !== undefined && { sisId }),
          ...(stateId !== undefined && { stateId }),
          ...(localId !== undefined && { localId }),
          ...(gender !== undefined && { gender }),
          ...(race !== undefined && { race }),
          ...(hispanicEthnicity !== undefined && { hispanicEthnicity }),
          ...(homeLanguage !== undefined && { homeLanguage }),
        },
      });

      logger.info({ userId, id }, 'Updated user');
    } catch (error) {
      if (error instanceof ApiError) throw error;

      // Unwrap the Drizzle error to access the underlying PostgreSQL error with SQLSTATE codes
      const dbError = unwrapDrizzleError(error);

      // email and username both carry unique constraints — surface as 409 rather than 500
      if (isUniqueViolation(dbError)) {
        throw new ApiError(ApiErrorMessage.CONFLICT, {
          statusCode: StatusCodes.CONFLICT,
          code: ApiErrorCode.RESOURCE_CONFLICT,
          context: { userId, id },
          cause: error,
        });
      }

      logger.error({ err: error, context: { userId, id } }, 'Failed to update user');

      throw new ApiError('Failed to update user', {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
        context: { userId, id },
        cause: error,
      });
    }
  }

  return { findByAuthId, getById, update };
}
