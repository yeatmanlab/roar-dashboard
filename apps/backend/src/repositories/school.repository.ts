import { eq, countDistinct, and, isNull, sql, inArray, asc, desc } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { PaginatedResult } from './base.repository';
import { BaseRepository } from './base.repository';
import type { Org } from '../db/schema';
import { orgs, userOrgs, classes, userClasses, users } from '../db/schema';
import { CoreDbClient } from '../db/clients';
import type * as CoreDbSchema from '../db/schema/core';
import type { SchoolSortFieldType } from '@roar-dashboard/api-contract';
import { SortOrder } from '@roar-dashboard/api-contract';
import { OrgType } from '../enums/org-type.enum';
import type { UserRole } from '../enums/user-role.enum';
import type { EnrolledUserEntity, ListEnrolledUsersOptions } from '../types/user';
import {
  getEnrolledUsersFilterConditions,
  ENROLLED_USERS_SORT_COLUMNS,
  UserJunctionTable,
} from './utils/enrolled-users-query.utils';
import { isEnrollmentActive } from './utils/enrollment.utils';

/**
 * School-specific type (Org with orgType = 'school')
 */
export type School = Org;

/**
 * Aggregated counts for a school
 */
export interface SchoolCounts {
  users: number;
  classes: number;
}

/**
 * School with optional counts embed
 */
export interface SchoolWithCounts extends School {
  counts?: SchoolCounts;
}

/**
 * Input for creating a school at the repository layer.
 *
 * Server-managed columns (`orgType`, `path`, `isRosteringRootOrg`) are NOT
 * part of this interface — the repository sets them itself based on the
 * school invariants:
 * - `orgType` is fixed to 'school'
 * - `path` is computed by the `trg_orgs_compute_path_insert` BEFORE INSERT
 *   trigger, which appends the school label to the parent district's path
 * - `isRosteringRootOrg` is false (enforced by `validate_org_hierarchy_fn`:
 *   non-root orgs must have isRosteringRootOrg = false)
 */
export interface CreateSchoolInput {
  parentOrgId: string;
  name: string;
  abbreviation: string;
  locationAddressLine1?: string | undefined;
  locationAddressLine2?: string | undefined;
  locationCity?: string | undefined;
  locationStateProvince?: string | undefined;
  locationPostalCode?: string | undefined;
  locationCountry?: string | undefined;
  mdrNumber?: string | undefined;
  ncesId?: string | undefined;
  stateId?: string | undefined;
  schoolNumber?: string | undefined;
}

/**
 * Options for listing schools with authorization
 */
export interface ListAuthorizedOptions {
  page: number;
  perPage: number;
  orderBy?: {
    field: SchoolSortFieldType;
    direction: 'asc' | 'desc';
  };
  includeEnded?: boolean;
  embedCounts?: boolean;
}

/**
 * School Repository
 *
 * Handles data access for schools (orgs with orgType = 'school').
 * Provides both unrestricted access (for super admins) and FGA-filtered access
 * (for regular users based on their FGA object membership).
 */
export class SchoolRepository extends BaseRepository<School, typeof orgs> {
  constructor(db: NodePgDatabase<typeof CoreDbSchema> = CoreDbClient) {
    super(db, orgs);
  }

  /**
   * List all schools with optional filtering.
   *
   * This method does not apply authorization filtering and should only be used
   * for super admin access where all schools are visible.
   *
   * @param options - Pagination, sorting, and optional filters
   * @returns Paginated result with schools
   */
  async listAll(options: ListAuthorizedOptions): Promise<PaginatedResult<School | SchoolWithCounts>> {
    const { page, perPage, orderBy, includeEnded = false, embedCounts = false } = options;

    // Build where clause for school type and rostering status
    const whereConditions: SQL[] = [eq(orgs.orgType, OrgType.SCHOOL)];

    if (!includeEnded) {
      whereConditions.push(isNull(orgs.rosteringEnded));
    }

    const whereClause = whereConditions.length > 1 ? and(...whereConditions) : whereConditions[0];

    // Delegate to getAll() — tiebreaker asc(id) is handled by getAll() itself
    const result = await this.getAll({
      page,
      perPage,
      ...(orderBy && { orderBy }),
      ...(whereClause && { where: whereClause }),
    });

    // Fetch and attach counts if requested
    if (embedCounts && result.items.length > 0) {
      const schoolIds = result.items.map((s) => s.id);
      const countsMap = await this.fetchSchoolCounts(schoolIds, includeEnded);

      const schoolsWithCounts = result.items.map((school) => ({
        ...school,
        counts: countsMap.get(school.id) ?? { users: 0, classes: 0 },
      })) as SchoolWithCounts[];

      return {
        items: schoolsWithCounts,
        totalItems: result.totalItems,
      };
    }

    return result;
  }

