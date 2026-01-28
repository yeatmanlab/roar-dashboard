import { sql } from 'drizzle-orm';
import type { SQL, AnyColumn } from 'drizzle-orm';

/**
 * PostgreSQL ltree utility functions.
 *
 * ltree is a PostgreSQL extension for hierarchical data using dot-separated paths.
 * Paths are stored as segments like: `district_uuid.school_uuid.class_uuid`
 *
 * Key operators:
 * - `<@` (isDescendantOrEqual): Returns true if left path is descendant of or equal to right path
 * - `@>` (isAncestorOrEqual): Returns true if left path is ancestor of or equal to right path
 */

/**
 * Returns SQL condition: childPath is a descendant of (or equal to) ancestorPath.
 *
 * Uses ltree `<@` operator: `child <@ ancestor`
 *
 * @example
 * // Find orgs that are descendants of user's org
 * .innerJoin(childOrg, isDescendantOrEqual(childOrg.path, parentOrg.path))
 *
 * @param childPath - The potential descendant path column
 * @param ancestorPath - The potential ancestor path column
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
 * This is the inverse of `isDescendantOrEqual` - use whichever reads more naturally
 * in your query context.
 *
 * @example
 * // Find orgs that are ancestors of class's org
 * .innerJoin(parentOrg, isAncestorOrEqual(parentOrg.path, childClass.orgPath))
 *
 * @param ancestorPath - The potential ancestor path column
 * @param childPath - The potential descendant path column
 * @returns SQL condition for the ltree containment check
 */
export function isAncestorOrEqual(ancestorPath: AnyColumn, childPath: AnyColumn): SQL {
  return sql`${ancestorPath} @> ${childPath}`;
}
