import { FirebaseAuthProvider } from './providers/firebase-auth.provider';
import { TestAuthProvider } from './providers/test-auth.provider';

/**
 * Decoded User JWT interface.
 *
 * @property uid - The user ID.
 * @property email - The user email.
 * @property claims - The user claims.
 */
export type DecodedUser = {
  uid: string;
  email?: string;
  claims: Record<string, unknown>;
};

/**
 * Auth Provider interface.
 *
 * @property verifyToken - Verifies a JWT token.
 */
export interface IAuthProvider {
  verifyToken(token: string): Promise<DecodedUser>;
}

/**
 * Resolve the auth provider based on the `AUTH_PROVIDER` environment variable.
 *
 * - `AUTH_PROVIDER=test` → `TestAuthProvider` (token string == Firebase UID, no verification)
 * - Unset or any other value → `FirebaseAuthProvider` (real Firebase Admin SDK verification)
 *
 * @returns The resolved auth provider instance
 */
function resolveAuthProvider(): IAuthProvider {
  if (process.env.AUTH_PROVIDER === 'test') {
    return new TestAuthProvider();
  }
  return new FirebaseAuthProvider();
}

/**
 * Auth Service
 *
 * Static service for authenticating requests. The provider is resolved at module load
 * time from the `AUTH_PROVIDER` environment variable:
 * - `AUTH_PROVIDER=test` → `TestAuthProvider` (for SDK integration tests)
 * - Unset → `FirebaseAuthProvider` (production and e2e with emulator)
 *
 * @example
 * ```ts
 * import { AuthService } from './auth.service';
 * const user = await AuthService.verifyToken(token);
 * ```
 */
export class AuthService {
  private static provider: IAuthProvider = resolveAuthProvider();

  static verifyToken(token: string): Promise<DecodedUser> {
    return this.provider.verifyToken(token);
  }

  /**
   * Returns the name of the active auth provider for logging purposes.
   *
   * @returns The class name of the current provider
   */
  static getProviderName(): string {
    return this.provider.constructor.name;
  }
}
