import { StatusCodes } from 'http-status-codes';
import { UserService } from '../services/user';

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
   * @param userId - The authenticated user's ID from req.user
   * @returns ts-rest response object with user profile or error
   */
  get: async (userId: string) => {
    const user = await UserService().getById(userId);

    if (!user) {
      return {
        status: StatusCodes.UNAUTHORIZED as const,
        body: { error: { message: 'Authentication failed' } },
      };
    }

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
  },
};
