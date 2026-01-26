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
} from '../db/schema';
import { SUPERVISORY_ROLES } from '../constants/role-classifications';
import { CoreDbClient } from '../db/clients';
import type * as CoreDbSchema from '../db/schema/core';
import type { UserRole } from '../enums/user-role.enum';
import { logger } from '../logger';

/**
 * Authorization filter for repository queries.
 * Encapsulates user identity and allowed roles for access control.
 */
export interface AuthorizationFilter {
  userId: string;
  allowedRoles: UserRole[];
}

/**
 * Authorization Repository
 *
 * Provides centralized authorization query building for resource access control.
 * Uses PostgreSQL ltree extension for efficient hierarchical queries.
 *
 * This repository does not extend BaseRepository because it doesn't manage a single table.
 * Instead, it provides query builders that other repositories can use to filter
 * resources based on user authorization.
 *
 *
 * Hierarchical Authorization Model:
 *
 * The hierarchy traversal supports two access patterns applied depending on user roles.
 *
 * "Look UP" (all roles) - Users see resources assigned to their entity or ancestors, for example:
 * - User in school sees resources assigned to parent district
 * - User in class sees resources assigned to school or district
 *
 * "Look DOWN" (supervisory roles) - Additionally, users also see resources on descendants, for example:
 * - User in district sees resources assigned to child schools/classes
 * - User in school sees resources assigned to classes in that school
 *
 *
 * Database ltree Usage:
 *
 * ltree is used to represent organizational hierarchy paths for efficient ancestor/descendant queries.
 * ltree paths are maintained by database triggers.
 *
 * ltree operators used (raw SQL required - not supported by Drizzle helpers):
 * - `path1 <@ path2`: path1 is descendant of (or equal to) path2
 * - `path1 @> path2`: path1 is ancestor of (or equal to) path2
 *
 * Format: {org_type}_{uuid} where hyphens in UUID are replaced with underscores.
 * Hierarchical paths are dot-separated: parent_segment.child_segment
 *
 * For example:
 * - 'district_550e8400_e29b_41d4_a716_446655440000' (single org)
 * - 'district_550e8400_e29b_41d4_a716_446655440000.school_a1b2c3d4_5e6f_7a8b_9c0d_1e2f3a4b5c6d' (hierarchy)
 *
 * IMPORTANT: Performance depends on these PostgreSQL GiST indexes:
 * - orgs_path_gist_idx (app.orgs.path)
 * - classes_org_path_gist_idx (app.classes.org_path)
 */
export class AuthorizationRepository {
  constructor(protected readonly db: NodePgDatabase<typeof CoreDbSchema> = CoreDbClient) {}

