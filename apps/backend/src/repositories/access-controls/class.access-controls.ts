import { and, eq, inArray } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { CoreDbClient } from '../../db/clients';
import type * as CoreDbSchema from '../../db/schema/core';
import { parseAccessControlFilter, type AccessControlFilter } from '../utils/access-controls.utils';
import { userClasses, classes } from '../../db/schema';
/**
 * Class Access Controls
 *
 * Builds SQL queries to determine what classes a user can access based on their
 * org/class/group memberships. Used by other repositories to filter query results.
 *
 * ## How Access Works
 *
 * Users gain access to classes through their memberships:
 *
 * ```
 * User belongs to:          Can see classes assigned to:
 * ─────────────────         ──────────────────────────────────────
 * District                  → That district (and descendants if supervisory)
 * School                    → That school
 * Class                     → That class
 * ```
 *
 * ## Access Patterns
 *
 * **Ancestor access (all roles)** — N/A, members can only see assigned classes
 *
 * ## ltree for Hierarchy Queries
 *
 * We use PostgreSQL's ltree extension to efficiently query ancestor/descendant relationships.
 * Paths are stored as dot-separated segments: `district_uuid.school_uuid`
 *
 * ltree operators are wrapped in helper functions (see `../utils/ltree.utils.ts`):
 * - `isDescendantOrEqual(child, ancestor)` — child path is descendant of (or equal to) ancestor path
 * - `isAncestorOrEqual(ancestor, child)` — ancestor path is ancestor of (or equal to) child path
 */

export class ClassAccessControls {
  constructor(protected readonly db: NodePgDatabase<typeof CoreDbSchema> = CoreDbClient) {}

  buildUserClassIdsQuery(accessControlFilter: AccessControlFilter) {
    const { userId, allowedRoles } = parseAccessControlFilter(accessControlFilter);

    // ─────────────────────────────────────────────────────────────────────────–––––––
    // ANCESTOR ACCESS: Find administrations on user's entity or ancestors (all roles)
    // ─────────────────────────────────────────────────────────────────────────–––––––

    // Path 1: User's class membership → classes assigned directly to that user
    const viaDirectClass = this.db
      .select({ classId: userClasses.classId })
      .from(userClasses)
      .innerJoin(classes, eq(classes.id, userClasses.classId)) // get the class details for user's membership
      .where(and(eq(userClasses.userId, userId), inArray(userClasses.role, allowedRoles)));

    return viaDirectClass;
  }
}
