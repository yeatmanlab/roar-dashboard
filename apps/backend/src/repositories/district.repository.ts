import { eq, asc, desc, countDistinct, and, isNull, SQL } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { BaseRepository, type PaginatedResult } from './base.repository';
import { orgs, type Org } from '../db/schema';
import { CoreDbClient } from '../db/clients';
import type * as CoreDbSchema from '../db/schema/core';
import { DistrictAccessControls } from './access-controls/district.access-controls';
import type { AccessControlFilter } from './utils/access-controls.utils';

/**
 * District-specific type (Org with orgType = 'district')
 */
export type District = Org;

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
}

/**
 * District Repository
 *
 * Handles data access for districts (orgs with orgType = 'district').
 * Provides both unrestricted access (for super admins) and RBAC-filtered access
 * (for regular users based on their org/class/group memberships).
 */
export class DistrictRepository extends BaseRepository<District, typeof orgs> {
  private readonly accessControls: DistrictAccessControls;

  constructor(db: NodePgDatabase<typeof CoreDbSchema> = CoreDbClient) {
    super(db, orgs);
    this.accessControls = new DistrictAccessControls(db);
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
  async listAll(options: ListAuthorizedOptions): Promise<PaginatedResult<District>> {
    const { page, perPage, orderBy, includeEnded = false } = options;

    // Build where clause for district type and rostering status
    const whereConditions: SQL[] = [eq(orgs.orgType, 'district')];

    if (!includeEnded) {
      whereConditions.push(isNull(orgs.rosteringEnded));
    }

    const where = whereConditions.length > 1 ? and(...whereConditions) : whereConditions[0];

    return this.getAll({
      page,
      perPage,
      ...(orderBy && { orderBy }),
      ...(where && { where }),
    });
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
  ): Promise<PaginatedResult<District>> {
    const { page, perPage, orderBy, includeEnded = false } = options;
    const offset = (page - 1) * perPage;

    // Build the UNION query for accessible district IDs using access controls
    const accessibleDistricts = this.accessControls
      .buildUserDistrictIdsQuery(accessControlFilter)
      .as('accessible_districts');

    // Build where conditions
    const whereConditions: SQL[] = [eq(orgs.orgType, 'district')];

    if (!includeEnded) {
      whereConditions.push(isNull(orgs.rosteringEnded));
    }

    const whereClause = whereConditions.length > 1 ? and(...whereConditions) : whereConditions[0];

    // Build the base join condition
    const baseCondition = eq(orgs.id, accessibleDistricts.orgId);

    // Count query
    const countResult = await this.db
      .select({ count: countDistinct(orgs.id) })
      .from(orgs)
      .innerJoin(accessibleDistricts, baseCondition)
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
      .selectDistinct({ org: orgs })
      .from(orgs)
      .innerJoin(accessibleDistricts, baseCondition)
      .where(whereClause)
      .orderBy(sortDirection)
      .limit(perPage)
      .offset(offset);

    return {
      items: dataResult.map((row) => row.org as District),
      totalItems,
    };
  }

  /**
   * Get a single district by ID.
   *
   * @param id - District ID
   * @returns District or null if not found or not a district
   */
  async getById(id: string): Promise<District | null> {
    const result = await this.db
      .select()
      .from(orgs)
      .where(and(eq(orgs.id, id), eq(orgs.orgType, 'district')))
      .limit(1);

    return (result[0] as District) ?? null;
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
}
