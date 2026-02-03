import { sql } from 'drizzle-orm';
import type { SQL, AnyColumn } from 'drizzle-orm';

/**
 * PostgreSQL ltree utility functions.
 *
 * ltree is a PostgreSQL extension for hierarchical data using dot-separated paths.
 * Paths are stored as segments like: `district_uuid.school_uuid.class_uuid`
 *
 * Key operators (from PostgreSQL docs):
 * - `A <@ B`: A is a descendant of B (or equal to B). "A is contained in B"
 * - `A @> B`: A is an ancestor of B (or equal to B). "A contains B"
 *
 * Our wrapper functions use semantic naming that matches the org hierarchy domain:
 * - `isDescendantOrEqual(child, ancestor)` → `child <@ ancestor`
 * - `isAncestorOrEqual(ancestor, child)` → `ancestor @> child`
 */

/**
 * Returns SQL condition: childPath is a descendant of (or equal to) ancestorPath.
 *
 * Uses ltree `<@` operator: `child <@ ancestor`
 *
 * In ltree terms: "child is contained in ancestor's subtree"
 *
 * @example
 * // Find ancestor orgs of user's org (user org is descendant of admin org)
 * .innerJoin(adminOrg, isDescendantOrEqual(userOrg.path, adminOrg.path))
 * // Matches: userOrg.path='district.school' is descendant of adminOrg.path='district'
 *
 * @param childPath - The potential descendant path column (left operand of <@)
 * @param ancestorPath - The potential ancestor path column (right operand of <@)
 * @returns SQL condition for the ltree containment check
 */
export function isDescendantOrEqual(childPath: AnyColumn, ancestorPath: AnyColumn): SQL {
  return sql`${childPath} <@ ${ancestorPath}`;
}

/**
 * Returns SQL condition: ancestorPath is an ancestor of (or equal to) childPath.
 *
 * Uses ltree `@>` operator: `ancestor @> child`
 *
 * In ltree terms: "ancestor's subtree contains child"
 *
 * This is the inverse of `isDescendantOrEqual` - use whichever reads more naturally
 * in your query context.
 *
 * @example
 * // Find descendant orgs of user's org (user org is ancestor of admin org)
 * .innerJoin(adminOrg, isAncestorOrEqual(userOrg.path, adminOrg.path))
 * // Matches: userOrg.path='district' is ancestor of adminOrg.path='district.school'
 *
 * @param ancestorPath - The potential ancestor path column (left operand of @>)
 * @param childPath - The potential descendant path column (right operand of @>)
 * @returns SQL condition for the ltree containment check
 */
export function isAncestorOrEqual(ancestorPath: AnyColumn, childPath: AnyColumn): SQL {
  return sql`${ancestorPath} @> ${childPath}`;
}
