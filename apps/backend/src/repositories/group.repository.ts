import { eq, and, isNull, asc, count, desc } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { SortOrder } from '@roar-dashboard/api-contract';
import type { UserRole, EnrolledUsersSortFieldType } from '@roar-dashboard/api-contract';
import { BaseRepository, type PaginatedResult } from './base.repository';
import { isEnrollmentActive } from './utils/enrollment.utils';
import {
  getEnrolledUsersFilterConditions,
  ENROLLED_USERS_SORT_COLUMNS,
  UserJunctionTable,
} from './utils/enrolled-users-query.utils';
import { isAuthorizedMembership } from './utils/is-authorized-membership.utils';
import type { AccessControlFilter } from './utils/parse-access-control-filter.utils';
import { CoreDbClient } from '../db/clients';
import { groups, userGroups, users, type Group } from '../db/schema';
import type * as CoreDbSchema from '../db/schema/core';
import type { ListEnrolledUsersOptions, EnrolledUserEntity } from '../types/user';
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

  /**
   * Get the role a user holds for a specific group.
   *
   * User can only hold one role per group.
   *
   * @param userId - The user ID to query roles for
   * @param groupId - The group ID to check access for
   * @returns Array of distinct roles the user has for group.
   */
  async getUserRolesForGroup(userId: string, groupId: string): Promise<UserRole[]> {
    const result = await this.db
      .select({ role: userGroups.role })
      .from(userGroups)
      .where(and(eq(userGroups.groupId, groupId), eq(userGroups.userId, userId)))
      .limit(1);

    return result[0]?.role ? [result[0]?.role] : [];
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
      ...getEnrolledUsersFilterConditions(options, UserJunctionTable.USER_GROUPS),
    );

    const countResult = await this.db
      .select({ count: count() })
      .from(userGroups)
      .innerJoin(users, eq(users.id, userGroups.userId))
      .where(whereCondition);

    const totalItems = countResult[0]?.count ?? 0;

    if (totalItems === 0) {
      return { items: [], totalItems: 0 };
    }

    const sortField = orderBy?.field as EnrolledUsersSortFieldType | undefined;
    const sortColumn = sortField ? ENROLLED_USERS_SORT_COLUMNS[sortField] : users.nameLast;
    const primaryOrder = orderBy?.direction === SortOrder.DESC ? desc(sortColumn) : asc(sortColumn);

    const dataResult = await this.db
      .select({ user: users, enrollmentStart: userGroups.enrollmentStart, role: userGroups.role })
      .from(userGroups)
      .innerJoin(users, eq(users.id, userGroups.userId))
      .where(whereCondition)
      .orderBy(primaryOrder, asc(users.id))
      .limit(perPage)
      .offset(offset);

    return {
      items: dataResult.map((row) => ({ ...row.user, enrollmentStart: row.enrollmentStart, role: row.role })),
      totalItems,
    };
  }

  /**
   * Get users enrolled in a group if group is accessible.
   *
   * Returns all users who have an active enrollment in the specified group.
   * Only includes users with active enrollments (enrollment_start <= now and
   * enrollment_end is null or >= now).
   *
   * @param accessControlFilter - User ID and allowed roles
   * @param groupId - The group ID to get users for
   * @param options - Pagination and sorting options
   * @returns Paginated result with users
   */
  async getAuthorizedUsersByGroupId(
    accessControlFilter: AccessControlFilter,
    groupId: string,
    options: ListEnrolledUsersOptions,
  ): Promise<PaginatedResult<EnrolledUserEntity>> {
    const { page, perPage, orderBy } = options;
    const offset = (page - 1) * perPage;
    const { userId, allowedRoles } = accessControlFilter;

    // This checks if user has permission to list users for that group.
    const accessibleGroups = this.db
      .select({ groupId: userGroups.groupId })
      .from(userGroups)
      .where(and(eq(userGroups.groupId, groupId), isAuthorizedMembership(userGroups, userId, allowedRoles)))
      .as('accessible_groups');

    const whereCondition = and(
      eq(userGroups.groupId, groupId),
      isEnrollmentActive(userGroups),
      ...getEnrolledUsersFilterConditions(options, UserJunctionTable.USER_GROUPS),
    );

    const countResult = await this.db
      .select({ count: count() })
      .from(userGroups)
      .innerJoin(users, eq(users.id, userGroups.userId))
      .innerJoin(accessibleGroups, eq(accessibleGroups.groupId, userGroups.groupId))
      .where(whereCondition);

    const totalItems = countResult[0]?.count ?? 0;

    if (totalItems === 0) {
      return { items: [], totalItems: 0 };
    }

    const sortField = orderBy?.field as EnrolledUsersSortFieldType | undefined;
    const sortColumn = sortField ? ENROLLED_USERS_SORT_COLUMNS[sortField] : users.nameLast;
    const primaryOrder = orderBy?.direction === SortOrder.DESC ? desc(sortColumn) : asc(sortColumn);

    const dataResult = await this.db
      .select({ user: users, enrollmentStart: userGroups.enrollmentStart, role: userGroups.role })
      .from(userGroups)
      .innerJoin(users, eq(users.id, userGroups.userId))
      .innerJoin(accessibleGroups, eq(accessibleGroups.groupId, userGroups.groupId))
      .where(whereCondition)
      .orderBy(primaryOrder, asc(users.id))
      .limit(perPage)
      .offset(offset);

    return {
      items: dataResult.map((row) => ({ ...row.user, enrollmentStart: row.enrollmentStart, role: row.role })),
      totalItems,
    };
  }
}