  /**
   * Fetch aggregated counts for multiple schools.
   *
   * Computes:
   * - users: COUNT of active users in school (from userOrgs where enrollmentEnd IS NULL)
   * - classes: COUNT of classes in school (optionally filtered by rosteringEnded)
   *
   * Uses pre-aggregated subqueries with left joins for better performance at scale
   * instead of correlated subqueries (O(n) vs O(n*m)).
   *
   * @param schoolIds - Array of school IDs to fetch counts for
   * @param includeEnded - Whether to include ended classes in counts
   * @returns Map of school ID to counts
   */
  private async fetchSchoolCounts(schoolIds: string[], includeEnded: boolean): Promise<Map<string, SchoolCounts>> {
    // Pre-aggregate user counts per school
    const userCounts = this.db
      .select({
        schoolId: userOrgs.orgId,
        users: countDistinct(userOrgs.userId).as('users'),
      })
      .from(userOrgs)
      .where(and(inArray(userOrgs.orgId, schoolIds), isNull(userOrgs.enrollmentEnd)))
      .groupBy(userOrgs.orgId)
      .as('user_counts');

    // Pre-aggregate class counts per school
    const classCountsWhere = includeEnded
      ? inArray(classes.schoolId, schoolIds)
      : and(inArray(classes.schoolId, schoolIds), isNull(classes.rosteringEnded));

    const classCounts = this.db
      .select({
        schoolId: classes.schoolId,
        classes: countDistinct(classes.id).as('classes'),
      })
      .from(classes)
      .where(classCountsWhere)
      .groupBy(classes.schoolId)
      .as('class_counts');

    // Query to get counts for all schools using left joins to the aggregates
    const results = await this.db
      .select({
        schoolId: orgs.id,
        users: sql<number>`COALESCE(${userCounts.users}, 0)`.as('users'),
        classes: sql<number>`COALESCE(${classCounts.classes}, 0)`.as('classes'),
      })
      .from(orgs)
      .leftJoin(userCounts, eq(orgs.id, userCounts.schoolId))
      .leftJoin(classCounts, eq(orgs.id, classCounts.schoolId))
      .where(and(eq(orgs.orgType, OrgType.SCHOOL), inArray(orgs.id, schoolIds)));

    // Convert to Map for efficient lookup
    const countsMap = new Map<string, SchoolCounts>();
    for (const row of results) {
      countsMap.set(row.schoolId, {
        users: Number(row.users) || 0,
        classes: Number(row.classes) || 0,
      });
    }

    return countsMap;
  }

  /**
   * List schools by a pre-resolved set of IDs (from FGA).
   *
   * Used when authorization has already been resolved externally (e.g., via OpenFGA
   * `listAccessibleObjects`). Applies school-specific filtering (orgType, rosteringEnded)
   * and optional embed counts, but no SQL-based access control joins.
   *
   * @param ids - Pre-authorized school IDs from FGA
   * @param options - Pagination, sorting, and optional filters
   * @returns Paginated result with schools
   */
  async listByIds(ids: string[], options: ListAuthorizedOptions): Promise<PaginatedResult<School | SchoolWithCounts>> {
    const { includeEnded = false, embedCounts = false } = options;

    const where = includeEnded
      ? eq(orgs.orgType, OrgType.SCHOOL)
      : and(eq(orgs.orgType, OrgType.SCHOOL), isNull(orgs.rosteringEnded));

    const result = await this.getByIds(ids, {
      page: options.page,
      perPage: options.perPage,
      ...(options.orderBy && { orderBy: options.orderBy }),
      ...(where && { where }),
    });

    // Fetch and attach counts if requested
    if (embedCounts && result.items.length > 0) {
      const schoolIds = result.items.map((s) => s.id);
      const countsMap = await this.fetchSchoolCounts(schoolIds, includeEnded);

      const schoolsWithCounts = result.items.map((school) => ({
        ...school,
        counts: countsMap.get(school.id) ?? { users: 0, classes: 0 },
      })) as SchoolWithCounts[];

      return { items: schoolsWithCounts, totalItems: result.totalItems };
    }

    return result;
  }

