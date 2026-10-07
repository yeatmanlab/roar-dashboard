import { FirebaseAuthProvider } from './providers/firebase-auth.provider';
import type { AuthProvider } from './auth-provider.interface';

/**
 * Decoded User JWT interface.
 *
 * `claims` stays a loose record because it mirrors whatever the identity provider put in
 * the token. Consumers that depend on a specific claim narrow it themselves — see
 * `parseFirebaseClaims` in `anon-token.middleware.ts` for the Firebase sign-in provider.
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
 * Auth Service
 *
 * Verifies request credentials through an injected {@link AuthProvider}. The default
 * provider uses the Firebase Admin SDK; in local development and CI it connects to the
 * Firebase Auth emulator automatically when `FIREBASE_AUTH_EMULATOR_HOST` is set, with
 * no code change needed.
 *
 * Follows the codebase's factory-function DI pattern, so a test can substitute a provider
 * directly instead of reaching into module internals.
 *
 * @param authProvider - Provider used to verify tokens. Defaults to Firebase.
 * @returns The service's public methods.
 *
 * @example
 * ```ts
 * // Production — module-level default instance.
 * import { AuthService } from './auth.service';
 * const user = await AuthService.verifyToken(token);
 *
 * // Tests — inject a stub provider, no module mocking required.
 * const service = AuthServiceFactory({ authProvider: { verifyToken: vi.fn() } });
 * ```
 */
export function AuthServiceFactory({
  authProvider = new FirebaseAuthProvider(),
}: {
  authProvider?: AuthProvider;
} = {}) {
  /**
   * Verify a JWT and return the identity it encodes.
   *
   * @param token - The raw JWT from the request's Authorization header.
   * @returns The decoded user.
   * @throws {ApiError} UNAUTHORIZED if the token is expired or otherwise invalid.
   */
  function verifyToken(token: string): Promise<DecodedUser> {
    return authProvider.verifyToken(token);
  }

  /**
   * Returns the name of the active auth provider for logging purposes.
   *
   * @returns The constructor name of the current provider.
   */
  function getProviderName(): string {
    return authProvider.constructor.name;
  }

  return { verifyToken, getProviderName };
}

/**
 * Default application-wide instance, backed by the Firebase provider.
 *
 * The middleware and server bootstrap consume this directly. Tests that need a different
 * provider build their own instance with {@link AuthServiceFactory}.
 */
export const AuthService = AuthServiceFactory();
