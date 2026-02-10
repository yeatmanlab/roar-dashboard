import { and, eq, countDistinct, asc, desc, lte, gte, lt, gt, sql, count } from 'drizzle-orm';
import type { SQL, Column } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { administrations, administrationOrgs, orgs, type Administration, type Org } from '../db/schema';
import { CoreDbClient } from '../db/clients';
import type * as CoreDbSchema from '../db/schema/core';
import type {
  PaginationQuery,
  SortQuery,
  AdministrationSortFieldType,
  AdministrationDistrictSortFieldType,
  AdministrationSchoolSortFieldType,
  AdministrationStatus,
} from '@roar-dashboard/api-contract';
import { SortOrder } from '@roar-dashboard/api-contract';
import { BaseRepository, type PaginatedResult } from './base.repository';
import type { BasePaginatedQueryParams } from './interfaces/base.repository.interface';
import { AdministrationAccessControls } from './access-controls/administration.access-controls';
import { OrgAccessControls } from './access-controls/org.access-controls';
import type { AccessControlFilter } from './utils/parse-access-control-filter.utils';
import { OrgType } from '../enums/org-type.enum';

/**
 * Explicit mapping from API sort field names to administration table columns.
 * This ensures only valid columns are used for sorting, even if API validation is bypassed.
 */
const ADMINISTRATION_SORT_COLUMNS: Record<AdministrationSortFieldType, Column> = {
  createdAt: administrations.createdAt,
  name: administrations.name,
  dateStart: administrations.dateStart,
  dateEnd: administrations.dateEnd,
};

/**
 * Explicit mapping from API sort field names to org table columns.
 * Districts and schools share the same sort fields.
 */
const ORG_SORT_COLUMNS: Record<AdministrationDistrictSortFieldType | AdministrationSchoolSortFieldType, Column> = {
  name: orgs.name,
};

/**
 * Query options for administration repository methods (API contract format).
 */
export type AdministrationQueryOptions = PaginationQuery & SortQuery<AdministrationSortFieldType>;

/**
 * Options for listing administrations with optional status filter.
 */
export interface ListAuthorizedOptions extends BasePaginatedQueryParams {
  status?: AdministrationStatus;
}

/**
 * Options for listing orgs (districts/schools) of an administration.
 */
export type ListOrgsByAdministrationOptions = BasePaginatedQueryParams;

/**
 * Administration Repository
 *
 * Provides data access methods for the administrations table.
 * Extends BaseRepository for standard CRUD operations.
 *
 * Uses AdministrationAccessControls for authorization-related queries (accessible administrations,
 * assigned user counts) to keep authorization logic centralized and reusable.
 */
export class AdministrationRepository extends BaseRepository<Administration, typeof administrations> {
  private readonly accessControls: AdministrationAccessControls;
  private readonly orgAccessControls: OrgAccessControls;

  constructor(
    db: NodePgDatabase<typeof CoreDbSchema> = CoreDbClient,
    accessControls: AdministrationAccessControls = new AdministrationAccessControls(db),
    orgAccessControls: OrgAccessControls = new OrgAccessControls(db),
  ) {
    super(db, administrations);
    this.accessControls = accessControls;
    this.orgAccessControls = orgAccessControls;
  }

  /**
   * Build a SQL condition to filter administrations by status.
   * Internal method used by listAll and listAuthorized.
   *
   * @param status - The status filter (active, past, upcoming)
   * @returns SQL condition or undefined if no filter
   */
  private getStatusFilterCondition(status?: AdministrationStatus): SQL | undefined {
    if (!status) {
      return undefined;
    }

    const now = sql`NOW()`;

    switch (status) {
      case 'active':
        // dateStart <= now AND dateEnd >= now
        return and(lte(administrations.dateStart, now), gte(administrations.dateEnd, now));
      case 'past':
        // dateEnd < now
        return lt(administrations.dateEnd, now);
      case 'upcoming':
        // dateStart > now
        return gt(administrations.dateStart, now);
      default:
        return undefined;
    }
  }