  /**
   * List schools by a pre-resolved set of IDs (from FGA) filtered by district membership.
   *
   * Used when authorization has already been resolved externally (e.g., via OpenFGA
   * `listAccessibleObjects`). Applies district membership, school-type, and rostering-status
   * filtering in a single query — no extra round-trip to resolve district membership separately.
   *
   * @param districtId - UUID of the district to filter schools by
   * @param schoolIds - Pre-authorized school IDs from FGA to filter by district membership
   * @param options - Pagination, sorting, and optional filters
   * @returns Paginated result with schools
   */
  async listAccessibleByDistrictId(
    districtId: string,
    schoolIds: string[],
    options: ListAuthorizedOptions,
  ): Promise<PaginatedResult<School | SchoolWithCounts>> {
    if (schoolIds.length === 0) return { items: [], totalItems: 0 };

    const { page, perPage, orderBy, includeEnded = false, embedCounts = false } = options;

    // Combine district membership, school-type, FGA id set, and rostering-status in one query
    const whereConditions: SQL[] = [
      eq(orgs.orgType, OrgType.SCHOOL),
      eq(orgs.parentOrgId, districtId),
      inArray(orgs.id, schoolIds),
    ];

    if (!includeEnded) {
      whereConditions.push(isNull(orgs.rosteringEnded));
    }

    // Always at least 3 conditions, so and() is guaranteed defined
    const whereClause = and(...whereConditions)!;

    const result = await this.getAll({
      page,
      perPage,
      ...(orderBy && { orderBy }),
      where: whereClause,
    });

    if (embedCounts && result.items.length > 0) {
      const resultIds = result.items.map((s) => s.id);
      const countsMap = await this.fetchSchoolCounts(resultIds, includeEnded);

      const schoolsWithCounts = result.items.map((school) => ({
        ...school,
        counts: countsMap.get(school.id) ?? { users: 0, classes: 0 },
      })) as SchoolWithCounts[];

      return { items: schoolsWithCounts, totalItems: result.totalItems };
    }

    return result;
  }

  /**
   * Create a new school under a parent district.
   *
   * Sets server-managed columns according to school invariants:
   * - `orgType` = 'school'
   * - `isRosteringRootOrg` = false (the validate_org_hierarchy_fn trigger
   *   requires non-root orgs to have isRosteringRootOrg = false)
   * - `path` is initially set to a placeholder ltree value to satisfy the
   *   NOT NULL column constraint at the Drizzle insert layer; the
   *   `trg_orgs_compute_path_insert` BEFORE INSERT trigger overwrites it
   *   with the parent district's path appended with the school label.
   *
   * The repository does NOT verify that `parentOrgId` resolves to a district
   * — that's the service's responsibility, so the service can return a 422
   * with a useful context object before the DB attempt. If the parent does
   * not exist, the trigger will RAISE; the service should ensure that
   * doesn't happen.
   *
   * @param input - School-specific fields the caller is allowed to set,
   *   plus the resolved parentOrgId
   * @returns The new school id
   */
  async createSchool(input: CreateSchoolInput): Promise<{ id: string }> {
    return this.create({
      data: {
        name: input.name,
        abbreviation: input.abbreviation,
        orgType: OrgType.SCHOOL,
        parentOrgId: input.parentOrgId,
        path: 'placeholder',
        isRosteringRootOrg: false,
        ...(input.locationAddressLine1 !== undefined && { locationAddressLine1: input.locationAddressLine1 }),
        ...(input.locationAddressLine2 !== undefined && { locationAddressLine2: input.locationAddressLine2 }),
        ...(input.locationCity !== undefined && { locationCity: input.locationCity }),
        ...(input.locationStateProvince !== undefined && { locationStateProvince: input.locationStateProvince }),
        ...(input.locationPostalCode !== undefined && { locationPostalCode: input.locationPostalCode }),
        ...(input.locationCountry !== undefined && { locationCountry: input.locationCountry }),
        ...(input.mdrNumber !== undefined && { mdrNumber: input.mdrNumber }),
        ...(input.ncesId !== undefined && { ncesId: input.ncesId }),
        ...(input.stateId !== undefined && { stateId: input.stateId }),
        ...(input.schoolNumber !== undefined && { schoolNumber: input.schoolNumber }),
      },
    });
  }

