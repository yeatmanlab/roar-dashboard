import type { AnyColumn, SQL } from 'drizzle-orm';
import { and, lte, gte, or, isNull, isNotNull, sql, gt, exists } from 'drizzle-orm';
import { fdwRuns } from '../../db/schema/assessment-fdw/runs';

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

/**
 * Admin-aware variant of {@link isEnrollmentActive}: checks that the
 * enrollment was still active as of `LEAST(administrationDateEnd, NOW())`.
 *
 * Reporting endpoints (#1792) ask the question "was the student still
 * enrolled when the administration window closed?" rather than "is the
 * student enrolled right now?". For past administrations (`dateEnd < NOW()`)
 * this means the check date is the administration's end, not the wall clock.
 * For active or future administrations (`dateEnd >= NOW()`), `LEAST` clamps
 * the check date to `NOW()` so the predicate matches `isEnrollmentActive`'s
 * present-tense behavior.
 *
 * Strict overlap (both sides clamped to `LEAST(adminDateEnd, NOW())`):
 * - `enrollment.start <= LEAST(adminDateEnd, NOW())` — the student had
 *   joined by the check date. The clamp matters for active/future admins:
 *   without it, a student whose `enrollment.start` falls between `NOW()` and
 *   the admin's `dateEnd` would slip through, even though they aren't
 *   actually enrolled yet — see #1792.
 * - `enrollment.end IS NULL` OR `enrollment.end > LEAST(adminDateEnd, NOW())`
 *   — and either is still enrolled or left after the check date.
 *
 * Outside of reporting, callers want "currently active as of NOW()" — keep
 * using {@link isEnrollmentActive}. This helper is only correct in admin-
 * scoped contexts where the administration's `dateEnd` is in hand.
 *
 * @param table - A user-membership table (userOrgs, userClasses, userGroups)
 *                with `enrollmentStart` and `enrollmentEnd` columns.
 * @param administrationDateEnd - The administration's `dateEnd`, either as a
 *                                column reference (when joined against
 *                                administrations) or as a SQL expression.
 * @returns Drizzle SQL condition for admin-aware strict overlap.
 */
export function isEnrollmentActiveForAdmin(
  table: { enrollmentStart: AnyColumn; enrollmentEnd: AnyColumn },
  administrationDateEnd: AnyColumn | SQL,
) {
  const checkDate = sql`LEAST(${administrationDateEnd}, NOW())`;
  return and(
    lte(table.enrollmentStart, checkDate),
    or(gt(table.enrollmentEnd, checkDate), isNull(table.enrollmentEnd)),
  );
}

/**
 * "Withdrawn with data" inclusion path for the `includeUnenrolledStudents`
 * toggle on reporting list endpoints (#1792).
 *
 * Matches students whose enrollment overlapped the administration window
 * but ended before the check date, **and** who have at least one
 * non-deleted, non-aborted `runs` record for this administration. This is
 * exactly the set of students who would pass broad overlap but fail strict
 * overlap, narrowed to those who actually took (or started) the assessment.
 *
 * The five enrollment-side predicates expand to:
 * - `enrollment.start <= LEAST(adminDateEnd, NOW())` — joined by the check
 *   date. Symmetric with `isEnrollmentActiveForAdmin`; protects against an
 *   invalid row where `enrollment.start > enrollment.end` (the schema has a
 *   CHECK for this at write time, but defense-in-depth is cheap).
 * - `enrollment.end IS NOT NULL`                    — they left
 * - `enrollment.end > administrationDateStart`      — overlapped the window
 * - `enrollment.end <= LEAST(adminDateEnd, NOW())`  — left at or before check
 *
 * The `EXISTS` clause filters `runs` via the FDW: `deletedAt IS NULL AND
 * abortedAt IS NULL`. A soft-deleted or aborted run is not evidence the
 * student took the assessment and must not bring a withdrawn student back.
 *
 * This predicate is OR-ed with `isEnrollmentActiveForAdmin` when the toggle
 * is on; callers must NOT use it on its own (the strict-overlap path is
 * always part of the in-scope set).
 *
 * @param table - User-membership table with `enrollmentStart` / `enrollmentEnd`.
 * @param administrationDateStart - Admin window start (column or SQL).
 * @param administrationDateEnd - Admin window end (column or SQL).
 * @param userIdCol - The user-id column that the `runs` EXISTS subquery
 *                    should correlate against (e.g., `users.id` in the
 *                    outer query).
 * @param administrationIdCol - The administration-id column / expression
 *                              that pins the EXISTS subquery to this admin.
 * @returns Drizzle SQL condition for the withdrawn-with-data inclusion path.
 */
export function hasWithdrawnWithDataForAdmin(
  table: { enrollmentStart: AnyColumn; enrollmentEnd: AnyColumn },
  administrationDateStart: AnyColumn | SQL,
  administrationDateEnd: AnyColumn | SQL,
  userIdCol: AnyColumn,
  administrationIdCol: AnyColumn | SQL,
) {
  const checkDate = sql`LEAST(${administrationDateEnd}, NOW())`;
  return and(
    lte(table.enrollmentStart, checkDate),
    isNotNull(table.enrollmentEnd),
    gt(table.enrollmentEnd, administrationDateStart),
    lte(table.enrollmentEnd, checkDate),
    // Drizzle's `exists()` emits `exists ${subquery}` without adding
    // parentheses — when given a raw `sql` template (rather than a
    // Drizzle subquery object) we must wrap the inner SELECT in parens
    // ourselves so PostgreSQL parses it as `EXISTS (SELECT ...)`.
    exists(
      sql`(SELECT 1 FROM ${fdwRuns}
          WHERE ${fdwRuns.userId} = ${userIdCol}
            AND ${fdwRuns.administrationId} = ${administrationIdCol}
            AND ${fdwRuns.deletedAt} IS NULL
            AND ${fdwRuns.abortedAt} IS NULL)`,
    ),
  );
}