  /**
   * List all administrations with optional status filter.
   *
   * This method does not apply authorization filtering and should only be used
   * for super admin access where all administrations are visible.
   *
   * @param options - Pagination, sorting, and optional status filter
   * @returns Paginated result with administrations
   */
  async listAll(options: ListAuthorizedOptions): Promise<PaginatedResult<Administration>> {
    const { page, perPage, orderBy, status } = options;
    const statusFilter = this.getStatusFilterCondition(status);

    return this.getAll({
      page,
      perPage,
      ...(orderBy && { orderBy }),
      ...(statusFilter && { where: statusFilter }),
    });
  }

  /**
   * List administrations the user is authorized to access.
   *
   * Authorization respects the org hierarchy:
   * - Administration assigned to a district → applies to all schools and classes in that district
   * - Administration assigned to a school → applies to all classes in that school
   * - User must have an allowed role in the org, class, or group
   *
   * @param accessControlFilter - User ID and allowed roles
   * @param options - Pagination, sorting, and optional status filter
   */
  async listAuthorized(
    accessControlFilter: AccessControlFilter,
    options: ListAuthorizedOptions,
  ): Promise<PaginatedResult<Administration>> {
    const { page, perPage, orderBy, status } = options;
    const offset = (page - 1) * perPage;

    // Build the UNION query for accessible administration IDs using access controls
    const accessibleAdmins = this.accessControls
      .buildUserAdministrationIdsQuery(accessControlFilter)
      .as('accessible_admins');

    // Build status filter if provided
    const statusFilter = this.getStatusFilterCondition(status);

    // Build the base join condition
    const baseCondition = eq(administrations.id, accessibleAdmins.administrationId);

    // Count query
    const countResult = await this.db
      .select({ count: countDistinct(administrations.id) })
      .from(administrations)
      .innerJoin(accessibleAdmins, baseCondition)
      .where(statusFilter);

    const totalItems = countResult[0]?.count ?? 0;

    if (totalItems === 0) {
      return { items: [], totalItems: 0 };
    }

    // Use explicit column mapping for type safety
    // Cast is safe because API contract validates the sort field before reaching repository
    const sortField = orderBy?.field as AdministrationSortFieldType | undefined;
    const sortColumn = sortField ? ADMINISTRATION_SORT_COLUMNS[sortField] : administrations.createdAt;
    const sortDirection = orderBy?.direction === SortOrder.ASC ? asc(sortColumn) : desc(sortColumn);

    // Data query: join administrations with the accessible IDs subquery + status filter
    const dataResult = await this.db
      .selectDistinct({ administration: administrations })
      .from(administrations)
      .innerJoin(accessibleAdmins, baseCondition)
      .where(statusFilter)
      .orderBy(sortDirection)
      .limit(perPage)
      .offset(offset);

    return {
      items: dataResult.map((row) => row.administration),
      totalItems,
    };
  }

  /**
   * Get a single administration by ID, only if the user is authorized to access it.
   *
   * Combines a direct lookup with an access control check. Returns the administration
   * if found AND accessible, null otherwise (prevents existence leaking).
   *
   * @param accessControlFilter - User ID and allowed roles
   * @param administrationId - The administration ID to retrieve
   * @returns The administration if found and accessible, null otherwise
   */
  async getAuthorizedById(
    accessControlFilter: AccessControlFilter,
    administrationId: string,
  ): Promise<Administration | null> {
    const accessibleAdmins = this.accessControls
      .buildUserAdministrationIdsQuery(accessControlFilter)
      .as('accessible_admins');

    const result = await this.db
      .select({ administration: administrations })
      .from(administrations)
      .innerJoin(accessibleAdmins, eq(administrations.id, accessibleAdmins.administrationId))
      .where(eq(administrations.id, administrationId))
      .limit(1);

    return result[0]?.administration ?? null;
  }

