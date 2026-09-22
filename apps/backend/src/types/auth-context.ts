/**
 * Minimal authentication context attached to req.user by AuthGuardMiddleware.
 *
 * Contains only the essential user information needed for authorization checks.
 * Junction tables (userOrgs, userClasses, etc.) can be queried using the userId.
 *
 * @property userId - The PostgreSQL user UUID for request-scoped contexts. Non-request
 *   principals (e.g. system jobs) may carry a synthetic non-UUID label such as
 *   'system:sync-fga-job', so never assume UUID syntax without checking.
 * @property isSuperAdmin - Whether the user has super admin privileges.
 */
export type AuthContext = {
  userId: string;
  isSuperAdmin: boolean;
};
