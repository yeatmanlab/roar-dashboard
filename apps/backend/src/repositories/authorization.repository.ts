import { eq, inArray, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { CoreDbClient } from '../db/clients';
import type * as CoreDbSchema from '../db/schema/core';
import {
  userOrgs,
  userClasses,
  userGroups,
  administrationOrgs,
  administrationClasses,
  administrationGroups,
  orgs,
  classes,
} from '../db/schema';

/**
 * Authorization Repository
 *
 * Provides methods for determining resource access based on user membership.
 * Handles the relationship between users and resources via orgs/classes/groups.
 */
export class AuthorizationRepository {
  constructor(private readonly db: NodePgDatabase<typeof CoreDbSchema> = CoreDbClient) {}

  /**
   * Get IDs of administrations the user can access.
   *
   * A user can access an administration if they belong to an org, class, or group
   * that is assigned to that administration. This respects the org hierarchy:
   * - Administration assigned to a district → applies to all schools and classes in that district
   * - Administration assigned to a school → applies to all classes in that school
   */
  async getAccessibleAdministrationIds(userId: string): Promise<string[]> {
    // Path 1: Direct org membership (user in district/school directly assigned)
    const viaDirectOrg = this.db
      .select({ administrationId: administrationOrgs.administrationId })
      .from(administrationOrgs)
      .innerJoin(userOrgs, eq(userOrgs.orgId, administrationOrgs.orgId))
      .where(eq(userOrgs.userId, userId));

    // Path 2: User in school, admin assigned to parent district
    const viaSchoolUnderDistrict = this.db
      .select({ administrationId: administrationOrgs.administrationId })
      .from(administrationOrgs)
      .innerJoin(orgs, eq(orgs.parentOrgId, administrationOrgs.orgId))
      .innerJoin(userOrgs, eq(userOrgs.orgId, orgs.id))
      .where(eq(userOrgs.userId, userId));

    // Path 3: User in class, admin assigned to district
    const viaClassUnderDistrict = this.db
      .select({ administrationId: administrationOrgs.administrationId })
      .from(administrationOrgs)
      .innerJoin(classes, eq(classes.districtId, administrationOrgs.orgId))
      .innerJoin(userClasses, eq(userClasses.classId, classes.id))
      .where(eq(userClasses.userId, userId));

    // Path 4: User in class, admin assigned to school
    const viaClassUnderSchool = this.db
      .select({ administrationId: administrationOrgs.administrationId })
      .from(administrationOrgs)
      .innerJoin(classes, eq(classes.schoolId, administrationOrgs.orgId))
      .innerJoin(userClasses, eq(userClasses.classId, classes.id))
      .where(eq(userClasses.userId, userId));

    // Path 5: Direct class membership
    const viaDirectClass = this.db
      .select({ administrationId: administrationClasses.administrationId })
      .from(administrationClasses)
      .innerJoin(userClasses, eq(userClasses.classId, administrationClasses.classId))
      .where(eq(userClasses.userId, userId));

    // Path 6: Direct group membership
    const viaDirectGroup = this.db
      .select({ administrationId: administrationGroups.administrationId })
      .from(administrationGroups)
      .innerJoin(userGroups, eq(userGroups.groupId, administrationGroups.groupId))
      .where(eq(userGroups.userId, userId));

    // Combine with UNION to automatically deduplicate
    const accessibleAdmins = viaDirectOrg
      .union(viaSchoolUnderDistrict)
      .union(viaClassUnderDistrict)
      .union(viaClassUnderSchool)
      .union(viaDirectClass)
      .union(viaDirectGroup)
      .as('accessible');

    const result = await this.db.select({ administrationId: accessibleAdmins.administrationId }).from(accessibleAdmins);

    return result.map((row) => row.administrationId);
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

    // Combine with UNION ALL (we'll deduplicate with COUNT DISTINCT)
    const combinedQuery = viaDirectOrg
      .unionAll(viaSchoolUnderDistrict)
      .unionAll(viaClassUnderDistrict)
      .unionAll(viaClassUnderSchool)
      .unionAll(viaDirectClass)
      .unionAll(viaDirectGroup);

    // Wrap in subquery and aggregate with GROUP BY
    const assignments = combinedQuery.as('assignments');

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
