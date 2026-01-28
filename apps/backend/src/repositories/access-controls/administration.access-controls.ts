import { and, eq, inArray, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  administrationOrgs,
  administrationClasses,
  administrationGroups,
  userOrgs,
  userClasses,
  userGroups,
  orgs,
  classes,
} from '../../db/schema';
import { SUPERVISORY_ROLES } from '../../constants/role-classifications';
import { CoreDbClient } from '../../db/clients';
import type * as CoreDbSchema from '../../db/schema/core';
import { logger } from '../../logger';
import { parseAccessControlFilter, type AccessControlFilter } from './access-controls.utils';

/**
 * Administration Access Controls
 *
 * Builds SQL queries to determine what administrations a user can access based on their
 * org/class/group memberships. Used by other repositories to filter query results.
 *
 * ## How Access Works
 *
 * Users gain access to administrations through their memberships:
 *
 * ```
 * User belongs to:          Can see administrations assigned to:
 * ─────────────────         ──────────────────────────────────────
 * District                  → That district (and descendants if supervisory)
 * School                    → That school, parent district (and descendants if supervisory)
 * Class                     → That class, parent school, parent district
 * Group                     → That group only
 * ```
 *
 * ## Access Patterns
 *
 * **Ancestor access (all roles)** — Users see administrations on their entity or ancestors:
 * - Student in School A sees administrations assigned to School A or its parent District
 * - Student in Class X sees administrations assigned to Class X, School A, or District
 *
 * **Descendant access (supervisory roles only)** — Supervisors also see administrations on descendants:
 * - Admin in District sees administrations on all child Schools and Classes
 * - Teacher in School sees administrations on Classes in that School
 *
 * ## ltree for Hierarchy Queries
 *
 * We use PostgreSQL's ltree extension to efficiently query ancestor/descendant relationships.
 * Paths are stored as dot-separated segments: `district_uuid.school_uuid`
 *
 * Key operators (require raw SQL):
 * - `child <@ parent` — child is descendant of (or equal to) parent
 * - `parent @> child` — parent is ancestor of (or equal to) child
 */
export class AdministrationAccessControls {
  constructor(protected readonly db: NodePgDatabase<typeof CoreDbSchema> = CoreDbClient) {}

