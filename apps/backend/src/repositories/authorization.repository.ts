import { sql } from 'drizzle-orm';
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
} from '../db/schema';
import { toPostgresUuidArray } from '../utils/to-postgres-uuid-array.util';

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
   * that is assigned to that administration.
   */
  async getAccessibleAdministrationIds(userId: string): Promise<string[]> {
    // Get administration IDs via org membership
    const viaOrgs = this.db
      .select({ administrationId: administrationOrgs.administrationId })
      .from(administrationOrgs)
      .innerJoin(userOrgs, sql`${userOrgs.orgId} = ${administrationOrgs.orgId}`)
      .where(sql`${userOrgs.userId} = ${userId}`);

    // Get administration IDs via class membership
    const viaClasses = this.db
      .select({ administrationId: administrationClasses.administrationId })
      .from(administrationClasses)
      .innerJoin(userClasses, sql`${userClasses.classId} = ${administrationClasses.classId}`)
      .where(sql`${userClasses.userId} = ${userId}`);

    // Get administration IDs via group membership
    const viaGroups = this.db
      .select({ administrationId: administrationGroups.administrationId })
      .from(administrationGroups)
      .innerJoin(userGroups, sql`${userGroups.groupId} = ${administrationGroups.groupId}`)
      .where(sql`${userGroups.userId} = ${userId}`);

    // Combine with UNION ALL and deduplicate with DISTINCT
    const result = await this.db
      .selectDistinct({ administrationId: sql<string>`administration_id` })
      .from(sql`(${viaOrgs} UNION ALL ${viaClasses} UNION ALL ${viaGroups}) AS accessible`);

    return result.map((row) => row.administrationId);
  }

  /**
   * Get count of assigned users for multiple administrations.
   *
   * A user is "assigned" to an administration if they belong to an org, class, or group
   * that is linked to that administration.
   *
   * @param administrationIds - Array of administration IDs to count assigned users for
   * @returns Map of administration ID to assigned user count
   */
  async getAssignedUserCountsByAdministrationIds(administrationIds: string[]): Promise<Map<string, number>> {
    if (administrationIds.length === 0) {
      return new Map();
    }

    // Convert to PostgreSQL array literal with UUID validation
    const pgArrayLiteral = toPostgresUuidArray(administrationIds);

    // Count distinct users per administration across all membership types
    // Using UNION ALL + GROUP BY to count unique users assigned via org, class, or group
    const result = await this.db.execute<{ administration_id: string; assigned_count: number }>(sql`
      SELECT administration_id, COUNT(DISTINCT user_id)::int AS assigned_count
      FROM (
        SELECT ao.administration_id, uo.user_id
        FROM app.administration_orgs ao
        INNER JOIN app.user_orgs uo ON uo.org_id = ao.org_id
        WHERE ao.administration_id = ANY(${pgArrayLiteral}::uuid[])

        UNION ALL

        SELECT ac.administration_id, uc.user_id
        FROM app.administration_classes ac
        INNER JOIN app.user_classes uc ON uc.class_id = ac.class_id
        WHERE ac.administration_id = ANY(${pgArrayLiteral}::uuid[])

        UNION ALL

        SELECT ag.administration_id, ug.user_id
        FROM app.administration_groups ag
        INNER JOIN app.user_groups ug ON ug.group_id = ag.group_id
        WHERE ag.administration_id = ANY(${pgArrayLiteral}::uuid[])
      ) AS assignments
      GROUP BY administration_id
    `);

    const countsMap = new Map<string, number>();
    for (const row of result.rows) {
      countsMap.set(row.administration_id, row.assigned_count);
    }

    return countsMap;
  }
}
