import { eq, and } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { CoreDbClient } from '../../db/clients';
import type * as CoreDbSchema from '../../db/schema/core';
import { userClasses, classes, userOrgs, orgs } from '../../db/schema';
import { isAncestorOrEqual } from '../utils/is-ancestor-or-equal.utils';
import { isEnrollmentActive } from '../utils/enrollment.utils';
import type { UserRole } from '../../enums/user-role.enum';
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

  /**
   * Get all distinct roles a user has that grant access to a specific class.
   *
   * Queries all membership paths (org, class) that connect the user to the
   * class and returns the distinct roles from those memberships. This is
   * useful for determining if a user has any supervisory roles for an class.
   *
   * @example
   * ```ts
   * const roles = await adminAccessControls.getUserRolesForClass('user-123', 'class-456');
   * // ['teacher', 'administrator']
   *
   * const hasSupervisoryRole = roles.some(role => SUPERVISORY_ROLES.includes(role));
   * if (!hasSupervisoryRole) {
   *   throw new ApiError('Supervised users cannot access this resource', ...);
   * }
   * ```
   *
   * @param userId - The ID of the user to query roles for
   * @param classId - The ID of the class to check access for
   * @returns Array of distinct roles the user has for this class
   */
  async getUserRolesForClass(userId: string, classId: string): Promise<UserRole[]> {
    // Path 1: User's class membership -> class within user's org tree (supervisory)
    const rolesViaUserClassToOrg = this.db
      .selectDistinct({
        role: userOrgs.role,
      })
      .from(userOrgs)
      .innerJoin(orgs, eq(orgs.id, userOrgs.orgId))
      .innerJoin(classes, isAncestorOrEqual(orgs.path, classes.orgPath))
      .where(and(eq(userOrgs.userId, userId), eq(classes.id, classId), isEnrollmentActive(userOrgs)));

    // Path 2: User's class membership -> class directly assigned to user
    const rolesViaDirectClass = this.db
      .selectDistinct({
        role: userClasses.role,
      })
      .from(userClasses)
      .where(and(eq(userClasses.userId, userId), eq(userClasses.classId, classId), isEnrollmentActive(userClasses)));

    const roleUnion = rolesViaUserClassToOrg.union(rolesViaDirectClass);

    const result = await this.db.select({ role: roleUnion.as('roles').role }).from(roleUnion.as('roles'));

    return result.map((r) => r.role);
  }
}
