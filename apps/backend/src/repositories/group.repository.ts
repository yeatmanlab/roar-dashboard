import { SortOrder } from '@roar-dashboard/api-contract';
import type { GroupType } from '@roar-dashboard/api-contract';
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

/**
 * Input for creating a group at the repository layer.
 *
 * Groups are flat (no parent, no ltree path), so the repository sets only the
 * caller-supplied fields. There are no server-managed columns to derive.
 */
export interface CreateGroupInput {
  name: string;
  abbreviation: string;
  groupType: GroupType;
  locationAddressLine1?: string | undefined;
  locationAddressLine2?: string | undefined;
  locationCity?: string | undefined;
  locationStateProvince?: string | undefined;
  locationPostalCode?: string | undefined;
  locationCountry?: string | undefined;
}

export class GroupRepository extends BaseRepository<Group, typeof groups> {
  constructor(db: NodePgDatabase<typeof CoreDbSchema> = CoreDbClient) {
    super(db, groups);
  }

  /**
   * Create a new group.
   *
   * Groups are flat — no parent verification, no path computation. The
   * repository forwards the supplied fields to a `BaseRepository.create()`
   * insert and returns the new id.
   *
   * @param input - Group fields the caller is allowed to set
   * @returns The new group id
   */
  async createGroup(input: CreateGroupInput): Promise<{ id: string }> {
    return this.create({
      data: {
        name: input.name,
        abbreviation: input.abbreviation,
        groupType: input.groupType,
        ...(input.locationAddressLine1 !== undefined && { locationAddressLine1: input.locationAddressLine1 }),
        ...(input.locationAddressLine2 !== undefined && { locationAddressLine2: input.locationAddressLine2 }),
        ...(input.locationCity !== undefined && { locationCity: input.locationCity }),
        ...(input.locationStateProvince !== undefined && { locationStateProvince: input.locationStateProvince }),
        ...(input.locationPostalCode !== undefined && { locationPostalCode: input.locationPostalCode }),
        ...(input.locationCountry !== undefined && { locationCountry: input.locationCountry }),
      },
    });
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
