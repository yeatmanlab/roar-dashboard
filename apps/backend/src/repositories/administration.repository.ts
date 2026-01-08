import { and, eq, or, inArray, countDistinct, asc, desc } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  administrations,
  administrationOrgs,
  administrationClasses,
  administrationGroups,
  userOrgs,
  userClasses,
  userGroups,
  type Administration,
} from '../db/schema';
import { CoreDbClient } from '../db/clients';
import type * as CoreDbSchema from '../db/schema/core';
import type { PaginationQuery, SortQuery, ADMINISTRATION_SORT_FIELDS } from '@roar-dashboard/api-contract';
import type { UserRole } from '../enums/user-role.enum';
import { BaseRepository, type PaginatedResult } from './base.repository';
import type { BasePaginatedQueryParams } from './interfaces/base.repository.interface';

/**
 * Sort field type derived from api-contract.
 */
export type AdministrationSortField = (typeof ADMINISTRATION_SORT_FIELDS)[number];

/**
 * Query options for administration repository methods (API contract format).
 */
export type AdministrationQueryOptions = PaginationQuery & SortQuery<AdministrationSortField>;

/**
 * Authorization filter for repository queries.
 * Encapsulates user identity and allowed roles for access control.
 */
export interface AuthorizationFilter {
  userId: string;
  allowedRoles: UserRole[];
}

/**
 * Administration Repository
 *
 * Provides data access methods for the administrations table.
 * Extends BaseRepository for standard CRUD operations.
 */
export class AdministrationRepository extends BaseRepository<Administration, typeof administrations> {
  constructor(db: NodePgDatabase<typeof CoreDbSchema> = CoreDbClient) {
    super(db, administrations);
  }

  /**
   * List administrations the user is authorized to access.
   *
   * Authorization is built into the query via JOINs:
   * - User must have a role in an org, class, or group linked to the administration
   * - The role must be in the allowedRoles array
   */
  async listAuthorized(
    authorization: AuthorizationFilter,
    options: BasePaginatedQueryParams,
  ): Promise<PaginatedResult<Administration>> {
    const { userId, allowedRoles } = authorization;

    if (allowedRoles.length === 0) {
      return { items: [], totalItems: 0 };
    }

    const { page = 1, perPage = 10, orderBy } = options;
    const offset = (page - 1) * perPage;

    // Build the base query with authorization JOINs
    const baseQuery = this.db
      .selectDistinct({ administration: administrations })
      .from(administrations)
      .leftJoin(administrationOrgs, eq(administrationOrgs.administrationId, administrations.id))
      .leftJoin(userOrgs, and(eq(userOrgs.orgId, administrationOrgs.orgId), eq(userOrgs.userId, userId)))
      .leftJoin(administrationClasses, eq(administrationClasses.administrationId, administrations.id))
      .leftJoin(
        userClasses,
        and(eq(userClasses.classId, administrationClasses.classId), eq(userClasses.userId, userId)),
      )
      .leftJoin(administrationGroups, eq(administrationGroups.administrationId, administrations.id))
      .leftJoin(userGroups, and(eq(userGroups.groupId, administrationGroups.groupId), eq(userGroups.userId, userId)))
      .where(
        or(
          inArray(userOrgs.role, allowedRoles),
          inArray(userClasses.role, allowedRoles),
          inArray(userGroups.role, allowedRoles),
        ),
      );

    // Count query
    const countResult = await this.db
      .select({ count: countDistinct(administrations.id) })
      .from(administrations)
      .leftJoin(administrationOrgs, eq(administrationOrgs.administrationId, administrations.id))
      .leftJoin(userOrgs, and(eq(userOrgs.orgId, administrationOrgs.orgId), eq(userOrgs.userId, userId)))
      .leftJoin(administrationClasses, eq(administrationClasses.administrationId, administrations.id))
      .leftJoin(
        userClasses,
        and(eq(userClasses.classId, administrationClasses.classId), eq(userClasses.userId, userId)),
      )
      .leftJoin(administrationGroups, eq(administrationGroups.administrationId, administrations.id))
      .leftJoin(userGroups, and(eq(userGroups.groupId, administrationGroups.groupId), eq(userGroups.userId, userId)))
      .where(
        or(
          inArray(userOrgs.role, allowedRoles),
          inArray(userClasses.role, allowedRoles),
          inArray(userGroups.role, allowedRoles),
        ),
      );

    const totalItems = countResult[0]?.count ?? 0;

    if (totalItems === 0) {
      return { items: [], totalItems: 0 };
    }

    // Get sort column based on field
    const getSortColumn = (field: string | undefined) => {
      switch (field) {
        case 'dateStart':
          return administrations.dateStart;
        case 'dateEnd':
          return administrations.dateEnd;
        case 'name':
          return administrations.name;
        default:
          return administrations.createdAt;
      }
    };
    const sortColumn = getSortColumn(orderBy?.field);
    const sortDirection = orderBy?.direction === 'asc' ? asc(sortColumn) : desc(sortColumn);

    // Data query with pagination and sorting
    const dataResult = await baseQuery.orderBy(sortDirection).limit(perPage).offset(offset);

    return {
      items: dataResult.map((row) => row.administration),
      totalItems,
    };
  }
}
