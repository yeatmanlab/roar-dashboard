import { and, eq, inArray, sql } from 'drizzle-orm';
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
  groups,
} from '../db/schema';
import { SUPERVISORY_ROLES } from '../constants/role-classifications';
import { CoreDbClient } from '../db/clients';
import type * as CoreDbSchema from '../db/schema/core';
import type { UserRole } from '../enums/user-role.enum';

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
 * Implements the org hierarchy traversal logic used across different resources.
 *
 * This repository does NOT extend BaseRepository because it doesn't manage a single table.
 * Instead, it provides query builders that other repositories can use to filter
 * resources based on user authorization.
 *
 * The hierarchy traversal supports two access patterns:
 *
 * "Look UP" paths (all roles) - Users see resources assigned to their entity + parent entities:
 * - Direct org/class/group membership
 * - User in school sees resources assigned to parent district
 * - User in class sees resources assigned to school or district
 *
 * "Look DOWN" paths (supervisory roles only) - Users see resources on child entities:
 * - User in district sees resources assigned to child schools/classes
 * - User in school sees resources assigned to classes in that school
 * - User in group sees resources assigned to child groups
 */
export class AuthorizationRepository {
  constructor(protected readonly db: NodePgDatabase<typeof CoreDbSchema> = CoreDbClient) {}

  /**
   * Build a UNION query of all administration IDs the user can access.
   *
   * This respects the org hierarchy with two access patterns:
   *
   * "Look UP" paths (all roles) - see administrations on own entity + parent entities:
   * - Path 1: Direct org membership (user in district/school directly assigned)
   * - Path 2: User in school, admin assigned to parent district
   * - Path 3: User in class, admin assigned to district (via class.districtId)
   * - Path 4: User in class, admin assigned to school (via class.schoolId)
   * - Path 5: Direct class membership
   * - Path 6: Direct group membership
   *
   * "Look DOWN" paths (supervisory roles only) - see administrations on child entities:
   * - Path 7: User in district, admin assigned to child school
   * - Path 8: User in district, admin assigned to class under district
   * - Path 9: User in school, admin assigned to class under school
   * - Path 10: User in group, admin assigned to child group
   *
   * @param authorization - User ID and allowed roles for access control
   * @returns A subquery that can be used in WHERE clauses to filter administrations
   */
  buildAccessibleAdministrationIdsQuery(authorization: AuthorizationFilter) {
    const { userId, allowedRoles } = authorization;

    // Path 1: Direct org membership
    const viaDirectOrg = this.db
      .select({ administrationId: administrationOrgs.administrationId })
      .from(administrationOrgs)
      .innerJoin(userOrgs, eq(userOrgs.orgId, administrationOrgs.orgId))
      .where(and(eq(userOrgs.userId, userId), inArray(userOrgs.role, allowedRoles)));

    // Path 2: User in school, admin assigned to parent district
    const viaSchoolUnderDistrict = this.db
      .select({ administrationId: administrationOrgs.administrationId })
      .from(administrationOrgs)
      .innerJoin(orgs, eq(orgs.parentOrgId, administrationOrgs.orgId))
      .innerJoin(userOrgs, eq(userOrgs.orgId, orgs.id))
      .where(and(eq(userOrgs.userId, userId), inArray(userOrgs.role, allowedRoles)));

    // Path 3: User in class, admin assigned to district
    const viaClassUnderDistrict = this.db
      .select({ administrationId: administrationOrgs.administrationId })
      .from(administrationOrgs)
      .innerJoin(classes, eq(classes.districtId, administrationOrgs.orgId))
      .innerJoin(userClasses, eq(userClasses.classId, classes.id))
      .where(and(eq(userClasses.userId, userId), inArray(userClasses.role, allowedRoles)));

    // Path 4: User in class, admin assigned to school
    const viaClassUnderSchool = this.db
      .select({ administrationId: administrationOrgs.administrationId })
      .from(administrationOrgs)
      .innerJoin(classes, eq(classes.schoolId, administrationOrgs.orgId))
      .innerJoin(userClasses, eq(userClasses.classId, classes.id))
      .where(and(eq(userClasses.userId, userId), inArray(userClasses.role, allowedRoles)));

    // Path 5: Direct class membership
    const viaDirectClass = this.db
      .select({ administrationId: administrationClasses.administrationId })
      .from(administrationClasses)
      .innerJoin(userClasses, eq(userClasses.classId, administrationClasses.classId))
      .where(and(eq(userClasses.userId, userId), inArray(userClasses.role, allowedRoles)));

    // Path 6: Direct group membership
    const viaDirectGroup = this.db
      .select({ administrationId: administrationGroups.administrationId })
      .from(administrationGroups)
      .innerJoin(userGroups, eq(userGroups.groupId, administrationGroups.groupId))
      .where(and(eq(userGroups.userId, userId), inArray(userGroups.role, allowedRoles)));

    // Build base union (paths 1-6, all roles)
    let union = viaDirectOrg
      .union(viaSchoolUnderDistrict)
      .union(viaClassUnderDistrict)
      .union(viaClassUnderSchool)
      .union(viaDirectClass)
      .union(viaDirectGroup);

    // "Look DOWN" paths for supervisory roles only
    // Compute which allowed roles are also supervisory roles
    const supervisoryAllowedRoles = allowedRoles.filter((role) => SUPERVISORY_ROLES.includes(role));

    if (supervisoryAllowedRoles.length > 0) {
      // Path 7: User in district (org), admin assigned to child school
      const viaDistrictToChildSchool = this.db
        .select({ administrationId: administrationOrgs.administrationId })
        .from(administrationOrgs)
        .innerJoin(orgs, eq(orgs.id, administrationOrgs.orgId))
        .innerJoin(userOrgs, eq(userOrgs.orgId, orgs.parentOrgId))
        .where(and(eq(userOrgs.userId, userId), inArray(userOrgs.role, supervisoryAllowedRoles)));

      // Path 8: User in district (org), admin assigned to class under that district
      const viaDistrictToClass = this.db
        .select({ administrationId: administrationClasses.administrationId })
        .from(administrationClasses)
        .innerJoin(classes, eq(classes.id, administrationClasses.classId))
        .innerJoin(userOrgs, eq(userOrgs.orgId, classes.districtId))
        .where(and(eq(userOrgs.userId, userId), inArray(userOrgs.role, supervisoryAllowedRoles)));

      // Path 9: User in school (org), admin assigned to class under that school
      const viaSchoolToClass = this.db
        .select({ administrationId: administrationClasses.administrationId })
        .from(administrationClasses)
        .innerJoin(classes, eq(classes.id, administrationClasses.classId))
        .innerJoin(userOrgs, eq(userOrgs.orgId, classes.schoolId))
        .where(and(eq(userOrgs.userId, userId), inArray(userOrgs.role, supervisoryAllowedRoles)));

      // Path 10: User in group, admin assigned to child group
      const viaGroupToChildGroup = this.db
        .select({ administrationId: administrationGroups.administrationId })
        .from(administrationGroups)
        .innerJoin(groups, eq(groups.id, administrationGroups.groupId))
        .innerJoin(userGroups, eq(userGroups.groupId, groups.parentGroupId))
        .where(and(eq(userGroups.userId, userId), inArray(userGroups.role, supervisoryAllowedRoles)));

      union = union
        .union(viaDistrictToChildSchool)
        .union(viaDistrictToClass)
        .union(viaSchoolToClass)
        .union(viaGroupToChildGroup);
    }

    return union;
  }