  /**
   * Get count of assigned users for multiple administrations.
   *
   * A user is "assigned" to an administration if they belong to an org, class, or group
   * that is linked to that administration. This respects the org hierarchy:
   * - Administration assigned to a district → includes users from all schools and classes in that district
   * - Administration assigned to a school → includes users from all classes in that school
   *
   * Delegates to AdministrationAccessControls for the actual query logic.
   *
   * @param administrationIds - Array of administration IDs to count assigned users for
   * @returns Map of administration ID to assigned user count
   */
  async getAssignedUserCountsByAdministrationIds(administrationIds: string[]): Promise<Map<string, number>> {
    return this.accessControls.getAssignedUserCountsByAdministrationIds(administrationIds);
  }

  /**
   * Get orgs of a specific type assigned to an administration.
   *
   * Returns only orgs matching the specified orgType that are directly assigned
   * to the administration via the administration_orgs junction table.
   *
   * @param administrationId - The administration ID to get orgs for
   * @param orgType - The org type to filter by (e.g., 'district', 'school')
   * @param options - Pagination and sorting options
   * @returns Paginated result with orgs
   */
  private async getOrgsByAdministrationId(
    administrationId: string,
    orgType: OrgType,
    options: ListOrgsByAdministrationOptions,
  ): Promise<PaginatedResult<Org>> {
    const { page, perPage, orderBy } = options;
    const offset = (page - 1) * perPage;

    const baseCondition = and(eq(administrationOrgs.administrationId, administrationId), eq(orgs.orgType, orgType));

    const countResult = await this.db
      .select({ count: count() })
      .from(administrationOrgs)
      .innerJoin(orgs, eq(orgs.id, administrationOrgs.orgId))
      .where(baseCondition);

    const totalItems = countResult[0]?.count ?? 0;

    if (totalItems === 0) {
      return { items: [], totalItems: 0 };
    }

    // Cast is safe because API contract validates the sort field before reaching repository
    const sortField = orderBy?.field as AdministrationDistrictSortFieldType | undefined;
    const sortColumn = sortField ? ORG_SORT_COLUMNS[sortField] : orgs.name;
    const sortDirection = orderBy?.direction === SortOrder.DESC ? desc(sortColumn) : asc(sortColumn);

    const dataResult = await this.db
      .select({ org: orgs })
      .from(administrationOrgs)
      .innerJoin(orgs, eq(orgs.id, administrationOrgs.orgId))
      .where(baseCondition)
      .orderBy(sortDirection)
      .limit(perPage)
      .offset(offset);

    return {
      items: dataResult.map((row) => row.org),
      totalItems,
    };
  }

  /**
   * Get orgs of a specific type assigned to an administration, filtered by user's accessible orgs.
   *
   * Unlike getOrgsByAdministrationId (used for super admins), this method filters
   * the results to only include orgs that the user can access based on their
   * org/class memberships.
   *
   * @param accessControlFilter - User ID and allowed roles for org access
   * @param administrationId - The administration ID to get orgs for
   * @param orgType - The org type to filter by
   * @param options - Pagination and sorting options
   * @returns Paginated result with orgs the user can access
   */
  private async getAuthorizedOrgsByAdministrationId(
    accessControlFilter: AccessControlFilter,
    administrationId: string,
    orgType: OrgType,
    options: ListOrgsByAdministrationOptions,
  ): Promise<PaginatedResult<Org>> {
    const { page, perPage, orderBy } = options;
    const offset = (page - 1) * perPage;

    const accessibleOrgs = this.orgAccessControls
      .buildUserAccessibleOrgIdsQuery(accessControlFilter)
      .as('accessible_orgs');

    const whereCondition = and(eq(administrationOrgs.administrationId, administrationId), eq(orgs.orgType, orgType));

    const countResult = await this.db
      .select({ count: count() })
      .from(administrationOrgs)
      .innerJoin(orgs, eq(orgs.id, administrationOrgs.orgId))
      .innerJoin(accessibleOrgs, eq(orgs.id, accessibleOrgs.orgId))
      .where(whereCondition);

    const totalItems = countResult[0]?.count ?? 0;

    if (totalItems === 0) {
      return { items: [], totalItems: 0 };
    }

    // Cast is safe because API contract validates the sort field before reaching repository
    const sortField = orderBy?.field as AdministrationDistrictSortFieldType | undefined;
    const sortColumn = sortField ? ORG_SORT_COLUMNS[sortField] : orgs.name;
    const sortDirection = orderBy?.direction === SortOrder.DESC ? desc(sortColumn) : asc(sortColumn);

    const dataResult = await this.db
      .select({ org: orgs })
      .from(administrationOrgs)
      .innerJoin(orgs, eq(orgs.id, administrationOrgs.orgId))
      .innerJoin(accessibleOrgs, eq(orgs.id, accessibleOrgs.orgId))
      .where(whereCondition)
      .orderBy(sortDirection)
      .limit(perPage)
      .offset(offset);

    return {
      items: dataResult.map((row) => row.org),
      totalItems,
    };
  }

