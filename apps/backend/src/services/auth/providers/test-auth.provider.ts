import type { DecodedUser, IAuthProvider } from '../auth.service';

/**
 * Test authentication provider for SDK integration tests.
 *
 * Treats the token string directly as the Firebase UID, bypassing Firebase Admin SDK verification.
 * This allows SDK integration tests to use simple test tokens without requiring real Firebase credentials.
 *
 * Activated by setting `AUTH_PROVIDER=test` in the environment. When unset, the default
 * `FirebaseAuthProvider` is used instead. See `resolveAuthProvider()` in `auth.service.ts`.
 */
export class TestAuthProvider implements IAuthProvider {
  /**
   * Verifies a test token by treating it directly as the Firebase UID.
   *
   * In test mode, this bypasses Firebase Admin SDK verification, allowing SDK integration tests
   * to use simple test tokens (e.g., user authIds from seeded test data) without requiring
   * real Firebase credentials.
   *
   * @param token - The test token string, which is used directly as the Firebase UID
   * @returns Promise resolving to a DecodedUser with the token as uid and empty claims
   */
  async verifyToken(token: string): Promise<DecodedUser> {
    return {
      uid: token,
      claims: {},
    };
  }
}
