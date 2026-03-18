import { and, eq } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

import { CoreDbClient } from '../../db/clients';
import type * as CoreDbSchema from '../../db/schema/core';
import { classes, orgs, userClasses, userFamilies, userGroups, userOrgs, users } from '../../db/schema';

import type { AccessControlFilter } from '../utils/parse-access-control-filter.utils';
import { isActiveInFamily, isEnrollmentActive } from '../utils/enrollment.utils';
import { isAncestorOrEqual } from '../utils/is-ancestor-or-equal.utils';
import { isAuthorizedFamily, isAuthorizedMembership } from '../utils/is-authorized-membership.utils';
import { parseAccessControlFilter } from '../utils/parse-access-control-filter.utils';
import { filterSupervisoryRoles, filterCaretakerRoles } from '../utils/supervisory-roles.utils';

/**
 * User Access Controls
 *
 * Builds SQL queries to determine what users a requesting user can access based on their
 * org/class/group/family memberships. Used by other repositories to filter query results.
 *
 * ## How Access Works
 *
 * Users gain access to other users through shared memberships:
 *
 * ```
 * Requesting user belongs to:    Can see users in:
 * ───────────────────────────    ─────────────────────────────────────────
 * District (supervisory)         → That district and descendant orgs
 * School (supervisory)           → That school and descendant orgs
 * Class (supervisory)            → That class
 * Group (supervisory)            → That group
 * Family (any role)              → That family
 * ```
 *
 * ## Access Patterns
 *
 * **Non-supervisory users** — Can only see their own user record:
 * - Students see only themselves
 *
 * **Supervisory users** — See users through multiple paths:
 * - **Via org hierarchy**: District/school admins see users in descendant orgs
 * - **Via org→class**: District/school admins see users in classes under their orgs
 * - **Via direct class**: Teachers see users in their classes
 * - **Via direct group**: Group leaders see users in their groups
 * - **Via family**: Family members see each other (no supervisory role required)
 *
 * ## ltree for Hierarchy Queries
 *
 * We use PostgreSQL's ltree extension to efficiently query ancestor/descendant relationships.
 * - Org paths: `district_uuid.school_uuid`
 * - Class paths: Copied from parent school's org path via database triggers
 *
 * ltree operators are wrapped in helper functions (see `../utils/ltree.utils.ts`):
 * - `isAncestorOrEqual(ancestor, child)` — ancestor path is ancestor of (or equal to) child path
 *
 * ## Union Strategy
 *
 * Results from all access paths are combined using UNION, which automatically deduplicates
 * user IDs. This ensures each accessible user appears exactly once in the result set.
 */
export class UserAccessControls {
  constructor(protected readonly db: NodePgDatabase<typeof CoreDbSchema> = CoreDbClient) {}