  /**
   * Get districts assigned to an administration.
   *
   * @param administrationId - The administration ID to get districts for
   * @param options - Pagination and sorting options
   * @returns Paginated result with districts
   */
  async getDistrictsByAdministrationId(
    administrationId: string,
    options: ListOrgsByAdministrationOptions,
  ): Promise<PaginatedResult<Org>> {
    return this.getOrgsByAdministrationId(administrationId, OrgType.DISTRICT, options);
  }

  /**
   * Get districts assigned to an administration, filtered by user's accessible orgs.
   *
   * @param accessControlFilter - User ID and allowed roles for org access
   * @param administrationId - The administration ID to get districts for
   * @param options - Pagination and sorting options
   * @returns Paginated result with districts the user can access
   */
  async getAuthorizedDistrictsByAdministrationId(
    accessControlFilter: AccessControlFilter,
    administrationId: string,
    options: ListOrgsByAdministrationOptions,
  ): Promise<PaginatedResult<Org>> {
    return this.getAuthorizedOrgsByAdministrationId(accessControlFilter, administrationId, OrgType.DISTRICT, options);
  }

  /**
   * Get schools assigned to an administration.
   *
   * @param administrationId - The administration ID to get schools for
   * @param options - Pagination and sorting options
   * @returns Paginated result with schools
   */
  async getSchoolsByAdministrationId(
    administrationId: string,
    options: ListOrgsByAdministrationOptions,
  ): Promise<PaginatedResult<Org>> {
    return this.getOrgsByAdministrationId(administrationId, OrgType.SCHOOL, options);
  }

  /**
   * Get schools assigned to an administration, filtered by user's accessible orgs.
   *
   * @param accessControlFilter - User ID and allowed roles for org access
   * @param administrationId - The administration ID to get schools for
   * @param options - Pagination and sorting options
   * @returns Paginated result with schools the user can access
   */
  async getAuthorizedSchoolsByAdministrationId(
    accessControlFilter: AccessControlFilter,
    administrationId: string,
    options: ListOrgsByAdministrationOptions,
  ): Promise<PaginatedResult<Org>> {
    return this.getAuthorizedOrgsByAdministrationId(accessControlFilter, administrationId, OrgType.SCHOOL, options);
  }

  /**
   * Get user's roles for a specific administration.
   *
   * Delegates to AdministrationAccessControls to determine which roles the user
   * has that grant access to this administration.
   *
   * @param userId - The user ID to get roles for
   * @param administrationId - The administration ID to check
   * @returns Array of roles the user has for this administration
   */
  async getUserRolesForAdministration(userId: string, administrationId: string): Promise<string[]> {
    return this.accessControls.getUserRolesForAdministration(userId, administrationId);
  }
}
