import type { AuthContext } from '../types/auth-context';
import type { User } from '../db/schema';
import type { UserResponse } from '@roar-dashboard/api-contract';
import { StatusCodes } from 'http-status-codes';
import { UserService } from '../services/user';
import { ApiError } from '../errors/api-error';
import { toErrorResponse } from '../utils/to-error-response.util';
const userService = UserService();

/**
 * Transform a User database record into a UserResponse API schema.
 * Converts Date objects to ISO datetime strings as required by the API contract.
 *
 * Security: isSuperAdmin is only included when the requesting user is a super admin.
 *
 * @param user - User record from the database
 * @param authContext - Requesting user's authentication context
 * @returns UserResponse with Date fields converted to strings
 */
function toUserResponse(user: User, authContext: AuthContext): UserResponse {
  return {
    id: user.id,
    assessmentPid: user.assessmentPid,
    authProvider: user.authProvider ?? [],
    nameFirst: user.nameFirst,
    nameMiddle: user.nameMiddle,
    nameLast: user.nameLast,
    username: user.username,
    email: user.email,
    userType: user.userType,
    dob: user.dob, // Already a date string (YYYY-MM-DD) from the database
    grade: user.grade,
    schoolLevel: user.schoolLevel,
    statusEll: user.statusEll,
    statusFrl: user.statusFrl,
    statusIep: user.statusIep,
    studentId: user.studentId,
    sisId: user.sisId,
    stateId: user.stateId,
    localId: user.localId,
    gender: user.gender,
    race: user.race,
    hispanicEthnicity: user.hispanicEthnicity,
    homeLanguage: user.homeLanguage,
    ...(authContext.isSuperAdmin && { isSuperAdmin: user.isSuperAdmin }),
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt?.toISOString() ?? null,
  };
}

/**
 * Handles HTTP concerns for the /users endpoints.
 *
 * Responsible for transforming service results into ts-rest responses
 * and mapping known ApiError status codes to typed error responses.
 * Business logic and authorization are delegated to the UserService.
 */
export const UsersController = {
  /**
   * Get a single user by ID.
   *
   * Delegates to the UserService for authorization and retrieval.
   *
   * @param authContext - Requesting user's authentication context.
   * @param userId - UUID of the user to retrieve.
   */
  get: async (authContext: AuthContext, userId: string) => {
    try {
      const user = await userService.getById(authContext, userId);
      return {
        status: StatusCodes.OK as const,
        body: {
          data: toUserResponse(user, authContext),
        },
      };
    } catch (error) {
      if (error instanceof ApiError) {
        return toErrorResponse(error, [
          StatusCodes.UNAUTHORIZED,
          StatusCodes.FORBIDDEN,
          StatusCodes.NOT_FOUND,
          StatusCodes.INTERNAL_SERVER_ERROR,
        ]);
      }
      throw error;
    }
  },
};
