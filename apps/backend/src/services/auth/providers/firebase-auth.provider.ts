import { FirebaseAuthClient } from '../../../clients/firebase-auth.clients';
import type { DecodedUser, IAuthProvider } from '../auth.service';

/**
 * Firebase Auth Provider
 *
 * This auth provider uses Firebase Auth to verify JWT tokens and extract user information.
 */
export class FirebaseAuthProvider implements IAuthProvider {
  async verifyToken(token: string): Promise<DecodedUser> {
    const decoded = await FirebaseAuthClient.verifyIdToken(token, true);
    return {
      uid: decoded.uid,
      ...(decoded.email != null ? { email: decoded.email } : {}),
      claims: decoded as unknown as Record<string, unknown>,
    };
  }
}
