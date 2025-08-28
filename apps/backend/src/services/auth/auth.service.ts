import type { DecodedUser } from './auth.types';
import { FirebaseAuthProvider } from './providers/firebase-auth.provider';

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
