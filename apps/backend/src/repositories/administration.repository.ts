import { and, eq, countDistinct, asc, desc, lte, gte, lt, gt, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { administrations, type Administration } from '../db/schema';
import { CoreDbClient } from '../db/clients';
import type * as CoreDbSchema from '../db/schema/core';
import type {
  PaginationQuery,
  SortQuery,
  ADMINISTRATION_SORT_FIELDS,
  AdministrationStatus,
} from '@roar-dashboard/api-contract';
import { BaseRepository, type PaginatedResult } from './base.repository';
import type { BasePaginatedQueryParams } from './interfaces/base.repository.interface';
import { AdministrationAccessControls } from './access-controls/administration.access-controls';
import type { AccessControlFilter } from './utils/access-controls.utils';

/**
 * Sort field type derived from api-contract.
 */
export type AdministrationSortField = (typeof ADMINISTRATION_SORT_FIELDS)[number];

/**
 * Query options for administration repository methods (API contract format).
 */
export type AdministrationQueryOptions = PaginationQuery & SortQuery<AdministrationSortField>;

/**
 * Options for listing administrations with optional status filter.
 */
export interface ListAuthorizedOptions extends BasePaginatedQueryParams {
  status?: AdministrationStatus;
}

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

  constructor(
    db: NodePgDatabase<typeof CoreDbSchema> = CoreDbClient,
    accessControls: AdministrationAccessControls = new AdministrationAccessControls(db),
  ) {
    super(db, administrations);
    this.accessControls = accessControls;
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

    // Map field name to column (matches SORT_FIELD_TO_COLUMN in administration.service.ts)
    const SORT_FIELD_TO_COLUMN = {
      name: administrations.name,
      createdAt: administrations.createdAt,
      dateStart: administrations.dateStart,
      dateEnd: administrations.dateEnd,
    } as const;
    const sortColumn =
      SORT_FIELD_TO_COLUMN[orderBy?.field as keyof typeof SORT_FIELD_TO_COLUMN] ?? administrations.createdAt;
    const sortDirection = orderBy?.direction === 'asc' ? asc(sortColumn) : desc(sortColumn);

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
}
