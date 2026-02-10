/**
 * Decoded Firebase JWT interface.
 *
 * Represents the decoded Firebase ID token used during token verification.
 * This is an internal type - the PostgreSQL User record is attached to req.user.
 *
 * @property uid - The Firebase user ID (maps to users.authId in PostgreSQL).
 * @property email - The user email (optional).
 * @property claims - Additional JWT claims from Firebase.
 */
export type DecodedUser = {
  uid: string;
  email?: string;
  claims: Record<string, unknown>;
};

/**
 * Auth Provider interface.
 *
 * @property verifyToken - Verifies a JWT token and returns the decoded Firebase user.
 */
export interface IAuthProvider {
  verifyToken(token: string): Promise<DecodedUser>;
}
