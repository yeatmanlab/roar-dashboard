import type { DecodedUser, IAuthProvider } from '../auth.service';

/**
 * Test authentication provider for SDK integration tests.
 *
 * Treats the token string directly as the Firebase UID, bypassing Firebase Admin SDK verification.
 * This allows SDK integration tests to use simple test tokens without requiring real Firebase credentials.
 *
 * Explicitly wired up by server-test.ts via AuthService.provider = new TestAuthProvider().
 * Never included in the production server.
 */
export class TestAuthProvider implements IAuthProvider {
  async verifyToken(token: string): Promise<DecodedUser> {
    return {
      uid: token,
      claims: {},
    };
  }
}