  /**
   * Build a query to get all user-administration assignments for given administration IDs.
   *
   * Returns tuples of (administrationId, userId) for all users who are assigned to the
   * given administrations via org/class/group membership. This respects the org hierarchy:
   * - Administration assigned to a district → includes users from all schools and classes in that district
   * - Administration assigned to a school → includes users from all classes in that school
   *
   * Note: This returns a UNION ALL query (may have duplicates). Use COUNT(DISTINCT userId)
   * when aggregating to get accurate counts.
   *
   * Paths covered:
   * - Path 1: Direct org membership
   * - Path 2: Users in schools, admin assigned to parent district
   * - Path 3: Users in classes, admin assigned to district
   * - Path 4: Users in classes, admin assigned to school
   * - Path 5: Direct class membership
   * - Path 6: Direct group membership
   *
   * @param administrationIds - Array of administration IDs to get assignments for
   * @returns A subquery with (administrationId, userId) tuples
   */
  buildAdministrationUserAssignmentsQuery(administrationIds: string[]) {
    // Path 1: Direct org membership
    const viaDirectOrg = this.db
      .select({
        administrationId: administrationOrgs.administrationId,
        userId: userOrgs.userId,
      })
      .from(administrationOrgs)
      .innerJoin(userOrgs, eq(userOrgs.orgId, administrationOrgs.orgId))
      .where(inArray(administrationOrgs.administrationId, administrationIds));

    // Path 2: Users in schools, admin assigned to parent district
    const viaSchoolUnderDistrict = this.db
      .select({
        administrationId: administrationOrgs.administrationId,
        userId: userOrgs.userId,
      })
      .from(administrationOrgs)
      .innerJoin(orgs, eq(orgs.parentOrgId, administrationOrgs.orgId))
      .innerJoin(userOrgs, eq(userOrgs.orgId, orgs.id))
      .where(inArray(administrationOrgs.administrationId, administrationIds));

    // Path 3: Users in classes, admin assigned to district
    const viaClassUnderDistrict = this.db
      .select({
        administrationId: administrationOrgs.administrationId,
        userId: userClasses.userId,
      })
      .from(administrationOrgs)
      .innerJoin(classes, eq(classes.districtId, administrationOrgs.orgId))
      .innerJoin(userClasses, eq(userClasses.classId, classes.id))
      .where(inArray(administrationOrgs.administrationId, administrationIds));

    // Path 4: Users in classes, admin assigned to school
    const viaClassUnderSchool = this.db
      .select({
        administrationId: administrationOrgs.administrationId,
        userId: userClasses.userId,
      })
      .from(administrationOrgs)
      .innerJoin(classes, eq(classes.schoolId, administrationOrgs.orgId))
      .innerJoin(userClasses, eq(userClasses.classId, classes.id))
      .where(inArray(administrationOrgs.administrationId, administrationIds));

    // Path 5: Direct class membership
    const viaDirectClass = this.db
      .select({
        administrationId: administrationClasses.administrationId,
        userId: userClasses.userId,
      })
      .from(administrationClasses)
      .innerJoin(userClasses, eq(userClasses.classId, administrationClasses.classId))
      .where(inArray(administrationClasses.administrationId, administrationIds));

    // Path 6: Direct group membership
    const viaDirectGroup = this.db
      .select({
        administrationId: administrationGroups.administrationId,
        userId: userGroups.userId,
      })
      .from(administrationGroups)
      .innerJoin(userGroups, eq(userGroups.groupId, administrationGroups.groupId))
      .where(inArray(administrationGroups.administrationId, administrationIds));

    // Combine with UNION ALL (caller should use COUNT DISTINCT for accurate counts)
    return viaDirectOrg
      .unionAll(viaSchoolUnderDistrict)
      .unionAll(viaClassUnderDistrict)
      .unionAll(viaClassUnderSchool)
      .unionAll(viaDirectClass)
      .unionAll(viaDirectGroup);
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
   * @returns Map of administration ID to assigned user count
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