  /**
   * Returns all administration IDs a user can access.
   *
   * Starts from the user's memberships (typically small) and finds all administrations
   * they can see based on org hierarchy. This is the core authorization query.
   *
   * @example
   * ```ts
   * const accessibleAdmins = adminAccessControls.buildUserAdministrationIdsQuery({
   *   userId: 'user-123',
   *   allowedRoles: ['student', 'teacher'],
   * });
   *
   * // Use in another query
   * const admins = await db
   *   .select()
   *   .from(administrations)
   *   .innerJoin(accessibleAdmins.as('accessible'), eq(administrations.id, accessible.administrationId));
   * ```
   *
   * @param accessControlFilter - Filter containing userId and allowedRoles
   * @returns Drizzle subquery with `{ administrationId: string }` rows.
   *          Uses UNION to automatically deduplicate across access paths.
   * @throws {ZodError} If called with empty userId or allowedRoles
   */
  buildUserAdministrationIdsQuery(accessControlFilter: AccessControlFilter) {
    const { userId, allowedRoles } = parseAccessControlFilter(accessControlFilter);

    // Aliases for the orgs table (needed because we join it twice in the same query)
    const adminOrgTable = alias(orgs, 'admin_org'); // Org where the administration is assigned
    const userOrgTable = alias(orgs, 'user_org'); // Org where the user has membership

    // ─────────────────────────────────────────────────────────────────────────–––––––
    // ANCESTOR ACCESS: Find administrations on user's entity or ancestors (all roles)
    // ─────────────────────────────────────────────────────────────────────────–––––––

    // Path 1: User's org membership → admins on that org or ancestor orgs
    // Example: User in School A sees admins assigned to School A or parent District
    const viaUserOrgToAdminOrg = this.db
      .select({ administrationId: administrationOrgs.administrationId })
      .from(userOrgs)
      .innerJoin(userOrgTable, eq(userOrgTable.id, userOrgs.orgId)) // get the org details for user's membership
      .innerJoin(adminOrgTable, sql`${userOrgTable.path} <@ ${adminOrgTable.path}`) // find orgs that are ancestors of (or equal to) user's org
      .innerJoin(administrationOrgs, eq(administrationOrgs.orgId, adminOrgTable.id)) // get administrations assigned to those ancestor orgs
      .where(and(eq(userOrgs.userId, userId), inArray(userOrgs.role, allowedRoles)));

    // Path 2: User's class membership → admins on the class's school or ancestor orgs
    // Example: User in Class X sees admins assigned to School A or parent District
    const viaUserClassToAdminOrg = this.db
      .select({ administrationId: administrationOrgs.administrationId })
      .from(userClasses)
      .innerJoin(classes, eq(classes.id, userClasses.classId)) // get the class details for user's membership
      .innerJoin(adminOrgTable, sql`${classes.orgPath} <@ ${adminOrgTable.path}`) // find orgs that are ancestors of (or equal to) class's org
      .innerJoin(administrationOrgs, eq(administrationOrgs.orgId, adminOrgTable.id)) // get administrations assigned to those ancestor orgs
      .where(and(eq(userClasses.userId, userId), inArray(userClasses.role, allowedRoles)));

    // Path 3: User's class membership → admins assigned directly to that class
    const viaDirectClass = this.db
      .select({ administrationId: administrationClasses.administrationId })
      .from(userClasses)
      .innerJoin(administrationClasses, eq(administrationClasses.classId, userClasses.classId)) // get administrations assigned to user's class
      .where(and(eq(userClasses.userId, userId), inArray(userClasses.role, allowedRoles)));

    // Path 4: User's group membership → admins assigned directly to that group
    const viaDirectGroup = this.db
      .select({ administrationId: administrationGroups.administrationId })
      .from(userGroups)
      .innerJoin(administrationGroups, eq(administrationGroups.groupId, userGroups.groupId)) // get administrations assigned to user's group
      .where(and(eq(userGroups.userId, userId), inArray(userGroups.role, allowedRoles)));

    // Combine ancestor paths with UNION to deduplicate results
    const ancestorUnion = viaUserOrgToAdminOrg
      .union(viaUserClassToAdminOrg)
      .union(viaDirectClass)
      .union(viaDirectGroup);

    // ─────────────────────────────────────────────────────────────────────────–––––––
    // DESCENDANT ACCESS: Find administrations on descendants (supervisory roles only)
    // ─────────────────────────────────────────────────────────────────────────–––––––

    const supervisoryAllowedRoles = allowedRoles.filter((role) => SUPERVISORY_ROLES.includes(role));

    if (supervisoryAllowedRoles.length === 0) {
      if (allowedRoles.length > 0) {
        logger.debug({ userId, allowedRoles }, 'No supervisory roles provided, skipping descendant paths');
      }
      return ancestorUnion;
    }

    // Path 5: User's org membership → admins on descendant orgs
    // Example: Admin in District sees admins assigned to child Schools
    const viaUserOrgToDescendantOrg = this.db
      .select({ administrationId: administrationOrgs.administrationId })
      .from(userOrgs)
      .innerJoin(userOrgTable, eq(userOrgTable.id, userOrgs.orgId)) // get the org details for user's membership
      .innerJoin(adminOrgTable, sql`${adminOrgTable.path} <@ ${userOrgTable.path}`) // find orgs that are descendants of (or equal to) user's org
      .innerJoin(administrationOrgs, eq(administrationOrgs.orgId, adminOrgTable.id)) // get administrations assigned to those descendant orgs
      .where(and(eq(userOrgs.userId, userId), inArray(userOrgs.role, supervisoryAllowedRoles)));

    // Path 6: User's org membership → admins on classes within user's org tree
    // Example: Admin in District sees admins assigned to Classes in child Schools
    const viaUserOrgToDescendantClass = this.db
      .select({ administrationId: administrationClasses.administrationId })
      .from(userOrgs)
      .innerJoin(userOrgTable, eq(userOrgTable.id, userOrgs.orgId)) // get the org details for user's membership
      .innerJoin(classes, sql`${classes.orgPath} <@ ${userOrgTable.path}`) // find classes that are within (descendants of) user's org
      .innerJoin(administrationClasses, eq(administrationClasses.classId, classes.id)) // get administrations assigned to those classes
      .where(and(eq(userOrgs.userId, userId), inArray(userOrgs.role, supervisoryAllowedRoles)));

    return ancestorUnion.union(viaUserOrgToDescendantOrg).union(viaUserOrgToDescendantClass);
  }

