import { sql } from 'drizzle-orm';
import type { SQL, AnyColumn } from 'drizzle-orm';

/**
 * Returns SQL condition: ancestorPath is an ancestor of (or equal to) childPath.
 *
 * Uses PostgreSQL ltree `@>` operator: `ancestor @> child`
 *
 * ltree is a PostgreSQL extension for hierarchical data using dot-separated paths.
 * Paths are stored as segments like: `district_uuid.school_uuid.class_uuid`
 *
 * In ltree terms: "ancestor's subtree contains child"
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
