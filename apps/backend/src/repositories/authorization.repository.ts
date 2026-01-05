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
}
