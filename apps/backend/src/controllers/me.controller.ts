import { StatusCodes } from 'http-status-codes';
import { UserService } from '../services/user';
import type { AuthContext } from '../types/auth-context';
import { ApiError } from '../errors/api-error';
import { toErrorResponse } from '../utils/to-error-response.util';

const userService = UserService();

/**
 * MeController
 *
 * Handles HTTP concerns for the /me endpoint.
 * Calls UserService for business logic and formats responses.
 */
export const MeController = {
  /**
   * Get the current authenticated user's profile.
   *
   * @param authContext - The authenticated user's context from req.user
   * @returns ts-rest response object with user profile or error
   */
  get: async (authContext: AuthContext) => {
    try {
      // User is requesting their own profile
      const user = await userService.getById(authContext, authContext.userId);

      return {
        status: StatusCodes.OK as const,
        body: {
          data: {
            id: user.id,
            userType: user.userType,
            nameFirst: user.nameFirst,
            nameLast: user.nameLast,
          },
        },
      };
    } catch (error) {
      if (error instanceof ApiError) {
        return toErrorResponse(error, [StatusCodes.UNAUTHORIZED, StatusCodes.INTERNAL_SERVER_ERROR]);
      }
      throw error;
    }
  },
};