  /**
   * Returns all users assigned to the given administrations.
   *
   * This is the inverse of `buildUserAdministrationIdsQuery` — given administrations,
   * find all users who should have access. Respects org hierarchy:
   * - Admin assigned to District → includes users in that District + all child Schools + all Classes
   * - Admin assigned to School → includes users in that School + all Classes in it
   * - Admin assigned to Class/Group → includes only users directly in that Class/Group
   *
   * @param administrationIds - Array of administration IDs to query
   * @returns Drizzle subquery with `{ administrationId: string, userId: string }` rows.
   *          Uses UNION ALL for performance (no deduplication). A user with multiple paths
   *          to an administration appears multiple times. Always use `COUNT(DISTINCT userId)`
   *          when aggregating.
   * @throws {Error} If called with empty administrationIds array
   */
  buildAdministrationUserAssignmentsQuery(administrationIds: string[]) {
    if (administrationIds.length === 0) {
      throw new Error('administrationIds are required for building user assignments query');
    }

    // Aliases for the orgs table (needed because we join it twice in the same query)
    const adminOrgTable = alias(orgs, 'admin_org'); // Org where the administration is assigned
    const userOrgTable = alias(orgs, 'user_org'); // Org where the user has membership

    // Path 1: Administration assigned to org → users in that org or descendant orgs
    // Example: Administration on District → users in District, Schools, etc.
    const viaOrgToOrgUsers = this.db
      .select({
        administrationId: administrationOrgs.administrationId,
        userId: userOrgs.userId,
      })
      .from(administrationOrgs)
      .innerJoin(adminOrgTable, eq(adminOrgTable.id, administrationOrgs.orgId)) // get the org where administration is assigned
      .innerJoin(userOrgTable, sql`${userOrgTable.path} <@ ${adminOrgTable.path}`) // find orgs that are descendants of (or equal to) admin's org
      .innerJoin(userOrgs, eq(userOrgs.orgId, userOrgTable.id)) // get users who belong to those descendant orgs
      .where(inArray(administrationOrgs.administrationId, administrationIds));

    // Path 2: Administration assigned to org → users in classes under that org
    // Example: Administration on District → users in Classes within that District
    const viaOrgToClassUsers = this.db
      .select({
        administrationId: administrationOrgs.administrationId,
        userId: userClasses.userId,
      })
      .from(administrationOrgs)
      .innerJoin(adminOrgTable, eq(adminOrgTable.id, administrationOrgs.orgId)) // get the org where administration is assigned
      .innerJoin(classes, sql`${classes.orgPath} <@ ${adminOrgTable.path}`) // find classes that are within (descendants of) admin's org
      .innerJoin(userClasses, eq(userClasses.classId, classes.id)) // get users who belong to those classes
      .where(inArray(administrationOrgs.administrationId, administrationIds));

    // Path 3: Admin assigned to class → users in that class
    const viaDirectClass = this.db
      .select({
        administrationId: administrationClasses.administrationId,
        userId: userClasses.userId,
      })
      .from(administrationClasses)
      .innerJoin(userClasses, eq(userClasses.classId, administrationClasses.classId)) // get users who belong to the administration's class
      .where(inArray(administrationClasses.administrationId, administrationIds));

    // Path 4: Admin assigned to group → users in that group
    const viaDirectGroup = this.db
      .select({
        administrationId: administrationGroups.administrationId,
        userId: userGroups.userId,
      })
      .from(administrationGroups)
      .innerJoin(userGroups, eq(userGroups.groupId, administrationGroups.groupId)) // get users who belong to the administration's group
      .where(inArray(administrationGroups.administrationId, administrationIds));

    // UNION ALL preserves duplicates (faster than UNION, but requires COUNT(DISTINCT) later)
    return viaOrgToOrgUsers.unionAll(viaOrgToClassUsers).unionAll(viaDirectClass).unionAll(viaDirectGroup);
  }

  /**
   * Counts unique users assigned to each administration.
   *
   * @example
   * ```ts
   * const counts = await adminAccessControls.getAssignedUserCountsByAdministrationIds(['admin-1', 'admin-2']);
   * // Map { 'admin-1' => 25, 'admin-2' => 50 }
   *
   * // Administrations with 0 users are not in the map, so default to 0:
   * const count = counts.get('admin-3') ?? 0; // 0
   * ```
   *
   * @param administrationIds - Array of administration IDs to query
   * @returns Map of administrationId → user count
   * @throws {Error} If called with empty administrationIds array
   */
  async getAssignedUserCountsByAdministrationIds(administrationIds: string[]): Promise<Map<string, number>> {
    if (administrationIds.length === 0) {
      throw new Error('administrationIds required for getting assigned user counts');
    }

    const assignments = this.buildAdministrationUserAssignmentsQuery(administrationIds).as('assignments');

    const result = await this.db
      .select({
        administrationId: assignments.administrationId,
        assignedCount: sql<number>`COUNT(DISTINCT ${assignments.userId})::int`,
      })
      .from(assignments)
      .groupBy(assignments.administrationId);

    const countsMap = new Map<string, number>();
    for (const row of result) {
      countsMap.set(row.administrationId, row.assignedCount);
    }

    return countsMap;
  }
}
