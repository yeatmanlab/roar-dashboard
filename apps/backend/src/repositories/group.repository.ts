import { SortOrder } from '@roar-dashboard/api-contract';
import { and, asc, count, desc, eq, isNull } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { CoreDbClient } from '../db/clients';
import type { Group } from '../db/schema';
import { groups, userGroups, users } from '../db/schema';
import type * as CoreDbSchema from '../db/schema/core';
import type { EnrolledUserEntity, EnrolledUsersSortFieldType, ListEnrolledUsersOptions } from '../types/user';
import type { PaginatedResult } from './base.repository';
import { BaseRepository } from './base.repository';
import {
  ENROLLED_USERS_SORT_COLUMNS,
  getEnrolledUsersFilterConditions,
  UserJunctionTable,
} from './utils/enrolled-users-query.utils';
import { isEnrollmentActive } from './utils/enrollment.utils';

export class GroupRepository extends BaseRepository<Group, typeof groups> {
  constructor(db: NodePgDatabase<typeof CoreDbSchema> = CoreDbClient) {
    super(db, groups);
  }

  /**
   * Get users enrolled in a group.
   *
   * Returns all users who have an active enrollment in the specified group.
   * Only includes users with active enrollments (enrollment_start <= now and
   * enrollment_end is null or >= now).
   *
   * @param groupId - The group ID to get users for
   * @param options - Pagination, sorting, and filtering options
   * @returns Paginated result with users
   */
  async getUsersByGroupId(
    groupId: string,
    options: ListEnrolledUsersOptions,
  ): Promise<PaginatedResult<EnrolledUserEntity>> {
    const { page, perPage, orderBy } = options;
    const offset = (page - 1) * perPage;

    const whereCondition = and(
      eq(userGroups.groupId, groupId),
      isEnrollmentActive(userGroups),
      isNull(groups.rosteringEnded),
      ...getEnrolledUsersFilterConditions(options, UserJunctionTable.USER_GROUPS),
    );

    const countResult = await this.db
      .select({ count: count() })
      .from(userGroups)
      .innerJoin(users, eq(users.id, userGroups.userId))
      .innerJoin(groups, eq(groups.id, userGroups.groupId))
      .where(whereCondition);

    const totalItems = countResult[0]?.count ?? 0;

    if (totalItems === 0) {
      return { items: [], totalItems: 0 };
    }

    const sortField = orderBy?.field as EnrolledUsersSortFieldType | undefined;
    const sortColumn = sortField ? ENROLLED_USERS_SORT_COLUMNS[sortField] : users.nameLast;
    const primaryOrder = orderBy?.direction === SortOrder.DESC ? desc(sortColumn) : asc(sortColumn);

    const dataResult = await this.db
      .select({ user: users, role: userGroups.role })
      .from(userGroups)
      .innerJoin(users, eq(users.id, userGroups.userId))
      .innerJoin(groups, eq(groups.id, userGroups.groupId))
      .where(whereCondition)
      .orderBy(primaryOrder, asc(users.id))
      .limit(perPage)
      .offset(offset);

    return {
      items: dataResult.map((row) => ({ ...row.user, roles: [row.role] })),
      totalItems,
    };
  }
}