  /**
   * Get a school by ID without authorization checks.
   * Used for super admins who have unrestricted access.
   *
   * @param schoolId - UUID of the school to retrieve
   * @returns The school if found, null otherwise
   */
  async getUnrestrictedById(schoolId: string): Promise<School | null> {
    const result = await this.db
      .select()
      .from(orgs)
      .where(and(eq(orgs.id, schoolId), eq(orgs.orgType, OrgType.SCHOOL)))
      .limit(1);

    return result[0] ?? null;
  }

  /**
   * List all schools within a district.
   *
   * This method does not apply authorization filtering and should only be used
   * for super admin access where all schools are visible.
   *
   * @param districtId - UUID of the district
   * @param options - Pagination, sorting, and optional filters
   * @returns Paginated result with schools
   */
  async listAllByDistrictId(
    districtId: string,
    options: ListAuthorizedOptions,
  ): Promise<PaginatedResult<School | SchoolWithCounts>> {
    const { page, perPage, orderBy, includeEnded = false, embedCounts = false } = options;

    // Build where clause for school type, district parent, and rostering status
    const whereConditions: SQL[] = [eq(orgs.orgType, OrgType.SCHOOL), eq(orgs.parentOrgId, districtId)];

    if (!includeEnded) {
      whereConditions.push(isNull(orgs.rosteringEnded));
    }

    // Always multiple conditions (orgType + parentOrgId at minimum), so and() is guaranteed defined
    const whereClause = and(...whereConditions)!;

    // Delegate to getAll() — tiebreaker asc(id) is handled by getAll() itself
    const result = await this.getAll({
      page,
      perPage,
      ...(orderBy && { orderBy }),
      where: whereClause,
    });

    // Fetch and attach counts if requested
    if (embedCounts && result.items.length > 0) {
      const schoolIds = result.items.map((s) => s.id);
      const countsMap = await this.fetchSchoolCounts(schoolIds, includeEnded);

      const schoolsWithCounts = result.items.map((school) => ({
        ...school,
        counts: countsMap.get(school.id) ?? { users: 0, classes: 0 },
      })) as SchoolWithCounts[];

      return {
        items: schoolsWithCounts,
        totalItems: result.totalItems,
      };
    }

    return result;
  }

  /**
   * Get users enrolled in a school.
   *
   * Returns all users who have an active enrollment in the specified school.
   * Only includes users with active enrollments (enrollment_start <= now and
   * enrollment_end is null or >= now).
   *
   * @param schoolId - School ID to check enrollments for
   * @param options - Options for filtering and pagination
   * @returns Paginated result of users enrolled in the school
   */
  async getUsersBySchoolId(
    schoolId: string,
    options: ListEnrolledUsersOptions,
  ): Promise<PaginatedResult<EnrolledUserEntity>> {
    const { page, perPage, orderBy } = options;
    const offset = (page - 1) * perPage;

    const schoolConditions = and(
      isEnrollmentActive(userOrgs),
      isNull(orgs.rosteringEnded),
      eq(orgs.id, schoolId),
      eq(orgs.orgType, OrgType.SCHOOL),
      ...getEnrolledUsersFilterConditions(options, UserJunctionTable.USER_ORGS),
    );

    const schoolUsersQuery = this.db
      .select({
        userId: users.id,
        role: userOrgs.role,
      })
      .from(userOrgs)
      .innerJoin(users, eq(users.id, userOrgs.userId))
      .innerJoin(orgs, eq(orgs.id, userOrgs.orgId))
      .where(schoolConditions);

    const classConditions = and(
      isEnrollmentActive(userClasses),
      isNull(classes.rosteringEnded),
      eq(classes.schoolId, schoolId),
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

    const combinedUsersQuery = schoolUsersQuery.union(classUsersQuery).as('combined_users');
    const countResult = await this.db
      .select({ count: countDistinct(combinedUsersQuery.userId) })
      .from(combinedUsersQuery);

    const totalItems = countResult[0]?.count ?? 0;

    if (totalItems === 0) {
      return { items: [], totalItems: 0 };
    }

    const sortField = orderBy?.field;
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
