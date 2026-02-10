import { and, lte, gte, or, isNull, sql, type AnyColumn } from 'drizzle-orm';

/**
 * Builds enrollment date boundary conditions for user membership tables.
 *
 * Ensures user's enrollment is currently active:
 * - enrollmentStart <= NOW()
 * - enrollmentEnd >= NOW() OR enrollmentEnd IS NULL
 *
 * ## Timezone Handling
 *
 * This function uses PostgreSQL's `NOW()` which returns the current timestamp.
 * The enrollment columns use `timestamptz` (timestamp with time zone), which:
 * - Stores all timestamps internally as UTC
 * - Automatically converts input timestamps to UTC
 * - Ensures comparisons are timezone-safe regardless of server configuration
 *
 * As long as enrollment dates are written as JavaScript `Date` objects (UTC-based)
 * or ISO 8601 strings, comparisons will be correct.
 *
 * @example
 * ```ts
 * // In a query joining userOrgs
 * .where(and(
 *   eq(userOrgs.userId, userId),
 *   isEnrollmentActive(userOrgs)
 * ))
 *
 * // In an innerJoin condition
 * .innerJoin(userOrgs, and(
 *   eq(userOrgs.orgId, orgs.id),
 *   isEnrollmentActive(userOrgs)
 * ))
 * ```
 *
 * @param table - A user membership table (userOrgs, userClasses, or userGroups)
 *                with enrollmentStart and enrollmentEnd columns
 * @returns Drizzle SQL condition for active enrollment
 */
export function isEnrollmentActive(table: { enrollmentStart: AnyColumn; enrollmentEnd: AnyColumn }) {
  return and(
    lte(table.enrollmentStart, sql`NOW()`),
    or(gte(table.enrollmentEnd, sql`NOW()`), isNull(table.enrollmentEnd)),
  );
}
