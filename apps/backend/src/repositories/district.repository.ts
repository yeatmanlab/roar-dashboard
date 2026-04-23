import type { DistrictSortFieldType } from '@roar-dashboard/api-contract';
import { SortOrder } from '@roar-dashboard/api-contract';
import type { SQL } from 'drizzle-orm';
import { and, asc, countDistinct, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { CoreDbClient } from '../db/clients';
import type { Org } from '../db/schema';
import { classes, orgs, userClasses, userOrgs, users } from '../db/schema';
import type * as CoreDbSchema from '../db/schema/core';
import { OrgType } from '../enums/org-type.enum';
import type { UserRole } from '../enums/user-role.enum';
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
 * District-specific type (Org with orgType = 'district')
 */
export type District = Org;

/**
 * Aggregated counts for a district
 */
export interface DistrictCounts {
  users: number;
  schools: number;
  classes: number;
}

/**
 * District with optional counts embed
 */
export interface DistrictWithCounts extends District {
  counts?: DistrictCounts;
}

/**
 * Options for listing districts
 */
export interface ListDistrictOptions {
  page: number;
  perPage: number;
  orderBy?: {
    field: DistrictSortFieldType;
    direction: 'asc' | 'desc';
  };
  includeEnded?: boolean;
  embedCounts?: boolean;
}

/**
 * District Repository
 *
 * Handles data access for districts (orgs with orgType = 'district').
 */
export class DistrictRepository extends BaseRepository<District, typeof orgs> {
  constructor(db: NodePgDatabase<typeof CoreDbSchema> = CoreDbClient) {
    super(db, orgs);
  }

  /**
   * Build the shared where clause for district queries.
   *
   * All district listing methods filter by orgType = DISTRICT and optionally
   * exclude ended organizations. This helper eliminates duplication across
   * listAll and listByIds.
   *
   * @param includeEnded - Whether to include organizations with rosteringEnded set
   * @returns A SQL condition or undefined
   */
  private buildDistrictWhereClause(includeEnded: boolean): SQL | undefined {
    if (includeEnded) {
      return eq(orgs.orgType, OrgType.DISTRICT);
    }

    return and(eq(orgs.orgType, OrgType.DISTRICT), isNull(orgs.rosteringEnded));
  }

  /**
   * List all districts with optional filtering.
   *
   * This method does not apply authorization filtering and should only be used
   * for super admin access where all districts are visible.
   *
   * @param options - Pagination, sorting, and optional filters
   * @returns Paginated result with districts
   */
  async listAll(options: ListDistrictOptions): Promise<PaginatedResult<District | DistrictWithCounts>> {
    const { page, perPage, orderBy, includeEnded = false, embedCounts = false } = options;

    const where = this.buildDistrictWhereClause(includeEnded);

    // Delegate to getAll() — tiebreaker asc(id) is handled by getAll() itself
    const result = await this.getAll({
      page,
      perPage,
      ...(orderBy && { orderBy }),
      ...(where && { where }),
    });

    // Fetch and attach counts if requested
    if (embedCounts && result.items.length > 0) {
      const districtIds = result.items.map((d) => d.id);
      const countsMap = await this.fetchDistrictCounts(districtIds, includeEnded);

      const districtsWithCounts = result.items.map((district) => ({
        ...district,
        counts: countsMap.get(district.id) ?? { users: 0, schools: 0, classes: 0 },
      })) as DistrictWithCounts[];

      return {
        items: districtsWithCounts,
        totalItems: result.totalItems,
      };
    }

    return result;
  }

  /**
   * List districts by a pre-determined set of IDs with pagination, sorting, and optional counts.
   *
   * Used after FGA resolves the set of accessible district IDs — this method
   * fetches the actual records with pagination and optional embed counts.
   *
   * @param ids - Array of district IDs to fetch (from FGA listAccessibleObjects)
   * @param options - Pagination, sorting, and optional filters
   * @returns Paginated result with districts
   */
  async listByIds(
    ids: string[],
    options: ListDistrictOptions,
  ): Promise<PaginatedResult<District | DistrictWithCounts>> {
    const { includeEnded = false, embedCounts = false } = options;

    const where = this.buildDistrictWhereClause(includeEnded);

    const result = await this.getByIds(ids, {
      page: options.page,
      perPage: options.perPage,
      ...(options.orderBy && { orderBy: options.orderBy }),
      ...(where && { where }),
    });

    // Fetch and attach counts if requested
    if (embedCounts && result.items.length > 0) {
      const districtIds = result.items.map((d) => d.id);
      const countsMap = await this.fetchDistrictCounts(districtIds, includeEnded);

      const districtsWithCounts = result.items.map((district) => ({
        ...district,
        counts: countsMap.get(district.id) ?? { users: 0, schools: 0, classes: 0 },
      })) as DistrictWithCounts[];

      return {
        items: districtsWithCounts,
        totalItems: result.totalItems,
      };
    }

    return result;
  }

  /**
   * Fetch aggregated counts for multiple districts.
   *
   * Computes:
   * - users: COUNT of active users in district (from userOrgs where enrollmentEnd IS NULL)
   * - schools: COUNT of schools where parentOrgId = district.id and rosteringEnded IS NULL
   * - classes: COUNT of classes in district schools (via classes joined through schools)
   *
   * Uses pre-aggregated subqueries with left joins for better performance at scale
   * instead of correlated subqueries (O(n) vs O(n*m)).
   *
   * @param districtIds - Array of district IDs to fetch counts for
   * @param includeEnded - Whether to include ended organizations in school counts
   * @returns Map of district ID to counts
   */
  private async fetchDistrictCounts(
    districtIds: string[],
    includeEnded: boolean,
  ): Promise<Map<string, DistrictCounts>> {
    // Pre-aggregate user counts per district
    const userCounts = this.db
      .select({
        districtId: userOrgs.orgId,
        users: countDistinct(userOrgs.userId).as('users'),
      })
      .from(userOrgs)
      .where(and(inArray(userOrgs.orgId, districtIds), isNull(userOrgs.enrollmentEnd)))
      .groupBy(userOrgs.orgId)
      .as('user_counts');

    // Pre-aggregate school counts per district
    const schoolCountsWhere = includeEnded
      ? and(inArray(orgs.parentOrgId, districtIds), eq(orgs.orgType, OrgType.SCHOOL))
      : and(inArray(orgs.parentOrgId, districtIds), eq(orgs.orgType, OrgType.SCHOOL), isNull(orgs.rosteringEnded));

    const schoolCounts = this.db
      .select({
        districtId: orgs.parentOrgId,
        schools: countDistinct(orgs.id).as('schools'),
      })
      .from(orgs)
      .where(schoolCountsWhere)
      .groupBy(orgs.parentOrgId)
      .as('school_counts');

    // Pre-aggregate class counts per district (only active classes)
    const classCounts = this.db
      .select({
        districtId: classes.districtId,
        classes: countDistinct(classes.id).as('classes'),
      })
      .from(classes)
      .where(and(inArray(classes.districtId, districtIds), isNull(classes.rosteringEnded)))
      .groupBy(classes.districtId)
      .as('class_counts');

    // Query to get counts for all districts using left joins to the aggregates
    const results = await this.db
      .select({
        districtId: orgs.id,
        users: sql<number>`COALESCE(${userCounts.users}, 0)`.as('users'),
        schools: sql<number>`COALESCE(${schoolCounts.schools}, 0)`.as('schools'),
        classes: sql<number>`COALESCE(${classCounts.classes}, 0)`.as('classes'),
      })
      .from(orgs)
      .leftJoin(userCounts, eq(orgs.id, userCounts.districtId))
      .leftJoin(schoolCounts, eq(orgs.id, schoolCounts.districtId))
      .leftJoin(classCounts, eq(orgs.id, classCounts.districtId))
      .where(and(eq(orgs.orgType, OrgType.DISTRICT), inArray(orgs.id, districtIds)));

    // Convert to Map for efficient lookup
    const countsMap = new Map<string, DistrictCounts>();
    for (const row of results) {
      countsMap.set(row.districtId, {
        users: Number(row.users) || 0,
        schools: Number(row.schools) || 0,
        classes: Number(row.classes) || 0,
      });
    }

    return countsMap;
  }

  /**
   * Get a district by ID without authorization checks.
   * Used for super admins who have unrestricted access.
   *
   * @param districtId - UUID of the district to retrieve
   * @returns The district if found, null otherwise
   */
  async getUnrestrictedById(districtId: string): Promise<District | null> {
    const result = await this.db
      .select()
      .from(orgs)
      .where(and(eq(orgs.id, districtId), eq(orgs.orgType, OrgType.DISTRICT)))
      .limit(1);

    return result[0] ?? null;
  }

  /**
   * Get users enrolled in a district.
   *
   * Returns all users who have an active enrollment in the specified district.
   * Only includes users with active enrollments (enrollment_start <= now and
   * enrollment_end is null or >= now).
   *
   * @param districtPath - District path for ltree filtering
   * @param options - Options for filtering and pagination
   * @returns Paginated result of users enrolled in the district
   */
  async getUsersByDistrictPath(
    districtPath: string,
    options: ListEnrolledUsersOptions,
  ): Promise<PaginatedResult<EnrolledUserEntity>> {
    const { page, perPage, orderBy } = options;
    const offset = (page - 1) * perPage;

    const orgConditions = and(
      isEnrollmentActive(userOrgs),
      isNull(orgs.rosteringEnded),
      sql`${districtPath} @> ${orgs.path}`,
      ...getEnrolledUsersFilterConditions(options, UserJunctionTable.USER_ORGS),
    );

    const orgUsersQuery = this.db
      .select({
        userId: users.id,
        role: userOrgs.role,
      })
      .from(userOrgs)
      .innerJoin(users, eq(users.id, userOrgs.userId))
      .innerJoin(orgs, eq(orgs.id, userOrgs.orgId))
      .where(orgConditions);

    const classConditions = and(
      isEnrollmentActive(userClasses),
      isNull(classes.rosteringEnded),
      sql`${districtPath} @> ${classes.orgPath}`,
      ...getEnrolledUsersFilterConditions(options, UserJunctionTable.USER_CLASSES),
    );

    const classUsersQuery = this.db
      .select({
        userId: users.id,
        role: userClasses.role,
      })
      .from(userClasses)
      .innerJoin(users, eq(userClasses.userId, users.id))
      .innerJoin(classes, eq(userClasses.classId, classes.id))
      .where(classConditions);

    const combinedUsersQuery = orgUsersQuery.union(classUsersQuery).as('combined_users');
    const countResult = await this.db
      .select({ count: countDistinct(combinedUsersQuery.userId) })
      .from(combinedUsersQuery);

    const totalItems = countResult[0]?.count ?? 0;

    if (totalItems === 0) {
      return { items: [], totalItems: 0 };
    }

    const sortField = orderBy?.field as EnrolledUsersSortFieldType | undefined;
    const sortColumn = sortField ? ENROLLED_USERS_SORT_COLUMNS[sortField] : users.nameLast;
    const primaryOrder = orderBy?.direction === SortOrder.DESC ? desc(sortColumn) : asc(sortColumn);

    const dataResult = await this.db
      .select({
        user: users,
        roles: sql<UserRole[]>`json_agg(${combinedUsersQuery.role})`,
      })
      .from(users)
      .innerJoin(combinedUsersQuery, eq(users.id, combinedUsersQuery.userId))
      .groupBy(users.id)
      .orderBy(primaryOrder, asc(users.id))
      .limit(perPage)
      .offset(offset);

    return {
      items: dataResult.map((row) => ({
        ...row.user,
        roles: row.roles,
      })),
      totalItems,
    };
  }
}
