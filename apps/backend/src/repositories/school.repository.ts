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
import type { SchoolSortFieldType } from '@roar-dashboard/api-contract';
import { SortOrder } from '@roar-dashboard/api-contract';
import { OrgType } from '../enums/org-type.enum';

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
 * Explicit mapping from API sort field names to school table columns.
 * This ensures only valid columns are used for sorting.
 */
const SCHOOL_SORT_COLUMNS = {
  name: orgs.name,
  abbreviation: orgs.abbreviation,
} as const satisfies Record<SchoolSortFieldType, Column>;

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
 * Provides both unrestricted access (for super admins) and RBAC-filtered access
 * (for regular users based on their org/class/group memberships).
 */
export class SchoolRepository extends BaseRepository<School, typeof orgs> {
  private readonly accessControls: OrgAccessControls;

  constructor(db: NodePgDatabase<typeof CoreDbSchema> = CoreDbClient) {
    super(db, orgs);
    this.accessControls = new OrgAccessControls(db);
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
      const countsMap = await this.fetchSchoolCounts(schoolIds);

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
   * List schools the user is authorized to access.
   *
   * Authorization respects the org hierarchy:
   * - User in School → sees that school
   * - User in Class → sees parent school
   * - User in District → sees child schools (if supervisory)
   *
   * @param accessControlFilter - User ID and allowed roles
   * @param options - Pagination, sorting, and optional filters
   * @returns Paginated result with authorized schools
   */
  async listAuthorized(
    accessControlFilter: AccessControlFilter,
    options: ListAuthorizedOptions,
  ): Promise<PaginatedResult<School | SchoolWithCounts>> {
    const { page, perPage, orderBy, includeEnded = false, embedCounts = false } = options;
    const offset = (page - 1) * perPage;

    // Build the UNION query for accessible org IDs using access controls
    const accessibleOrgs = this.accessControls
      .buildUserAccessibleOrgIdsQuery(accessControlFilter)
      .as('accessible_orgs');

    // Build where conditions
    const whereConditions: SQL[] = [eq(orgs.orgType, OrgType.SCHOOL)];

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
    const sortField = orderBy?.field as SchoolSortFieldType | undefined;
    const sortColumn =
      sortField && sortField in SCHOOL_SORT_COLUMNS
        ? SCHOOL_SORT_COLUMNS[sortField as keyof typeof SCHOOL_SORT_COLUMNS]
        : orgs.name;
    const sortDirection = orderBy?.direction === SortOrder.ASC ? asc(sortColumn) : desc(sortColumn);

    // Data query: join schools with the accessible IDs subquery
    const dataResult = await this.db
      .select({ org: orgs })
      .from(orgs)
      .innerJoin(accessibleOrgs, baseCondition)
      .where(whereClause)
      .orderBy(sortDirection, asc(orgs.id))
      .limit(perPage)
      .offset(offset);

    let schools: (School | SchoolWithCounts)[] = dataResult.map((row) => row.org as School);

    // Fetch and attach counts if requested
    if (embedCounts && schools.length > 0) {
      const schoolIds = schools.map((s) => s.id);
      const countsMap = await this.fetchSchoolCounts(schoolIds);

      schools = schools.map((school) => ({
        ...school,
        counts: countsMap.get(school.id) ?? { users: 0, classes: 0 },
      }));
    }

    return {
      items: schools,
      totalItems,
    };
  }

  /**
   * Fetch aggregated counts for multiple schools.
   *
   * Computes:
   * - users: COUNT of active users in school (from userOrgs where enrollmentEnd IS NULL)
   * - classes: COUNT of active classes in school (from classes where rosteringEnded IS NULL)
   *
   * Uses pre-aggregated subqueries with left joins for better performance at scale
   * instead of correlated subqueries (O(n) vs O(n*m)).
   *
   * @param schoolIds - Array of school IDs to fetch counts for
   * @returns Map of school ID to counts
   */
  private async fetchSchoolCounts(schoolIds: string[]): Promise<Map<string, SchoolCounts>> {
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

    // Pre-aggregate class counts per school (only active classes)
    const classCounts = this.db
      .select({
        schoolId: classes.schoolId,
        classes: countDistinct(classes.id).as('classes'),
      })
      .from(classes)
      .where(and(inArray(classes.schoolId, schoolIds), isNull(classes.rosteringEnded)))
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

    // Build where clause for school type and rostering status
    const whereConditions: SQL[] = [eq(orgs.orgType, OrgType.SCHOOL)];

    if (!includeEnded) {
      whereConditions.push(isNull(orgs.rosteringEnded));
    }

    const where = whereConditions.length > 1 ? and(...whereConditions) : whereConditions[0];

    const result = await this.getByIds(ids, {
      page: options.page,
      perPage: options.perPage,
      ...(options.orderBy && { orderBy: options.orderBy }),
      ...(where && { where }),
    });

    // Fetch and attach counts if requested
    if (embedCounts && result.items.length > 0) {
      const schoolIds = result.items.map((s) => s.id);
      const countsMap = await this.fetchSchoolCounts(schoolIds);

      const schoolsWithCounts = result.items.map((school) => ({
        ...school,
        counts: countsMap.get(school.id) ?? { users: 0, classes: 0 },
      })) as SchoolWithCounts[];

      return { items: schoolsWithCounts, totalItems: result.totalItems };
    }

    return result;
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
   * Get a single school by ID with authorization check.
   * Only returns the school if the user has access via org/class membership.
   *
   * Note: Groups are a flat hierarchy, so group membership does NOT grant access
   * to schools. Access is determined by org ancestors, class ancestors, and org descendants only.
   *
   * Note: This method does NOT filter by rosteringEnded. That business rule is
   * handled in the service layer to ensure proper HTTP status codes (404 vs 403).
   *
   * @param filter - Access control filter with userId and allowed roles
   * @param schoolId - UUID of the school to retrieve
   * @returns The school if found and authorized, null otherwise
   */
  async getAuthorizedById(filter: AccessControlFilter, schoolId: string): Promise<School | null> {
    const accessibleOrgs = this.accessControls.buildUserAccessibleOrgIdsQuery(filter).as('accessible_orgs');

    const result = await this.db
      .select({ org: orgs })
      .from(orgs)
      .innerJoin(accessibleOrgs, eq(orgs.id, accessibleOrgs.orgId))
      .where(and(eq(orgs.id, schoolId), eq(orgs.orgType, OrgType.SCHOOL)))
      .limit(1);

    return result[0]?.org ?? null;
  }

  /**
   * Get the roles a user holds for a specific school.
   *
   * @param userId - The user ID
   * @param schoolId - The school ID
   * @returns Array of roles the user has for the school
   */
  async getUserRolesForSchool(userId: string, schoolId: string): Promise<string[]> {
    return this.accessControls.getUserRolesForOrg(userId, schoolId);
  }
}
