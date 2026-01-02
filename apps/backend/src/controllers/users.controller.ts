import { StatusCodes } from 'http-status-codes';
import { UserService } from '../services/user';

const userService = UserService();

/**
 * UsersController
 *
 * Handles HTTP concerns for user endpoints.
 * Calls UserService for business logic and formats responses.
 */
export const UsersController = {
  /**
   * Get a user by ID.
   *
   * @param id - The user's UUID
   * @returns ts-rest response object with user data or error
   */
  getById: async (id: string) => {
    const user = await userService.getById(id);

    if (!user || !user.authId) {
      return {
        status: StatusCodes.NOT_FOUND as const,
        body: { error: { message: 'User not found' } },
      };
    }

    return {
      status: StatusCodes.OK as const,
      body: {
        data: {
          id: user.id,
          auth_id: user.authId,
          ...(user.email != null ? { email: user.email } : {}),
          ...(user.username != null ? { username: user.username } : {}),
        },
      },
    };
  },
};