  /**
   * Returns all user IDs a requesting user can access.
   *
   * Starts from the requesting user's memberships and finds all users they can see
   * based on org hierarchy, class/group memberships, and family relationships.
   * This is the core authorization query for user access.
   *
   * @example
   * ```ts
   * const accessibleUsers = userAccessControls.buildAccessibleUserIdsQuery({
   *   userId: 'user-123',
   *   allowedRoles: ['teacher', 'student'],
   * });
   *
   * // Use in another query to filter users
   * const users = await db
   *   .select()
   *   .from(users)
   *   .innerJoin(accessibleUsers.as('accessible'), eq(users.id, accessible.userId));
   * ```
   *
   * @param accessControlFilter - Filter containing userId and allowedRoles
   * @returns Drizzle subquery with `{ userId: string }` rows.
   *          Uses UNION to automatically deduplicate across access paths.
   * @throws {ZodError} If called with empty userId or allowedRoles
   */
  buildAccessibleUserIdsQuery(accessControlFilter: AccessControlFilter) {
    const { userId: requestingUserId, allowedRoles } = parseAccessControlFilter(accessControlFilter);

    const usersTable = alias(users, 'users_table');
    const supervisoryAllowedRoles = filterSupervisoryRoles(allowedRoles);
    const caretakerAllowedRoles = filterCaretakerRoles(allowedRoles);

    // ─────────────────────────────────────────────────────────────────────────–––––––
    // NON-SUPERVISORY ACCESS: Users without supervisory roles see only themselves
    // ─────────────────────────────────────────────────────────────────────────–––––––
    if (supervisoryAllowedRoles.length === 0) {
      return this.db.select({ userId: usersTable.id }).from(usersTable).where(eq(usersTable.id, requestingUserId));
    }

    // ─────────────────────────────────────────────────────────────────────────–––––––
    // SUPERVISORY ACCESS: Multiple paths to find accessible users
    // ─────────────────────────────────────────────────────────────────────────–––––––

    // Shared aliases for org-based queries
    const requesterUserOrgs = alias(userOrgs, 'requester_user_orgs');
    const requesterOrgsTable = alias(orgs, 'requester_orgs_table');
    const targetOrgsTable = alias(orgs, 'target_orgs_table');

    // PATH 1: Via org hierarchy (district/school admin → users in descendant orgs)
    const viaUserOrgToDescendantOrg = this.db
      .select({ userId: userOrgs.userId })
      .from(requesterUserOrgs)
      // Get all orgs the user is a member of
      .innerJoin(requesterOrgsTable, eq(requesterOrgsTable.id, requesterUserOrgs.orgId))
      // This is an exhaustive of all orgs the user is a member of and descendent orgs that they can see
      .innerJoin(targetOrgsTable, isAncestorOrEqual(requesterOrgsTable.path, targetOrgsTable.path))
      // This is an exhaustive list of all user orgs memberships
      .innerJoin(userOrgs, eq(userOrgs.orgId, targetOrgsTable.id))
      .where(
        and(
          isAuthorizedMembership(requesterUserOrgs, requestingUserId, supervisoryAllowedRoles),
          isEnrollmentActive(userOrgs),
        ),
      );

    // PATH 2: Via org → class (district/school admin → users in classes under their orgs)
    const targetClassesTable = alias(classes, 'target_classes_table');
    const viaUserOrgToDescendantClass = this.db
      .select({
        userId: userClasses.userId,
      })
      .from(requesterUserOrgs)
      // Get all orgs the user is a member of
      .innerJoin(requesterOrgsTable, eq(requesterOrgsTable.id, requesterUserOrgs.orgId))
      // Get all classes that are descendants of all of the user's orgs
      .innerJoin(targetClassesTable, isAncestorOrEqual(requesterOrgsTable.path, targetClassesTable.orgPath))
      // This is an exhaustive list of classes the user has access to via their orgs
      .innerJoin(userClasses, eq(userClasses.classId, targetClassesTable.id))
      .where(
        and(
          isAuthorizedMembership(requesterUserOrgs, requestingUserId, supervisoryAllowedRoles),
          isEnrollmentActive(userClasses),
        ),
      );

    // PATH 3: Direct class membership (teacher → students in their classes)
    const requesterUserClasses = alias(userClasses, 'requester_user_classes');
    const viaDirectClass = this.db
      .select({ userId: userClasses.userId })
      .from(requesterUserClasses)
      .innerJoin(userClasses, eq(requesterUserClasses.classId, userClasses.classId))
      .where(
        and(
          isAuthorizedMembership(requesterUserClasses, requestingUserId, supervisoryAllowedRoles),
          isEnrollmentActive(userClasses),
        ),
      );

    // PATH 4: Direct group membership (group leader → users in their groups)
    const requesterUserGroups = alias(userGroups, 'requester_user_groups');
    const viaDirectGroup = this.db
      .select({ userId: userGroups.userId })
      .from(requesterUserGroups)
      .innerJoin(userGroups, eq(requesterUserGroups.groupId, userGroups.groupId))
      .where(
        and(
          isAuthorizedMembership(requesterUserGroups, requestingUserId, supervisoryAllowedRoles),
          isEnrollmentActive(userGroups),
        ),
      );

    // PATH 5: Direct family membership (family member → other family members, no supervisory role needed)
    const requesterUserFamilies = alias(userFamilies, 'requester_user_families');
    const viaDirectFamily = this.db
      .select({ userId: userFamilies.userId })
      .from(requesterUserFamilies)
      .innerJoin(userFamilies, eq(requesterUserFamilies.familyId, userFamilies.familyId))
      .where(
        and(
          isAuthorizedFamily(requesterUserFamilies, requestingUserId, caretakerAllowedRoles),
          isActiveInFamily(userFamilies),
        ),
      );

    // ─────────────────────────────────────────────────────────────────────────–––––––
    // UNION: Combine all access paths and deduplicate
    // ─────────────────────────────────────────────────────────────────────────–––––––

    return viaUserOrgToDescendantOrg
      .union(viaUserOrgToDescendantClass)
      .union(viaDirectClass)
      .union(viaDirectGroup)
      .union(viaDirectFamily);
  }
}
