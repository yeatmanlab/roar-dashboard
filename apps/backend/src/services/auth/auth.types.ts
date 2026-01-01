import type { userTypeEnum } from '../../db/schema/enums';

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
 * Minimal authentication context attached to req.user.
 *
 * Contains only the essential user information needed for authorization checks.
 * Junction tables (userOrgs, userClasses, etc.) can be queried using the id.
 *
 * @property id - The PostgreSQL user UUID.
 * @property userType - The user's type (student, educator, caregiver, admin).
 */
export type AuthContext = {
  id: string;
  userType: (typeof userTypeEnum.enumValues)[number];
};

/**
 * Auth Provider interface.
 *
 * @property verifyToken - Verifies a JWT token and returns the decoded Firebase user.
 */
export interface IAuthProvider {
  verifyToken(token: string): Promise<DecodedUser>;
}
