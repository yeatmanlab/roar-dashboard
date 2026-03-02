import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { CoreDbClient } from '../../db/clients';
import type * as CoreDbSchema from '../../db/schema/core';
import { logger } from '../../logger';
import { parseAccessControlFilter, type AccessControlFilter } from '../utils/access-controls.utils';
import { userClasses, classes, userOrgs, orgs } from '../../db/schema';
import { isAuthorizedMembership } from '../utils/is-authorized-membership.utils';
import { filterSupervisoryRoles } from '../utils/supervisory-roles.utils';
import { isAncestorOrEqual } from '../utils/is-ancestor-or-equal.utils';
/**
 * Class Access Controls
 *
 * Builds SQL queries to determine what classes a user can access based on their
 * org/class memberships. 
 *
 * ## How Access Works
 *
 * Users gain access to classes through their memberships:
 *
 * ```
 * User belongs to:          Can see classes assigned to:
 * ─────────────────         ──────────────────────────────────────
 * District                  → That district (and descendants)
 * School                    → That school (and descendants)
 * Class                     → That class
 * ```
 *
 * ## Access Patterns
 *
 * **Ancestor access (supervisory roles only)** — Supervisors can see classes assigned to them. 
 * **Descendant access (supervisory roles only)** — Supervisors can see classes on descendants.
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

    const supervisoryAllowedRoles = filterSupervisoryRoles(allowedRoles);

    if (supervisoryAllowedRoles.length === 0) {
      logger.debug({ userId, allowedRoles }, 'No supervisory roles provided. Can not list classes.');
      return [];
    }

    // ─────────────────────────────────────────────────────────────────────────–––––––
    // ANCESTOR ACCESS: Find classes on user's entity (supervisory roles only)
    // ─────────────────────────────────────────────────────────────────────────–––––––

     // Path 1: User's class membership → classes assigned directly to that user
    const viaDirectClass = this.db
      .select({ classId: userClasses.classId })
      .from(userClasses)
      .innerJoin(classes, eq(classes.id, userClasses.classId)) // get the class details for user's membership
      .where(isAuthorizedMembership(userClasses, userId, supervisoryAllowedRoles));

    // ─────────────────────────────────────────────────────────────────────────–––––––
    // DESCENDANT ACCESS: Find classes on descendants (supervisory roles only)
    // ─────────────────────────────────────────────────────────────────────────–––––––

    // Path 2: User's org membership → classes on descendant orgs
    const viaUserOrgToDescendantOrg = this.db
      .select({ classId: classes.id })
      .from(userOrgs)
      .innerJoin(orgs, eq(orgs.id, userOrgs.orgId))
      .innerJoin(classes, isAncestorOrEqual(orgs.orgPath, classes.orgPath))
      .where(isAuthorizedMembership(userOrgs, userId, supervisoryAllowedRoles));

    return viaDirectClass.union(viaUserOrgToDescendantOrg);
  }
}
