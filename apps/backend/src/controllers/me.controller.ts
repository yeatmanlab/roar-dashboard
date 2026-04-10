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
   * Get the current authenticated user's profile, including unsigned TOS agreements.
   *
   * @param authContext - The authenticated user's context from req.user
   * @returns ts-rest response object with user profile and unsigned agreements, or error
   */
  get: async (authContext: AuthContext) => {
    try {
      const [user, unsignedAgreements] = await Promise.all([
        userService.getById(authContext, authContext.userId),
        userService.getUnsignedTosAgreements(authContext.userId),
      ]);

      return {
        status: StatusCodes.OK as const,
        body: {
          data: {
            id: user.id,
            userType: user.userType,
            nameFirst: user.nameFirst,
            nameLast: user.nameLast,
            unsignedAgreements,
          },
        },
      };
    } catch (error) {
      if (error instanceof ApiError) {
        return toErrorResponse(error, [
          StatusCodes.NOT_FOUND,
          StatusCodes.UNAUTHORIZED,
          StatusCodes.INTERNAL_SERVER_ERROR,
        ]);
      }
      throw error;
    }
  },
};
