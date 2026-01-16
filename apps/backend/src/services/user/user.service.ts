import type { User } from '../../db/schema';
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
   */
  async function findByAuthId(authId: string): Promise<User | null> {
    return userRepository.findByAuthId(authId);
  }

  /**
   * Get a user by their ID.
   *
   * @param id - The user's UUID.
   * @returns The user record if found, null otherwise.
   */
  async function getById(id: string): Promise<User | null> {
    return userRepository.get({ id });
  }

  return { findByAuthId, getById };
}
