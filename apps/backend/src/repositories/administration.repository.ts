import { and, eq, inArray, countDistinct, asc, desc, lte, gte, lt, gt, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  administrations,
  administrationOrgs,
  administrationClasses,
  administrationGroups,
  userOrgs,
  userClasses,
  userGroups,
  orgs,
  classes,
  groups,
  type Administration,
} from '../db/schema';
import { SUPERVISORY_ROLES } from '../constants/role-classifications';
import { CoreDbClient } from '../db/clients';
import type * as CoreDbSchema from '../db/schema/core';
import type {
  PaginationQuery,
  SortQuery,
  ADMINISTRATION_SORT_FIELDS,
  AdministrationStatus,
} from '@roar-dashboard/api-contract';
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
 */
export class AdministrationRepository extends BaseRepository<Administration, typeof administrations> {
  constructor(db: NodePgDatabase<typeof CoreDbSchema> = CoreDbClient) {
    super(db, administrations);
  }

  /**
   * Build a SQL condition to filter administrations by status.
   *
   * @param status - The status filter (active, past, upcoming)
   * @returns SQL condition or undefined if no filter
   */
  buildStatusFilter(status?: AdministrationStatus): SQL | undefined {
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
   * Build a UNION query of all administration IDs the user can access.
   *
   * This respects the org hierarchy with two access patterns:
   *
   * "Look UP" paths (all roles) - see administrations on own entity + parent entities:
   * - Path 1: Direct org membership (user in district/school directly assigned)
   * - Path 2: User in school, admin assigned to parent district
   * - Path 3: User in class, admin assigned to district (via class.districtId)
   * - Path 4: User in class, admin assigned to school (via class.schoolId)
   * - Path 5: Direct class membership
   * - Path 6: Direct group membership
   *
   * "Look DOWN" paths (supervisory roles only) - see administrations on child entities:
   * - Path 7: User in district, admin assigned to child school
   * - Path 8: User in district, admin assigned to class under district
   * - Path 9: User in school, admin assigned to class under school
   * - Path 10: User in group, admin assigned to child group
   */
  private buildAccessibleAdministrationsUnion(userId: string, allowedRoles: UserRole[]) {
    // Path 1: Direct org membership
    const viaDirectOrg = this.db
      .select({ administrationId: administrationOrgs.administrationId })
      .from(administrationOrgs)
      .innerJoin(userOrgs, eq(userOrgs.orgId, administrationOrgs.orgId))
      .where(and(eq(userOrgs.userId, userId), inArray(userOrgs.role, allowedRoles)));

    // Path 2: User in school, admin assigned to parent district
    const viaSchoolUnderDistrict = this.db
      .select({ administrationId: administrationOrgs.administrationId })
      .from(administrationOrgs)
      .innerJoin(orgs, eq(orgs.parentOrgId, administrationOrgs.orgId))
      .innerJoin(userOrgs, eq(userOrgs.orgId, orgs.id))
      .where(and(eq(userOrgs.userId, userId), inArray(userOrgs.role, allowedRoles)));

    // Path 3: User in class, admin assigned to district
    const viaClassUnderDistrict = this.db
      .select({ administrationId: administrationOrgs.administrationId })
      .from(administrationOrgs)
      .innerJoin(classes, eq(classes.districtId, administrationOrgs.orgId))
      .innerJoin(userClasses, eq(userClasses.classId, classes.id))
      .where(and(eq(userClasses.userId, userId), inArray(userClasses.role, allowedRoles)));

    // Path 4: User in class, admin assigned to school
    const viaClassUnderSchool = this.db
      .select({ administrationId: administrationOrgs.administrationId })
      .from(administrationOrgs)
      .innerJoin(classes, eq(classes.schoolId, administrationOrgs.orgId))
      .innerJoin(userClasses, eq(userClasses.classId, classes.id))
      .where(and(eq(userClasses.userId, userId), inArray(userClasses.role, allowedRoles)));

    // Path 5: Direct class membership
    const viaDirectClass = this.db
      .select({ administrationId: administrationClasses.administrationId })
      .from(administrationClasses)
      .innerJoin(userClasses, eq(userClasses.classId, administrationClasses.classId))
      .where(and(eq(userClasses.userId, userId), inArray(userClasses.role, allowedRoles)));

    // Path 6: Direct group membership
    const viaDirectGroup = this.db
      .select({ administrationId: administrationGroups.administrationId })
      .from(administrationGroups)
      .innerJoin(userGroups, eq(userGroups.groupId, administrationGroups.groupId))
      .where(and(eq(userGroups.userId, userId), inArray(userGroups.role, allowedRoles)));

    // Build base union (paths 1-6, all roles)
    let union = viaDirectOrg
      .union(viaSchoolUnderDistrict)
      .union(viaClassUnderDistrict)
      .union(viaClassUnderSchool)
      .union(viaDirectClass)
      .union(viaDirectGroup);

    // "Look DOWN" paths for supervisory roles only
    // Compute which allowed roles are also supervisory roles
    const supervisoryAllowedRoles = allowedRoles.filter((role) => SUPERVISORY_ROLES.includes(role));

    if (supervisoryAllowedRoles.length > 0) {
      // Path 7: User in district (org), admin assigned to child school
      const viaDistrictToChildSchool = this.db
        .select({ administrationId: administrationOrgs.administrationId })
        .from(administrationOrgs)
        .innerJoin(orgs, eq(orgs.id, administrationOrgs.orgId))
        .innerJoin(userOrgs, eq(userOrgs.orgId, orgs.parentOrgId))
        .where(and(eq(userOrgs.userId, userId), inArray(userOrgs.role, supervisoryAllowedRoles)));

      // Path 8: User in district (org), admin assigned to class under that district
      const viaDistrictToClass = this.db
        .select({ administrationId: administrationClasses.administrationId })
        .from(administrationClasses)
        .innerJoin(classes, eq(classes.id, administrationClasses.classId))
        .innerJoin(userOrgs, eq(userOrgs.orgId, classes.districtId))
        .where(and(eq(userOrgs.userId, userId), inArray(userOrgs.role, supervisoryAllowedRoles)));

      // Path 9: User in school (org), admin assigned to class under that school
      const viaSchoolToClass = this.db
        .select({ administrationId: administrationClasses.administrationId })
        .from(administrationClasses)
        .innerJoin(classes, eq(classes.id, administrationClasses.classId))
        .innerJoin(userOrgs, eq(userOrgs.orgId, classes.schoolId))
        .where(and(eq(userOrgs.userId, userId), inArray(userOrgs.role, supervisoryAllowedRoles)));

      // Path 10: User in group, admin assigned to child group
      const viaGroupToChildGroup = this.db
        .select({ administrationId: administrationGroups.administrationId })
        .from(administrationGroups)
        .innerJoin(groups, eq(groups.id, administrationGroups.groupId))
        .innerJoin(userGroups, eq(userGroups.groupId, groups.parentGroupId))
        .where(and(eq(userGroups.userId, userId), inArray(userGroups.role, supervisoryAllowedRoles)));

      union = union
        .union(viaDistrictToChildSchool)
        .union(viaDistrictToClass)
        .union(viaSchoolToClass)
        .union(viaGroupToChildGroup);
    }

    return union;
  }

  /**
   * List administrations the user is authorized to access.
   *
   * Authorization respects the org hierarchy:
   * - Administration assigned to a district → applies to all schools and classes in that district
   * - Administration assigned to a school → applies to all classes in that school
   * - User must have an allowed role in the org, class, or group
   *
   * @param authorization - User ID and allowed roles
   * @param options - Pagination, sorting, and optional status filter
   */
  async listAuthorized(
    authorization: AuthorizationFilter,
    options: ListAuthorizedOptions,
  ): Promise<PaginatedResult<Administration>> {
    const { userId, allowedRoles } = authorization;

    if (allowedRoles.length === 0) {
      return { items: [], totalItems: 0 };
    }

    const { page = 1, perPage = 10, orderBy, status } = options;
    const offset = (page - 1) * perPage;

    // Build the UNION query for accessible administration IDs
    const accessibleAdmins = this.buildAccessibleAdministrationsUnion(userId, allowedRoles).as('accessible_admins');

    // Build status filter if provided
    const statusFilter = this.buildStatusFilter(status);

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
}
