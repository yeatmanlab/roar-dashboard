import { sql } from 'drizzle-orm';
import type { SQL, AnyColumn } from 'drizzle-orm';

/**
 * Returns SQL condition: childPath is a descendant of (or equal to) ancestorPath.
 *
 * Uses PostgreSQL ltree `<@` operator: `child <@ ancestor`
 *
 * ltree is a PostgreSQL extension for hierarchical data using dot-separated paths.
 * Paths are stored as segments like: `district_uuid.school_uuid.class_uuid`
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
