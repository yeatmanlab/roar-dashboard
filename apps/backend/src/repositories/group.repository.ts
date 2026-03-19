import { eq, and, isNull } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { BaseRepository } from './base.repository';
import type { AccessControlFilter } from './utils/parse-access-control-filter.utils';
import { CoreDbClient } from '../db/clients';
import type * as CoreDbSchema from '../db/schema/core';
import { groups, userGroups, type Group } from '../db/schema';
import { isAuthorizedMembership } from './utils/is-authorized-membership.utils';

export class GroupRepository extends BaseRepository<Group, typeof groups> {
  constructor(db: NodePgDatabase<typeof CoreDbSchema> = CoreDbClient) {
    super(db, groups);
  }

  /**
   * Get a single group by ID, only if the user is authorized to access it and rosteringEnded is null.
   *
   * @param accessControlFilter - User ID and allowed roles
   * @param groupId - The group ID to retrieve
   * @returns The group if found and accessible, null otherwise
   */
  async getAuthorizedById(accessControlFilter: AccessControlFilter, groupId: string): Promise<Group | null> {
    const { userId, allowedRoles } = accessControlFilter;

    const result = await this.db
      .select({ groups })
      .from(groups)
      .innerJoin(userGroups, eq(groups.id, userGroups.groupId))
      .where(
        and(
          eq(groups.id, groupId),
          isNull(groups.rosteringEnded),
          isAuthorizedMembership(userGroups, userId, allowedRoles),
        ),
      )
      .limit(1);

    return result[0]?.groups ?? null;
  }
}
