import type { AnyColumn } from 'drizzle-orm';
import { and, lte, gte, or, isNull, sql, gt } from 'drizzle-orm';

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

/**
 * Builds membership date boundary conditions for user family table.
 *
 * Ensures user's family membership is currently active:
 * - joinedOn <= NOW()
 * - leftOn >= NOW() OR leftOn IS NULL
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
 * @param table - A user membership table (currently only userFamilies) with joinedOn and leftOn columns
 * @returns Drizzle SQL condition for active family membership
 */
export function isActiveInFamily(table: { joinedOn: AnyColumn; leftOn: AnyColumn }) {
  return and(lte(table.joinedOn, sql`NOW()`), or(gte(table.leftOn, sql`NOW()`), isNull(table.leftOn)));
}

/**
 * Builds a condition that excludes users whose rostering has ended.
 *
 * The user's rostering is considered active when:
 * - `rosteringEnded IS NULL` (no end date set), OR
 * - `rosteringEnded > NOW()` (end date is in the future)
 *
 * Users with `rosteringEnded <= NOW()` are excluded from results. This is
 * the hard boundary defined in ticket #1742 — once a user's roster has
 * ended, they're treated as decommissioned: invisible from list endpoints,
 * invisible from reports, and 404 from per-user lookups.
 *
 * ## Timezone Handling
 *
 * Uses PostgreSQL's `NOW()`; `rosteringEnded` is `timestamptz` so comparisons
 * are timezone-safe.
 *
 * @example
 * ```ts
 * // In a query selecting users
 * .where(and(
 *   eq(users.id, userId),
 *   isActiveRoster(users)
 * ))
 *
 * // Composed with other conditions
 * .where(and(
 *   isEnrollmentActive(userOrgs),
 *   isActiveRoster(users),
 * ))
 * ```
 *
 * @param table - A table reference with a `rosteringEnded` `timestamptz` column
 * @returns Drizzle SQL condition for non-ended rostering
 */
export function isActiveRoster(table: { rosteringEnded: AnyColumn }) {
  // `or()` returns `SQL | undefined` because it returns undefined when all
  // arguments are undefined. Both arguments here are concrete (an `isNull`
  // check and a `gt` comparison), so undefined is unreachable — the
  // non-null assertion narrows the return type so callers can use the
  // result in contexts that demand a strict `SQL` (e.g., pushing into a
  // typed `SQL[]` array).
  return or(isNull(table.rosteringEnded), gt(table.rosteringEnded, sql`NOW()`))!;
}