  /**
   * Build a UNION query of all administration IDs the user can access.
   *
   * Uses ltree path queries for efficient hierarchical access control.
   * Results are deduplicated via UNION (not UNION ALL) since we only need unique IDs.
   *
   * @param authorization - User ID and allowed roles for access control
   * @returns A Drizzle subquery returning `{ administrationId: string }` rows. Use with `.as('alias')` for joins.
   */
  buildAccessibleAdministrationIdsQuery(authorization: AuthorizationFilter) {
    const { userId, allowedRoles } = authorization;

    if (allowedRoles.length === 0) {
      logger.warn(
        { userId },
        'buildAccessibleAdministrationIdsQuery called with empty allowedRoles - possible permission configuration issue',
      );
    }

    // Create table aliases for self-joins on orgs
    const adminOrg = alias(orgs, 'admin_org');
    const userOrg = alias(orgs, 'user_org');

    // =========================================================================
    // LOOK UP paths (all roles)
    // =========================================================================

    // Path 1: User in org → admin assigned to org
    // User sees administrations assigned to their org level or any ancestor org
    // ltree: user_org.path <@ admin_org.path (user is descendant of or equal to admin's org)
    const viaUserOrgToAdminOrg = this.db
      .select({ administrationId: administrationOrgs.administrationId })
      .from(administrationOrgs)
      .innerJoin(adminOrg, eq(adminOrg.id, administrationOrgs.orgId))
      .innerJoin(userOrgs, eq(userOrgs.userId, userId))
      .innerJoin(userOrg, eq(userOrg.id, userOrgs.orgId))
      .where(and(inArray(userOrgs.role, allowedRoles), sql`${userOrg.path} <@ ${adminOrg.path}`));

    // Path 2: User in class → admin assigned to org
    // User sees administrations assigned to the class's school or any ancestor org
    // ltree: class.org_path <@ admin_org.path
    const viaUserClassToAdminOrg = this.db
      .select({ administrationId: administrationOrgs.administrationId })
      .from(administrationOrgs)
      .innerJoin(adminOrg, eq(adminOrg.id, administrationOrgs.orgId))
      .innerJoin(userClasses, eq(userClasses.userId, userId))
      .innerJoin(classes, eq(classes.id, userClasses.classId))
      .where(and(inArray(userClasses.role, allowedRoles), sql`${classes.orgPath} <@ ${adminOrg.path}`));

    // Path 3: User in class → admin assigned to class (direct match)
    const viaDirectClass = this.db
      .select({ administrationId: administrationClasses.administrationId })
      .from(administrationClasses)
      .innerJoin(userClasses, eq(userClasses.classId, administrationClasses.classId))
      .where(and(eq(userClasses.userId, userId), inArray(userClasses.role, allowedRoles)));

    // Path 4: User in group → admin assigned to group (direct match)
    // Groups are standalone entities with no hierarchy
    const viaDirectGroup = this.db
      .select({ administrationId: administrationGroups.administrationId })
      .from(administrationGroups)
      .innerJoin(userGroups, eq(userGroups.groupId, administrationGroups.groupId))
      .where(and(eq(userGroups.userId, userId), inArray(userGroups.role, allowedRoles)));

    // Build base union (paths 1-4, all roles)
    // Uses UNION (not UNION ALL) for deduplication since we only need unique administration IDs.
    // Performance note: UNION adds sort+dedup overhead, but result sets are typically smalln and
    // deduplication is required since a user can access the same administration via multiple
    // paths (e.g., both org membership and direct class assignment).
    let union = viaUserOrgToAdminOrg.union(viaUserClassToAdminOrg).union(viaDirectClass).union(viaDirectGroup);

    // =========================================================================
    // LOOK DOWN paths (supervisory roles only)
    // =========================================================================

    const supervisoryAllowedRoles = allowedRoles.filter((role) => SUPERVISORY_ROLES.includes(role));

    if (supervisoryAllowedRoles.length > 0) {
      // Path 5: User in org → admin assigned to descendant org (or same org)
      // Supervisory user sees administrations assigned to any org at or below their org
      // ltree: admin_org.path <@ user_org.path (admin is descendant of or equal to user's org)
      // Note: Overlap with Path 1 at equality is handled by UNION deduplication
      const viaUserOrgToDescendantOrg = this.db
        .select({ administrationId: administrationOrgs.administrationId })
        .from(administrationOrgs)
        .innerJoin(adminOrg, eq(adminOrg.id, administrationOrgs.orgId))
        .innerJoin(userOrgs, eq(userOrgs.userId, userId))
        .innerJoin(userOrg, eq(userOrg.id, userOrgs.orgId))
        .where(and(inArray(userOrgs.role, supervisoryAllowedRoles), sql`${adminOrg.path} <@ ${userOrg.path}`));

      // Path 6: User in org → admin assigned to class under user's org
      // Supervisory user sees administrations on classes anywhere in their org subtree
      // ltree: class.org_path <@ user_org.path
      const viaUserOrgToDescendantClass = this.db
        .select({ administrationId: administrationClasses.administrationId })
        .from(administrationClasses)
        .innerJoin(classes, eq(classes.id, administrationClasses.classId))
        .innerJoin(userOrgs, eq(userOrgs.userId, userId))
        .innerJoin(userOrg, eq(userOrg.id, userOrgs.orgId))
        .where(and(inArray(userOrgs.role, supervisoryAllowedRoles), sql`${classes.orgPath} <@ ${userOrg.path}`));

      union = union.union(viaUserOrgToDescendantOrg).union(viaUserOrgToDescendantClass);
    }

    return union;
  }

