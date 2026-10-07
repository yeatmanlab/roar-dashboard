import type { DecodedUser } from './auth.service';

/**
 * Contract every authentication provider must satisfy.
 *
 * `AuthService` depends on this rather than on a concrete provider, so the Firebase
 * implementation can be substituted in tests, or replaced wholesale if the platform
 * ever moves off Firebase Auth, without touching the middleware that consumes it.
 */
export interface AuthProvider {
  /**
   * Verify a JWT and return the identity it encodes.
   *
   * @param token - The raw JWT from the request's Authorization header.
   * @returns The decoded user.
   * @throws {ApiError} UNAUTHORIZED with AUTH_TOKEN_EXPIRED or AUTH_TOKEN_INVALID.
   */
  verifyToken(token: string): Promise<DecodedUser>;
}
