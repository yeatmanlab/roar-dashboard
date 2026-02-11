import { and, eq, inArray } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { userOrgs, userClasses, orgs, classes } from '../../db/schema';
import { SUPERVISORY_ROLES } from '../../constants/role-classifications';
import { CoreDbClient } from '../../db/clients';
import type * as CoreDbSchema from '../../db/schema/core';
import { parseAccessControlFilter, type AccessControlFilter } from '../utils/access-controls.utils';
import { isDescendantOrEqual, isAncestorOrEqual } from '../utils/ltree.utils';

/**
 * District Access Controls
 *
 * Builds SQL queries to determine what districts a user can access based on their
 * org/class/group memberships. Used by other repositories to filter query results.
 *
 * ## How Access Works
 *
 * Users gain access to districts through their memberships:
 *
 * ```
 * User belongs to:          Can see districts:
 * ─────────────────         ──────────────────────────────────────
 * District                  → That district (and descendants if supervisory)
 * School                    → Parent district
 * Class                     → Parent school's district
 * Group                     → Parent org's district
 * ```
 *
 * ## Access Patterns
 *
 * **Ancestor access (all roles)** — Users see districts that are ancestors of their entity:
 * - Student in School A sees School A's parent District
 * - Student in Class X sees Class X's parent School's parent District
 *
 * **Descendant access (supervisory roles only)** — Supervisors also see child districts:
 * - Admin in National org sees all child Districts
 * - Admin in State sees all child Districts in that state
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
export class DistrictAccessControls {
  constructor(protected readonly db: NodePgDatabase<typeof CoreDbSchema> = CoreDbClient) {}

  /**
   * Returns all district IDs a user can access.
   *
   * Starts from the user's memberships (typically small) and finds all districts
   * they can see based on org hierarchy. This is the core authorization query.
   *
   * @example
   * ```ts
   * const accessibleDistricts = districtAccessControls.buildUserDistrictIdsQuery({
   *   userId: 'user-123',
   *   allowedRoles: ['student', 'teacher'],
   * });
   *
   * // Use in another query
   * const districts = await db
   *   .select()
   *   .from(orgs)
   *   .innerJoin(accessibleDistricts.as('accessible'), eq(orgs.id, accessible.orgId))
   *   .where(eq(orgs.orgType, 'district'));
   * ```
   *
   * @param accessControlFilter - Filter containing userId and allowedRoles
   * @returns Drizzle subquery with `{ orgId: string }` rows.
   *          Uses UNION to automatically deduplicate across access paths.
   * @throws {ZodError} If called with empty userId or allowedRoles
   */
  buildUserDistrictIdsQuery(accessControlFilter: AccessControlFilter) {
    const { userId, allowedRoles } = parseAccessControlFilter(accessControlFilter);

    // Aliases for the orgs table (needed because we join it twice in the same query)
    const districtOrgTable = alias(orgs, 'district_org'); // District org we're checking access to
    const userOrgTable = alias(orgs, 'user_org'); // Org where the user has membership

    const isSupervisory = allowedRoles.some((role) => SUPERVISORY_ROLES.includes(role));

    // ─────────────────────────────────────────────────────────────────────────–––––––
    // ANCESTOR ACCESS: Find districts that are ancestors of user's entity (all roles)
    // ─────────────────────────────────────────────────────────────────────────–––––––

    // Path 1: User's org membership → districts that are ancestors of that org
    // Example: User in School A sees School A's parent District
    const viaUserOrgToDistrict = this.db
      .select({ orgId: districtOrgTable.id })
      .from(userOrgs)
      .innerJoin(userOrgTable, eq(userOrgs.orgId, userOrgTable.id))
      .innerJoin(districtOrgTable, isAncestorOrEqual(districtOrgTable.path, userOrgTable.path))
      .where(
        and(
          eq(userOrgs.userId, userId),
          inArray(userOrgs.role, allowedRoles),
          eq(districtOrgTable.orgType, 'district'),
        ),
      );

    // Path 2: User's class membership → districts via class's org hierarchy
    // Example: User in Class X sees Class X's parent School's parent District
    const viaUserClassToDistrict = this.db
      .select({ orgId: districtOrgTable.id })
      .from(userClasses)
      .innerJoin(classes, eq(userClasses.classId, classes.id))
      .innerJoin(districtOrgTable, isAncestorOrEqual(districtOrgTable.path, classes.orgPath))
      .where(
        and(
          eq(userClasses.userId, userId),
          inArray(userClasses.role, allowedRoles),
          eq(districtOrgTable.orgType, 'district'),
        ),
      );

    // Note: Groups are standalone entities without org hierarchy, so they don't provide
    // district access. Users in groups must also have org or class memberships to see districts.

    // ─────────────────────────────────────────────────────────────────────────–––––––
    // DESCENDANT ACCESS: Find districts that are descendants of user's entity (supervisory only)
    // ─────────────────────────────────────────────────────────────────────────–––––––

    if (!isSupervisory) {
      // Non-supervisory users only get ancestor access
      return viaUserOrgToDistrict.union(viaUserClassToDistrict);
    }

    // Path 4: Supervisory user's org membership → districts that are descendants
    // Example: Admin in State org sees all child Districts in that state
    const viaUserOrgToDescendantDistricts = this.db
      .select({ orgId: districtOrgTable.id })
      .from(userOrgs)
      .innerJoin(userOrgTable, eq(userOrgs.orgId, userOrgTable.id))
      .innerJoin(districtOrgTable, isDescendantOrEqual(districtOrgTable.path, userOrgTable.path))
      .where(
        and(
          eq(userOrgs.userId, userId),
          inArray(userOrgs.role, allowedRoles),
          eq(districtOrgTable.orgType, 'district'),
        ),
      );

    // Combine all paths with UNION (auto-deduplicates)
    return viaUserOrgToDistrict.union(viaUserClassToDistrict).union(viaUserOrgToDescendantDistricts);
  }
}
