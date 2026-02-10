/**
 * Minimal authentication context attached to req.user by AuthGuardMiddleware.
 *
 * Contains only the essential user information needed for authorization checks.
 * Junction tables (userOrgs, userClasses, etc.) can be queried using the userId.
 *
 * @property userId - The PostgreSQL user UUID.
 * @property isSuperAdmin - Whether the user has super admin privileges.
 */
export type AuthContext = {
  userId: string;
  isSuperAdmin: boolean;
};
