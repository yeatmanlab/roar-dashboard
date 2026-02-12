import { and, eq, inArray, type AnyColumn } from 'drizzle-orm';
import { isEnrollmentActive } from './enrollment.utils';

/**
 * Builds a condition to filter user memberships by userId, allowed roles, and active enrollment.
 *
 * Combines three authorization checks into a single reusable condition:
 * - User ID matches the membership record
 * - User's role in that membership is in the allowed roles list
 * - Enrollment dates indicate an active membership (via `isEnrollmentActive`)
 *
 * @example
 * ```ts
 * // In a where clause for user-initiated queries
 * const accessibleAdmins = db
 *   .select({ administrationId: administrationOrgs.administrationId })
 *   .from(userOrgs)
 *   .innerJoin(...)
 *   .where(isAuthorizedMembership(userOrgs, userId, allowedRoles));
 * ```
 *
 * @param table - A user membership table (userOrgs, userClasses, or userGroups)
 *                with userId, role, enrollmentStart, and enrollmentEnd columns
 * @param userId - The ID of the user to filter by
 * @param allowedRoles - Array of roles that grant access for this operation
 * @returns Drizzle SQL condition combining user, role, and enrollment checks
 */
export function isAuthorizedMembership(
  table: { userId: AnyColumn; role: AnyColumn; enrollmentStart: AnyColumn; enrollmentEnd: AnyColumn },
  userId: string,
  allowedRoles: string[],
) {
  return and(eq(table.userId, userId), inArray(table.role, allowedRoles), isEnrollmentActive(table));
}
