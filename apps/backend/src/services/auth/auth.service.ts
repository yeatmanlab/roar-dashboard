import { FirebaseAuthProvider } from './providers/firebase-auth.provider';

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
 * Auth Service
 *
 * Static service for authenticating requests. Internally constructs the default provider.
 *
 * @example
 * ```ts
 * import { AuthService } from './auth.service';
 * const user = await AuthService.verifyToken(token);
 * ```
 */
export class AuthService {
  private static provider: IAuthProvider = new FirebaseAuthProvider();

  static verifyToken(token: string): Promise<DecodedUser> {
    return this.provider.verifyToken(token);
  }
}
