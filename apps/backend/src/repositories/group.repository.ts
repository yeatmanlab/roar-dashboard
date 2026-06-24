import { SortOrder } from '@roar-platform/api-contract';
import type { GroupSortFieldType, GroupType } from '@roar-platform/api-contract';
import { and, asc, count, desc, eq, isNull } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
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

// Re-export the Group entity type so service/controller layers can import it
// from the repository alongside the repository's own option/input types,
// mirroring the District repository convention.
export type { Group } from '../db/schema';

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

/**
 * Column-shaped partial for updating a group at the repository layer.
 *
 * Only the mutable, caller-settable columns appear here. The immutable `id` is
 * never passed in. Groups are flat, so there are no hierarchy columns to guard.
 */
export interface UpdateGroupInput {
  name?: string;
  abbreviation?: string;
  groupType?: GroupType;
  locationAddressLine1?: string;
  locationAddressLine2?: string;
  locationCity?: string;
  locationStateProvince?: string;
  locationPostalCode?: string;
  locationCountry?: string;
}

/**
 * Options for listing groups.
 */
export interface ListGroupOptions {
  page: number;
  perPage: number;
  orderBy?: {
    field: GroupSortFieldType;
    direction: 'asc' | 'desc';
  };
  includeEnded?: boolean;
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
   * Update a group's mutable columns.
   *
   * Thin wrapper over `BaseRepository.update` that scopes the typed partial to
   * the group's mutable columns. The immutable `id` is never passed in
   * (enforced by the `UpdateGroupInput` shape). The service is responsible for
   * existence and authorization checks before calling this.
   *
   * @param groupId - UUID of the group to update
   * @param updates - Column-shaped partial of mutable fields
   */
  async updateGroup(groupId: string, updates: UpdateGroupInput): Promise<void> {
    await this.update({ id: groupId, data: updates });
  }

  /**
   * Build the shared where clause for group listing queries.
   *
   * Groups are a dedicated table, so unlike orgs there is no orgType filter —
   * the only optional filter excludes rostering-ended groups. This helper
   * eliminates duplication across listAll and listByIds.
   *
   * @param includeEnded - Whether to include groups with rosteringEnded set
   * @returns A SQL condition, or undefined when no filter applies
   */
  private buildGroupWhereClause(includeEnded: boolean): SQL | undefined {
    if (includeEnded) {
      return undefined;
    }

    return isNull(groups.rosteringEnded);
  }

  /**
   * List all groups with optional filtering.
   *
   * This method does not apply authorization filtering and should only be used
   * for super admin access where all groups are visible.
   *
   * @param options - Pagination, sorting, and optional filters
   * @returns Paginated result with groups
   */
  async listAll(options: ListGroupOptions): Promise<PaginatedResult<Group>> {
    const { page, perPage, orderBy, includeEnded = false } = options;

    const where = this.buildGroupWhereClause(includeEnded);

    // Delegate to getAll() — tiebreaker asc(id) is handled by getAll() itself
    return this.getAll({
      page,
      perPage,
      ...(orderBy && { orderBy }),
      ...(where && { where }),
    });
  }

  /**
   * List groups by a pre-determined set of IDs with pagination and sorting.
   *
   * Used after FGA resolves the set of accessible group IDs — this method
   * fetches the actual records with pagination.
   *
   * @param ids - Array of group IDs to fetch (from FGA listAccessibleObjects)
   * @param options - Pagination, sorting, and optional filters
   * @returns Paginated result with groups
   */
  async listByIds(ids: string[], options: ListGroupOptions): Promise<PaginatedResult<Group>> {
    const { includeEnded = false } = options;

    const where = this.buildGroupWhereClause(includeEnded);

    return this.getByIds(ids, {
      page: options.page,
      perPage: options.perPage,
      ...(options.orderBy && { orderBy: options.orderBy }),
      ...(where && { where }),
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
