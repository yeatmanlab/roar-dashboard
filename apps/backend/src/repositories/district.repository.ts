import { eq, asc, desc, countDistinct, and, isNull, SQL, sql, inArray } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { BaseRepository, type PaginatedResult } from './base.repository';
import { orgs, type Org, userOrgs, classes } from '../db/schema';
import { CoreDbClient } from '../db/clients';
import type * as CoreDbSchema from '../db/schema/core';
import { OrgAccessControls } from './access-controls/org.access-controls';
import type { AccessControlFilter } from './utils/access-controls.utils';

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
 * Options for listing districts with authorization
 */
export interface ListAuthorizedOptions {
  page: number;
  perPage: number;
  orderBy?: {
    field: string;
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
  async listAll(options: ListAuthorizedOptions): Promise<PaginatedResult<DistrictWithCounts>> {
    const { page, perPage, orderBy, includeEnded = false, embedCounts = false } = options;

    // Build where clause for district type and rostering status
    const whereConditions: SQL[] = [eq(orgs.orgType, 'district')];

    if (!includeEnded) {
      whereConditions.push(isNull(orgs.rosteringEnded));
    }

    const where = whereConditions.length > 1 ? and(...whereConditions) : whereConditions[0];

    const result = await this.getAll({
      page,
      perPage,
      ...(orderBy && { orderBy }),
      ...(where && { where }),
    });

    // If embedCounts is requested, fetch aggregated statistics for each district
    if (embedCounts && result.items.length > 0) {
      const districtIds = result.items.map((d) => d.id);
      const countsMap = await this.fetchDistrictCounts(districtIds, includeEnded);

      return {
        items: result.items.map((district) => ({
          ...district,
          counts: countsMap.get(district.id) ?? { users: 0, schools: 0, classes: 0 },
        })),
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
  ): Promise<PaginatedResult<DistrictWithCounts>> {
    const { page, perPage, orderBy, includeEnded = false, embedCounts = false } = options;
    const offset = (page - 1) * perPage;

    // Build the UNION query for accessible org IDs using access controls
    // We'll filter for districts in the WHERE clause
    const accessibleOrgs = this.accessControls
      .buildUserAccessibleOrgIdsQuery(accessControlFilter)
      .as('accessible_orgs');

    // Build where conditions
    const whereConditions: SQL[] = [eq(orgs.orgType, 'district')];

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

    const totalItems = countResult[0]?.count ?? 0;

    if (totalItems === 0) {
      return { items: [], totalItems: 0 };
    }

    // Get sort column based on field
    const getSortColumn = (field: string | undefined) => {
      switch (field) {
        case 'name':
          return orgs.name;
        case 'abbreviation':
          return orgs.abbreviation;
        case 'createdAt':
        default:
          return orgs.createdAt;
      }
    };
    const sortColumn = getSortColumn(orderBy?.field);
    const sortDirection = orderBy?.direction === 'asc' ? asc(sortColumn) : desc(sortColumn);

    // Data query: join districts with the accessible IDs subquery
    const dataResult = await this.db
      .select({ org: orgs })
      .from(orgs)
      .innerJoin(accessibleOrgs, baseCondition)
      .where(whereClause)
      .orderBy(sortDirection)
      .limit(perPage)
      .offset(offset);

    const districts = dataResult.map((row) => row.org as District);

    // If embedCounts is requested, fetch aggregated statistics for each district
    if (embedCounts && districts.length > 0) {
      const districtIds = districts.map((d) => d.id);
      const countsMap = await this.fetchDistrictCounts(districtIds, includeEnded);

      return {
        items: districts.map((district) => ({
          ...district,
          counts: countsMap.get(district.id) ?? { users: 0, schools: 0, classes: 0 },
        })),
        totalItems,
      };
    }

    return {
      items: districts,
      totalItems,
    };
  }

  /**
   * Get child organizations of a district.
   *
   * @param districtId - Parent district ID
   * @param includeEnded - Whether to include organizations with rosteringEnded set
   * @returns List of child organizations
   */
  async getChildren(districtId: string, includeEnded = false): Promise<Org[]> {
    const whereConditions: SQL[] = [eq(orgs.parentOrgId, districtId)];

    if (!includeEnded) {
      whereConditions.push(isNull(orgs.rosteringEnded));
    }

    const where = whereConditions.length > 1 ? and(...whereConditions) : whereConditions[0];

    return this.db.select().from(orgs).where(where).orderBy(asc(orgs.name));
  }

  /**
   * Fetch aggregated counts for multiple districts.
   *
   * Computes:
   * - users: COUNT of active users in district (from userOrgs where enrollmentEnd IS NULL)
   * - schools: COUNT of schools where parentOrgId = district.id and rosteringEnded IS NULL
   * - classes: COUNT of classes in district schools (via classes joined through schools)
   *
   * @param districtIds - Array of district IDs to fetch counts for
   * @param includeEnded - Whether to include ended organizations in school counts
   * @returns Map of district ID to counts
   */
  private async fetchDistrictCounts(
    districtIds: string[],
    includeEnded: boolean,
  ): Promise<Map<string, DistrictCounts>> {
    // Build where conditions for schools
    const schoolWhereConditions: SQL[] = [eq(orgs.orgType, 'school')];
    if (!includeEnded) {
      schoolWhereConditions.push(isNull(orgs.rosteringEnded));
    }

    // Query to get counts for all districts in one go
    // We use separate subqueries for each count to handle the different join conditions
    const results = await this.db
      .select({
        districtId: orgs.id,
        users: sql<number>`(
          SELECT COUNT(DISTINCT ${userOrgs.userId})
          FROM app.user_orgs
          WHERE ${userOrgs.orgId} = ${orgs.id}
            AND ${userOrgs.enrollmentEnd} IS NULL
        )`.as('users'),
        schools: sql<number>`(
          SELECT COUNT(DISTINCT id)
          FROM app.orgs
          WHERE parent_org_id = ${orgs.id}
            AND org_type = 'school'
            ${includeEnded ? sql`` : sql`AND rostering_ended IS NULL`}
        )`.as('schools'),
        classes: sql<number>`(
          SELECT COUNT(DISTINCT ${classes.id})
          FROM app.classes
          WHERE ${classes.districtId} = ${orgs.id}
        )`.as('classes'),
      })
      .from(orgs)
      .where(and(eq(orgs.orgType, 'district'), inArray(orgs.id, districtIds)));

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
}
