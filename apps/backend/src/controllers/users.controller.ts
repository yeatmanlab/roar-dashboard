import { StatusCodes } from 'http-status-codes';
import { UserService } from '../services/user';
import type { AuthContext } from '../types/auth-context';
import { ApiError } from '../errors/api-error';
import { toErrorResponse } from '../utils/to-error-response.util';

const userService = UserService();

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
   * Delagates to the UserService for authorization and retrieval.
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
          data: user,
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
