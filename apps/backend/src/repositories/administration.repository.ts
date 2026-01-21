import { and, eq, inArray, countDistinct, asc, desc } from 'drizzle-orm';
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
   * Build a UNION query of all administration IDs the user can access.
   *
   * This respects the org hierarchy:
   * - Path 1: Direct org membership (user in district/school directly assigned)
   * - Path 2: User in school, admin assigned to parent district
   * - Path 3: User in class, admin assigned to district (via class.districtId)
   * - Path 4: User in class, admin assigned to school (via class.schoolId)
   * - Path 5: Direct class membership
   * - Path 6: Direct group membership
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

    return viaDirectOrg
      .union(viaSchoolUnderDistrict)
      .union(viaClassUnderDistrict)
      .union(viaClassUnderSchool)
      .union(viaDirectClass)
      .union(viaDirectGroup);
  }

  /**
   * List administrations the user is authorized to access.
   *
   * Authorization respects the org hierarchy:
   * - Administration assigned to a district → applies to all schools and classes in that district
   * - Administration assigned to a school → applies to all classes in that school
   * - User must have an allowed role in the org, class, or group
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

    // Build the UNION query for accessible administration IDs
    const accessibleAdmins = this.buildAccessibleAdministrationsUnion(userId, allowedRoles).as('accessible_admins');

    // Count query
    const countResult = await this.db
      .select({ count: countDistinct(accessibleAdmins.administrationId) })
      .from(accessibleAdmins);

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

    // Data query: join administrations with the accessible IDs subquery
    const dataResult = await this.db
      .selectDistinct({ administration: administrations })
      .from(administrations)
      .innerJoin(accessibleAdmins, eq(administrations.id, accessibleAdmins.administrationId))
      .orderBy(sortDirection)
      .limit(perPage)
      .offset(offset);

    return {
      items: dataResult.map((row) => row.administration),
      totalItems,
    };
  }
}
