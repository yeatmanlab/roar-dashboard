import { StatusCodes } from 'http-status-codes';
import type { User } from '../../db/schema';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { ApiError } from '../../errors/api-error';
import { logger } from '../../logger';
import { UserRepository } from '../../repositories/user.repository';

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
   * Get a user by their ID.
   *
   * @param id - The user's UUID.
   * @returns The user record if found, null otherwise.
   * @throws {ApiError} If the database query fails.
   */
  async function getById(id: string): Promise<User | null> {
    try {
      return await userRepository.getById({ id });
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error({ err: error, context: { userId: id } }, 'Failed to get user by ID');
      throw new ApiError('Failed to retrieve user', {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
        context: { userId: id },
        cause: error,
      });
    }
  }

  return { findByAuthId, getById };
}
