import { and, eq, sql } from 'drizzle-orm';
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
import {
  filterSupervisoryRoles,
  filterCaretakerRoles,
  filterHierarchicalUserAccessRoles,
} from '../utils/supervisory-roles.utils';

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
 * District (supervisory role)    → That district and descendant orgs
 * School (supervisory role)      → That school and descendant orgs
 * Class (supervisory role)       → That class
 * Group (supervisory role)       → That group
 * Family (any role)              → That family
 * ```
 *
 * ## Access Patterns
 *
 * **Self-access** — Handled at the service layer:
 * - Every user can access their own profile via service-layer check
 * - Not included in access controls queries to simplify union logic
 *
 * **Non-supervisory users** — No additional access beyond self:
 * - Students with no supervisory roles rely on service-layer self-access check
 *
 * **Supervisory users** — Access users through multiple paths:
 * - **PATH 1 - Via org hierarchy**: District/school admins see users in descendant orgs
 * - **PATH 2 - Via org→class**: District/school admins see users in classes under their orgs
 * - **PATH 3 - Via direct class**: Teachers see users in their directly assigned classes
 * - **PATH 4 - Via direct group**: Group leaders see users in their groups
 * - **PATH 5 - Via family**: Family members see each other (no supervisory role required)
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
    const hierarchicalUserAccessRoles = filterHierarchicalUserAccessRoles(allowedRoles);

    // ─────────────────────────────────────────────────────────────────────────–––––
    // NON-SUPERVISORY, NON-CARETAKER ACCESS: Return empty result set
    // Self-access is handled at the service layer
    // ─────────────────────────────────────────────────────────────────────────–––––
    if (supervisoryAllowedRoles.length === 0 && caretakerAllowedRoles.length === 0) {
      // Return a query that matches no users (service layer handles self-access)
      return this.db
        .select({ userId: usersTable.id })
        .from(usersTable)
        .where(sql`false`);
    }

    // ─────────────────────────────────────────────────────────────────────────–––––
    // SUPERVISORY/CARETAKER ACCESS: Multiple paths through memberships
    // Note: Self-access is handled at service layer, not in these queries
    // ─────────────────────────────────────────────────────────────────────────–––––

    let query;

    // Only add supervisory paths if user has supervisory roles
    if (supervisoryAllowedRoles.length > 0) {
      // PATH 1 & 2: Hierarchical org access (admin roles only)
      // Teachers are excluded — they only access users via PATH 3 (direct class membership)
      if (hierarchicalUserAccessRoles.length > 0) {
        // Shared aliases for org-based queries
        const requesterUserOrgs = alias(userOrgs, 'requester_user_orgs');
        const requesterOrgsTable = alias(orgs, 'requester_orgs_table');
        const targetUserOrgs = alias(userOrgs, 'target_user_orgs');
        const targetOrgsTable = alias(orgs, 'target_orgs_table');

        // PATH 1: Via org hierarchy (admin roles only → users in descendant orgs)
        const viaUserOrgToDescendantOrg = this.db
          .select({ userId: targetUserOrgs.userId })
          .from(requesterUserOrgs)
          // Get all orgs the user is a member of
          .innerJoin(requesterOrgsTable, eq(requesterOrgsTable.id, requesterUserOrgs.orgId))
          // This is an exhaustive of all orgs the user is a member of and descendent orgs that they can see
          .innerJoin(targetOrgsTable, isAncestorOrEqual(requesterOrgsTable.path, targetOrgsTable.path))
          // This is an exhaustive list of all user orgs memberships
          .innerJoin(targetUserOrgs, eq(targetUserOrgs.orgId, targetOrgsTable.id))
          .where(
            and(
              isAuthorizedMembership(requesterUserOrgs, requestingUserId, hierarchicalUserAccessRoles),
              isEnrollmentActive(targetUserOrgs),
            ),
          );

        // PATH 2: Via org → class (admin roles only → users in classes under their orgs)
        const targetUserClasses = alias(userClasses, 'target_user_classes');
        const targetClassesTable = alias(classes, 'target_classes_table');
        const viaUserOrgToDescendantClass = this.db
          .select({
            userId: targetUserClasses.userId,
          })
          .from(requesterUserOrgs)
          // Get all orgs the user is a member of
          .innerJoin(requesterOrgsTable, eq(requesterOrgsTable.id, requesterUserOrgs.orgId))
          // Get all classes that are descendants of all of the user's orgs
          .innerJoin(targetClassesTable, isAncestorOrEqual(requesterOrgsTable.path, targetClassesTable.orgPath))
          // This is an exhaustive list of classes the user has access to via their orgs
          .innerJoin(targetUserClasses, eq(targetUserClasses.classId, targetClassesTable.id))
          .where(
            and(
              isAuthorizedMembership(requesterUserOrgs, requestingUserId, hierarchicalUserAccessRoles),
              isEnrollmentActive(targetUserClasses),
            ),
          );

        // Start with hierarchical paths
        query = viaUserOrgToDescendantOrg.union(viaUserOrgToDescendantClass);
      }

      // PATH 3: Direct class membership (teacher/admin → users in their directly assigned classes)
      // This is the ONLY path teachers use to access users
      const requesterUserClasses = alias(userClasses, 'requester_user_classes');
      const targetUserClasses = alias(userClasses, 'target_user_classes');
      const viaDirectClass = this.db
        .select({ userId: targetUserClasses.userId })
        .from(requesterUserClasses)
        .innerJoin(targetUserClasses, eq(requesterUserClasses.classId, targetUserClasses.classId))
        .where(
          and(
            isAuthorizedMembership(requesterUserClasses, requestingUserId, supervisoryAllowedRoles),
            isEnrollmentActive(targetUserClasses),
          ),
        );

      // PATH 4: Direct group membership (group leader → users in their groups)
      const requesterUserGroups = alias(userGroups, 'requester_user_groups');
      const targetUserGroups = alias(userGroups, 'target_user_groups');
      const viaDirectGroup = this.db
        .select({ userId: targetUserGroups.userId })
        .from(requesterUserGroups)
        .innerJoin(targetUserGroups, eq(requesterUserGroups.groupId, targetUserGroups.groupId))
        .where(
          and(
            isAuthorizedMembership(requesterUserGroups, requestingUserId, supervisoryAllowedRoles),
            isEnrollmentActive(targetUserGroups),
          ),
        );

      // Union direct class and group paths
      query = query ? query.union(viaDirectClass).union(viaDirectGroup) : viaDirectClass.union(viaDirectGroup);
    }

    // Only add caretaker path if user has caretaker roles
    if (caretakerAllowedRoles.length > 0) {
      // PATH 5: Direct family membership (family member → other family members, no supervisory role needed)
      const requesterUserFamilies = alias(userFamilies, 'requester_user_families');
      const targetUserFamilies = alias(userFamilies, 'target_user_families');

      // TODO: Schema inconsistency - user_families.role uses user_family_role enum ['parent', 'child']
      // while user_orgs.role uses the full userRoleEnum which includes ['guardian', 'parent', 'relative'].
      // Until a migration adds 'guardian' and 'relative' to user_family_role enum, we map all
      // caretaker UserRole values to 'parent' when querying families. This means guardians and
      // relatives are treated as parents in the family context.
      // ISSUE: https://github.com/yeatmanlab/roar-project-management/issues/1707
      const familyRoles = ['parent'];

      const viaDirectFamily = this.db
        .select({ userId: targetUserFamilies.userId })
        .from(requesterUserFamilies)
        .innerJoin(targetUserFamilies, eq(requesterUserFamilies.familyId, targetUserFamilies.familyId))
        .where(
          and(
            isAuthorizedFamily(requesterUserFamilies, requestingUserId, familyRoles),
            isActiveInFamily(targetUserFamilies),
          ),
        );

      // Union family path with existing query (or start with it if no supervisory paths)
      query = query ? query.union(viaDirectFamily) : viaDirectFamily;
    }

    // Query is guaranteed to be defined because we have supervisory or caretaker roles
    return query!;
  }
}
