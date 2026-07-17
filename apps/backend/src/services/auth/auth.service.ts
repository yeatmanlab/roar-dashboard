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
 * Auth Service
 *
 * Static service for authenticating requests. Uses Firebase Admin SDK to verify
 * ID tokens. In local development and CI, the Firebase Auth emulator is used
 * automatically when `FIREBASE_AUTH_EMULATOR_HOST` is set — no code change needed,
 * the Admin SDK connects to the emulator transparently.
 *
 * @example
 * ```ts
 * import { AuthService } from './auth.service';
 * const user = await AuthService.verifyToken(token);
 * ```
 */
export class AuthService {
  private static provider = new FirebaseAuthProvider();

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