  /**
   * Build a query to get all user-administration assignments for given administration IDs.
   *
   * Returns tuples of (administrationId, userId) for all users who are assigned to the
   * given administrations via org/class/group membership. Uses ltree for hierarchy traversal:
   * - Administration assigned to a district → includes users from all schools and classes in that district
   * - Administration assigned to a school → includes users from all classes in that school
   *
   * Note: Uses UNION ALL (not UNION) because we explicitly want to preserve duplicates
   * for accurate counting. A user can be assigned to an administration via multiple paths
   * (e.g., both via org membership and class membership). Callers MUST use
   * COUNT(DISTINCT userId) to get unique user counts.
   *
   * @param administrationIds - Array of administration IDs to get assignments for
   * @returns A Drizzle subquery returning `{ administrationId: string, userId: string }` rows. Use with `.as('alias')` for aggregation.
   */
  buildAdministrationUserAssignmentsQuery(administrationIds: string[]) {
    // Create table aliases for self-joins on orgs
    const adminOrg = alias(orgs, 'admin_org');
    const userOrg = alias(orgs, 'user_org');

    // Path 1: Admin assigned to org → users in that org or any descendant org
    // ltree: user_org.path <@ admin_org.path (raw SQL required for ltree operators)
    const viaOrgToOrgUsers = this.db
      .select({
        administrationId: administrationOrgs.administrationId,
        userId: userOrgs.userId,
      })
      .from(administrationOrgs)
      .innerJoin(adminOrg, eq(adminOrg.id, administrationOrgs.orgId))
      .innerJoin(userOrg, sql`${userOrg.path} <@ ${adminOrg.path}`)
      .innerJoin(userOrgs, eq(userOrgs.orgId, userOrg.id))
      .where(inArray(administrationOrgs.administrationId, administrationIds));

    // Path 2: Admin assigned to org → users in classes under that org
    // ltree: class.org_path <@ admin_org.path (raw SQL required for ltree operators)
    const viaOrgToClassUsers = this.db
      .select({
        administrationId: administrationOrgs.administrationId,
        userId: userClasses.userId,
      })
      .from(administrationOrgs)
      .innerJoin(adminOrg, eq(adminOrg.id, administrationOrgs.orgId))
      .innerJoin(classes, sql`${classes.orgPath} <@ ${adminOrg.path}`)
      .innerJoin(userClasses, eq(userClasses.classId, classes.id))
      .where(inArray(administrationOrgs.administrationId, administrationIds));

    // Path 3: Admin assigned to class → users in that class (direct)
    const viaDirectClass = this.db
      .select({
        administrationId: administrationClasses.administrationId,
        userId: userClasses.userId,
      })
      .from(administrationClasses)
      .innerJoin(userClasses, eq(userClasses.classId, administrationClasses.classId))
      .where(inArray(administrationClasses.administrationId, administrationIds));

    // Path 4: Admin assigned to group → users in that group (direct)
    // Groups are standalone, no hierarchy
    const viaDirectGroup = this.db
      .select({
        administrationId: administrationGroups.administrationId,
        userId: userGroups.userId,
      })
      .from(administrationGroups)
      .innerJoin(userGroups, eq(userGroups.groupId, administrationGroups.groupId))
      .where(inArray(administrationGroups.administrationId, administrationIds));

    // Combine with UNION ALL (not UNION) to preserve duplicates intentionally.
    // Performance note: UNION ALL is faster (no sort/dedup), but requires COUNT(DISTINCT userId)
    // in the aggregation query. We need duplicates because a user can be assigned via multiple
    // paths, and we want accurate per-administration counts without losing any assignments.
    return viaOrgToOrgUsers.unionAll(viaOrgToClassUsers).unionAll(viaDirectClass).unionAll(viaDirectGroup);
  }

  /**
   * Get count of assigned users for multiple administrations.
   *
   * A user is "assigned" to an administration if they belong to an org, class, or group
   * that is linked to that administration. This respects the org hierarchy:
   * - Administration assigned to a district → includes users from all schools and classes in that district
   * - Administration assigned to a school → includes users from all classes in that school
   *
   * @param administrationIds - Array of administration IDs to count assigned users for
   * @returns Map of administration ID to assigned user count.
   *          Administrations with zero assignments are NOT included in the map.
   *          Use `map.get(id) ?? 0` to default to zero for missing entries.
   */
  async getAssignedUserCountsByAdministrationIds(administrationIds: string[]): Promise<Map<string, number>> {
    if (administrationIds.length === 0) {
      return new Map();
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
