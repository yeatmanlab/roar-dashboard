import { eq, asc, desc, countDistinct, and, isNull, sql, inArray } from 'drizzle-orm';
import type { SQL, Column } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { PaginatedResult } from './base.repository';
import { BaseRepository } from './base.repository';
import type { Org } from '../db/schema';
import { orgs, userOrgs, classes } from '../db/schema';
import { CoreDbClient } from '../db/clients';
import type * as CoreDbSchema from '../db/schema/core';
import { OrgAccessControls } from './access-controls/org.access-controls';
import type { AccessControlFilter } from './utils/parse-access-control-filter.utils';
import type { DistrictSortFieldType } from '@roar-dashboard/api-contract';
import { SortOrder } from '@roar-dashboard/api-contract';
import { OrgType } from '../enums/org-type.enum';

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
 * Explicit mapping from API sort field names to district table columns.
 * This ensures only valid columns are used for sorting.
 */
const DISTRICT_SORT_COLUMNS = {
  name: orgs.name,
  abbreviation: orgs.abbreviation,
} as const satisfies Record<DistrictSortFieldType, Column>;

/**
 * Options for listing districts with authorization
 */
export interface ListAuthorizedOptions {
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
 * Provides both unrestricted access (for super admins) and RBAC-filtered access
 * (for regular users based on their org/class/group memberships).
 */
export class DistrictRepository extends BaseRepository<District, typeof orgs> {
  private readonly accessControls: OrgAccessControls;

  constructor(db: NodePgDatabase<typeof CoreDbSchema> = CoreDbClient) {
    super(db, orgs);
    this.accessControls = new OrgAccessControls(db);
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
  async listAll(options: ListAuthorizedOptions): Promise<PaginatedResult<District | DistrictWithCounts>> {
    const { page, perPage, orderBy, includeEnded = false, embedCounts = false } = options;

    // Build where clause for district type and rostering status
    const whereConditions: SQL[] = [eq(orgs.orgType, OrgType.DISTRICT)];

    if (!includeEnded) {
      whereConditions.push(isNull(orgs.rosteringEnded));
    }

    const where = whereConditions.length > 1 ? and(...whereConditions) : whereConditions[0];

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
   * List districts the user is authorized to access.
   *
   * Authorization respects the org hierarchy:
   * - User in District → sees that district (+ descendants if supervisory)
   * - User in School → sees parent district
   * - User in Class → sees parent school's district
   *
   * @param accessControlFilter - User ID and allowed roles
   * @param options - Pagination, sorting, and optional filters
   * @returns Paginated result with authorized districts
   */
  async listAuthorized(
    accessControlFilter: AccessControlFilter,
    options: ListAuthorizedOptions,
  ): Promise<PaginatedResult<District | DistrictWithCounts>> {
    const { page, perPage, orderBy, includeEnded = false, embedCounts = false } = options;
    const offset = (page - 1) * perPage;

    // Build the UNION query for accessible org IDs using access controls
    // We'll filter for districts in the WHERE clause
    const accessibleOrgs = this.accessControls
      .buildUserAccessibleOrgIdsQuery(accessControlFilter)
      .as('accessible_orgs');

    // Build where conditions
    const whereConditions: SQL[] = [eq(orgs.orgType, OrgType.DISTRICT)];

    if (!includeEnded) {
      whereConditions.push(isNull(orgs.rosteringEnded));
    }

    const whereClause = whereConditions.length > 1 ? and(...whereConditions) : whereConditions[0];

    // Build the base join condition
    const baseCondition = eq(orgs.id, accessibleOrgs.orgId);

    // Count query
    const countResult = await this.db
      .select({ count: countDistinct(orgs.id) })
      .from(orgs)
      .innerJoin(accessibleOrgs, baseCondition)
      .where(whereClause);

    const totalItems = Number(countResult[0]?.count ?? 0);

    if (totalItems === 0) {
      return { items: [], totalItems: 0 };
    }

    // Resolve sort column
    const sortField = orderBy?.field as DistrictSortFieldType | undefined;
    const sortColumn =
      sortField && sortField in DISTRICT_SORT_COLUMNS
        ? DISTRICT_SORT_COLUMNS[sortField as keyof typeof DISTRICT_SORT_COLUMNS]
        : orgs.name;
    const sortDirection = orderBy?.direction === SortOrder.ASC ? asc(sortColumn) : desc(sortColumn);

    // Data query: join districts with the accessible IDs subquery
    const dataResult = await this.db
      .select({ org: orgs })
      .from(orgs)
      .innerJoin(accessibleOrgs, baseCondition)
      .where(whereClause)
      .orderBy(sortDirection, asc(orgs.id))
      .limit(perPage)
      .offset(offset);

    let districts: (District | DistrictWithCounts)[] = dataResult.map((row) => row.org as District);

    // Fetch and attach counts if requested
    if (embedCounts && districts.length > 0) {
      const districtIds = districts.map((d) => d.id);
      const countsMap = await this.fetchDistrictCounts(districtIds, includeEnded);

      districts = districts.map((district) => ({
        ...district,
        counts: countsMap.get(district.id) ?? { users: 0, schools: 0, classes: 0 },
      }));
    }

    return {
      items: districts,
      totalItems,
    };
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
   * Get a district by ID with authorization checks.
   * Only returns the district if the user has access via org/class/group membership.
   *
   * @param filter - Access control filter with userId and allowed roles
   * @param districtId - UUID of the district to retrieve
   * @returns The district if found and authorized, null otherwise
   */
  async getAuthorizedById(filter: AccessControlFilter, districtId: string): Promise<District | null> {
    const accessibleOrgs = this.accessControls.buildUserAccessibleOrgIdsQuery(filter).as('accessible_orgs');

    const result = await this.db
      .select({ org: orgs })
      .from(orgs)
      .innerJoin(accessibleOrgs, eq(orgs.id, accessibleOrgs.orgId))
      .where(and(eq(orgs.id, districtId), eq(orgs.orgType, OrgType.DISTRICT)))
      .limit(1);

    return result[0]?.org ?? null;
  }

  /**
   * Get the roles a user has for a specific district.
   *
   * @param userId - The user ID
   * @param districtId - The district ID
   * @returns Array of role strings the user has for this district
   */
  async getUserRolesForDistrict(userId: string, districtId: string): Promise<string[]> {
    return this.accessControls.getUserRolesForOrg(userId, districtId);
  }
}
