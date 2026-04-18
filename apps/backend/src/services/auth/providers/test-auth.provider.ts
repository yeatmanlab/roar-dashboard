import type { DecodedUser, IAuthProvider } from '../auth.service';

/**
 * Test authentication provider for NODE_ENV=test.
 *
 * Treats the token string directly as the Firebase UID, bypassing Firebase Admin SDK verification.
 * This allows SDK integration tests to use simple test tokens without requiring real Firebase credentials.
 *
 * Only active when NODE_ENV=test — never used in production.
 */
export class TestAuthProvider implements IAuthProvider {
  async verifyToken(token: string): Promise<DecodedUser> {
    return {
      uid: token,
      claims: {},
    };
  }
}
