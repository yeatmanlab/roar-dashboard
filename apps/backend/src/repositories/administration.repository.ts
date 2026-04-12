import { and, eq, asc, desc, lte, gte, lt, gt, sql, count, inArray } from 'drizzle-orm';
import type { SQL, Column } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  administrations,
  administrationOrgs,
  administrationClasses,
  administrationGroups,
  administrationTaskVariants,
  administrationAgreements,
  agreements,
  agreementVersions,
  taskVariants,
  tasks,
  orgs,
  classes,
  groups,
  type Administration,
  type AdministrationTaskVariant,
  type Org,
  type Class,
  type Group,
  type Task,
  type TaskVariant,
  type Agreement,
  type AgreementVersion,
} from '../db/schema';
import { CoreDbClient } from '../db/clients';
import type * as CoreDbSchema from '../db/schema/core';
import type {
  PaginationQuery,
  SortQuery,
  AdministrationSortFieldType,
  AdministrationDistrictSortFieldType,
  AdministrationSchoolSortFieldType,
  AdministrationClassSortFieldType,
  AdministrationGroupSortFieldType,
  AdministrationTaskVariantSortFieldType,
  AdministrationAgreementSortFieldType,
  AdministrationStatus,
  TreeNodeEntityType,
  TreeParentEntityType,
} from '@roar-dashboard/api-contract';
import { SortOrder } from '@roar-dashboard/api-contract';
import type { PaginatedResult } from './base.repository';
import { BaseRepository } from './base.repository';
import type { BaseGetAllParams, BasePaginatedQueryParams } from './interfaces/base.repository.interface';
import { AdministrationAccessControls } from './access-controls/administration.access-controls';
import type { AccessControlFilter } from './utils/parse-access-control-filter.utils';
import { OrgType } from '../enums/org-type.enum';
import { TaskVariantStatus } from '../enums/task-variant-status.enum';

/**
 * Explicit mapping from API sort field names to org table columns.
 * Districts and schools share the same sort fields.
 */
const ORG_SORT_COLUMNS: Record<AdministrationDistrictSortFieldType | AdministrationSchoolSortFieldType, Column> = {
  name: orgs.name,
};

/**
 * Explicit mapping from API sort field names to class table columns.
 */
const CLASS_SORT_COLUMNS: Record<AdministrationClassSortFieldType, Column> = {
  name: classes.name,
};

/**
 * Explicit mapping from API sort field names to group table columns.
 */
const GROUP_SORT_COLUMNS: Record<AdministrationGroupSortFieldType, Column> = {
  name: groups.name,
};

/**
 * Explicit mapping from API sort field names to task variant columns.
 */
const TASK_VARIANT_SORT_COLUMNS: Record<AdministrationTaskVariantSortFieldType, Column> = {
  orderIndex: administrationTaskVariants.orderIndex,
  name: taskVariants.name,
};

/**
 * Explicit mapping from API sort field names to agreement table columns.
 */
const AGREEMENT_SORT_COLUMNS: Record<AdministrationAgreementSortFieldType, Column> = {
  name: agreements.name,
  agreementType: agreements.agreementType,
  createdAt: agreements.createdAt,
};

/**
 * Query options for administration repository methods (API contract format).
 */
export type AdministrationQueryOptions = PaginationQuery & SortQuery<AdministrationSortFieldType>;

/**
 * Options for listing administrations with optional status filter.
 */
export interface ListAuthorizedOptions extends BaseGetAllParams {
  status?: AdministrationStatus;
}

/**
 * Options for listing orgs (districts/schools) of an administration.
 */
export type ListOrgsByAdministrationOptions = BasePaginatedQueryParams;

/**
 * Options for listing classes of an administration.
 */
export type ListClassesByAdministrationOptions = BasePaginatedQueryParams;

/**
 * Options for listing groups of an administration.
 */
export type ListGroupsByAdministrationOptions = BasePaginatedQueryParams;

/**
 * Options for listing task variants of an administration.
 */
export type ListTaskVariantsByAdministrationOptions = BasePaginatedQueryParams;

/**
 * A raw tree node returned by repository tree queries.
 * The service layer may enrich these with stats and apply FGA filtering.
 */
export interface TreeNode {
  id: string;
  name: string;
  entityType: TreeNodeEntityType;
  hasChildren: boolean;
}

/**
 * Options for listing tree nodes at a given level.
 */
export interface ListTreeNodesOptions {
  page: number;
  perPage: number;
}

/**
 * Options for listing agreements of an administration.
 */
export interface ListAgreementsByAdministrationOptions extends BasePaginatedQueryParams {
  locale: string;
}

/**
 * Raw joined result from getTaskVariantsByAdministrationId.
 * Contains the full data from all three joined tables.
 * Controller layer transforms this to the API response format.
 */
export interface TaskVariantWithAssignment {
  variant: TaskVariant;
  task: Task;
  assignment: AdministrationTaskVariant;
}

/**
 * Extended assignment type that includes the optional flag.
 * Used for supervised roles (students) where conditions are pre-evaluated server-side.
 *
 * NOTE: Database columns conditionsAssignment/conditionsRequirements map to
 * API fields assigned_if/optional_if respectively.
 */
export interface AssignmentWithOptional
  extends Omit<AdministrationTaskVariant, 'conditionsAssignment' | 'conditionsRequirements'> {
  conditionsAssignment: null;
  conditionsRequirements: null;
  optional: boolean;
}

/**
 * Raw joined result from getAgreementsByAdministrationId.
 * Contains the agreement with its current version for the requested locale.
 */
export interface AgreementWithVersion {
  agreement: Agreement;
  currentVersion: AgreementVersion | null;
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
   * Internal method used by listAll and getByIds.
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
   * @param filterIds - Optional array of org IDs to constrain results (FGA-resolved accessible IDs)
   * @returns Paginated result with orgs
   */
  private async getOrgsByAdministrationId(
    administrationId: string,
    orgType: OrgType,
    options: ListOrgsByAdministrationOptions,
    filterIds?: string[],
  ): Promise<PaginatedResult<Org>> {
    const { page, perPage, orderBy } = options;
    const offset = (page - 1) * perPage;

    const conditions: SQL[] = [eq(administrationOrgs.administrationId, administrationId), eq(orgs.orgType, orgType)];
    if (filterIds?.length) {
      conditions.push(inArray(orgs.id, filterIds));
    }
    const baseCondition = and(...conditions);

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
   * Get districts assigned to an administration.
   *
   * @param administrationId - The administration ID to get districts for
   * @param options - Pagination and sorting options
   * @param filterIds - Optional array of district IDs to constrain results (FGA-resolved accessible IDs)
   * @returns Paginated result with districts
   */
  async getDistrictsByAdministrationId(
    administrationId: string,
    options: ListOrgsByAdministrationOptions,
    filterIds?: string[],
  ): Promise<PaginatedResult<Org>> {
    return this.getOrgsByAdministrationId(administrationId, OrgType.DISTRICT, options, filterIds);
  }

  /**
   * Get schools assigned to an administration.
   *
   * @param administrationId - The administration ID to get schools for
   * @param options - Pagination and sorting options
   * @param filterIds - Optional array of school IDs to constrain results (FGA-resolved accessible IDs)
   * @returns Paginated result with schools
   */
  async getSchoolsByAdministrationId(
    administrationId: string,
    options: ListOrgsByAdministrationOptions,
    filterIds?: string[],
  ): Promise<PaginatedResult<Org>> {
    return this.getOrgsByAdministrationId(administrationId, OrgType.SCHOOL, options, filterIds);
  }

  /**
   * Get classes assigned to an administration.
   *
   * @param administrationId - The administration ID to get classes for
   * @param options - Pagination and sorting options
   * @param filterIds - Optional array of class IDs to constrain results (FGA-resolved accessible IDs)
   * @returns Paginated result with classes
   */
  async getClassesByAdministrationId(
    administrationId: string,
    options: ListClassesByAdministrationOptions,
    filterIds?: string[],
  ): Promise<PaginatedResult<Class>> {
    const { page, perPage, orderBy } = options;
    const offset = (page - 1) * perPage;

    const conditions: SQL[] = [eq(administrationClasses.administrationId, administrationId)];
    if (filterIds && filterIds.length > 0) {
      conditions.push(inArray(classes.id, filterIds));
    }
    const baseCondition = and(...conditions);

    const countResult = await this.db
      .select({ count: count() })
      .from(administrationClasses)
      .innerJoin(classes, eq(classes.id, administrationClasses.classId))
      .where(baseCondition);

    const totalItems = countResult[0]?.count ?? 0;

    if (totalItems === 0) {
      return { items: [], totalItems: 0 };
    }

    // Use explicit column mapping for type safety
    // Cast is safe because API contract validates the sort field before reaching repository
    const sortField = orderBy?.field as AdministrationClassSortFieldType | undefined;
    const sortColumn = sortField ? CLASS_SORT_COLUMNS[sortField] : classes.name;
    const primaryOrder = orderBy?.direction === SortOrder.DESC ? desc(sortColumn) : asc(sortColumn);

    const dataResult = await this.db
      .select({ class: classes })
      .from(administrationClasses)
      .innerJoin(classes, eq(classes.id, administrationClasses.classId))
      .where(baseCondition)
      // Add a stable secondary sort on classes.id to ensure deterministic pagination
      .orderBy(primaryOrder, asc(classes.id))
      .limit(perPage)
      .offset(offset);

    return {
      items: dataResult.map((row) => row.class),
      totalItems,
    };
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

  /**
   * Get groups assigned to an administration.
   *
   * @param administrationId - The administration ID to get groups for
   * @param options - Pagination and sorting options
   * @param filterIds - Optional array of group IDs to constrain results (FGA-resolved accessible IDs)
   * @returns Paginated result with groups
   */
  async getGroupsByAdministrationId(
    administrationId: string,
    options: ListGroupsByAdministrationOptions,
    filterIds?: string[],
  ): Promise<PaginatedResult<Group>> {
    const { page, perPage, orderBy } = options;
    const offset = (page - 1) * perPage;

    const conditions: SQL[] = [eq(administrationGroups.administrationId, administrationId)];
    if (filterIds && filterIds.length > 0) {
      conditions.push(inArray(groups.id, filterIds));
    }
    const baseCondition = and(...conditions);

    const countResult = await this.db
      .select({ count: count() })
      .from(administrationGroups)
      .innerJoin(groups, eq(groups.id, administrationGroups.groupId))
      .where(baseCondition);

    const totalItems = countResult[0]?.count ?? 0;

    if (totalItems === 0) {
      return { items: [], totalItems: 0 };
    }

    // Use explicit column mapping for type safety
    // Cast is safe because API contract validates the sort field before reaching repository
    const sortField = orderBy?.field as AdministrationGroupSortFieldType | undefined;
    const sortColumn = sortField ? GROUP_SORT_COLUMNS[sortField] : groups.name;
    const primaryOrder = orderBy?.direction === SortOrder.DESC ? desc(sortColumn) : asc(sortColumn);

    const dataResult = await this.db
      .select({ group: groups })
      .from(administrationGroups)
      .innerJoin(groups, eq(groups.id, administrationGroups.groupId))
      .where(baseCondition)
      // Add a stable secondary sort on groups.id to ensure deterministic pagination
      .orderBy(primaryOrder, asc(groups.id))
      .limit(perPage)
      .offset(offset);

    return {
      items: dataResult.map((row) => row.group),
      totalItems,
    };
  }

  /**
   * Get task variants assigned to an administration.
   *
   * Returns task variants with their associated task information (task ID, task name).
   * Default sort is by orderIndex (ascending) to preserve the intended assessment sequence
   * for ordered administrations.
   *
   * Note: Unlike districts/schools/classes/groups, this method has no "authorized" variant
   * because task variants are administration-level resources. Authorization is handled
   * at the service layer by verifying access to the parent administration.
   *
   * @param administrationId - The administration ID to get task variants for
   * @param publishedOnly - If true, only return published variants (for supervised roles)
   * @param options - Pagination and sorting options
   * @returns Paginated result with task variant items including orderIndex
   */
  async getTaskVariantsByAdministrationId(
    administrationId: string,
    publishedOnly: boolean,
    options: ListTaskVariantsByAdministrationOptions,
  ): Promise<PaginatedResult<TaskVariantWithAssignment>> {
    const { page, perPage, orderBy } = options;
    const offset = (page - 1) * perPage;

    // Build base condition - optionally filter to published variants only
    const baseCondition = publishedOnly
      ? and(
          eq(administrationTaskVariants.administrationId, administrationId),
          eq(taskVariants.status, TaskVariantStatus.PUBLISHED),
        )
      : eq(administrationTaskVariants.administrationId, administrationId);

    const countResult = await this.db
      .select({ count: count() })
      .from(administrationTaskVariants)
      .innerJoin(taskVariants, eq(taskVariants.id, administrationTaskVariants.taskVariantId))
      .innerJoin(tasks, eq(tasks.id, taskVariants.taskId))
      .where(baseCondition);

    const totalItems = countResult[0]?.count ?? 0;

    if (totalItems === 0) {
      return { items: [], totalItems: 0 };
    }

    // Use explicit column mapping for type safety
    // Cast is safe because API contract validates the sort field before reaching repository
    const sortField = orderBy?.field as AdministrationTaskVariantSortFieldType | undefined;
    const sortColumn = sortField ? TASK_VARIANT_SORT_COLUMNS[sortField] : administrationTaskVariants.orderIndex;
    const primaryOrder = orderBy?.direction === SortOrder.DESC ? desc(sortColumn) : asc(sortColumn);

    const items = await this.db
      .select({
        variant: taskVariants,
        task: tasks,
        assignment: administrationTaskVariants,
      })
      .from(administrationTaskVariants)
      .innerJoin(taskVariants, eq(taskVariants.id, administrationTaskVariants.taskVariantId))
      .innerJoin(tasks, eq(tasks.id, taskVariants.taskId))
      .where(baseCondition)
      // Secondary sort on taskVariants.id ensures deterministic ordering when primary sort
      // has ties (e.g., multiple variants with same orderIndex or same name). Without this,
      // PostgreSQL may return rows in arbitrary order, causing pagination inconsistencies.
      .orderBy(primaryOrder, asc(taskVariants.id))
      .limit(perPage)
      .offset(offset);

    return { items, totalItems };
  }

  /**
   * Get agreements assigned to an administration.
   *
   * Returns agreements with their current version for the requested locale.
   * If no current version exists for the requested locale, currentVersion will be null.
   *
   * Note: This method has no "authorized" variant because agreements are required
   * for all users in an administration (students need to know what to sign).
   * Authorization is handled at the service layer by verifying access to the parent administration.
   *
   * @param administrationId - The administration ID to get agreements for
   * @param options - Pagination, sorting, filtering, and locale options
   * @returns Paginated result with agreements and their current versions
   */
  async getAgreementsByAdministrationId(
    administrationId: string,
    options: ListAgreementsByAdministrationOptions,
  ): Promise<PaginatedResult<AgreementWithVersion>> {
    const { page, perPage, orderBy, locale } = options;
    const offset = (page - 1) * perPage;

    const whereCondition = eq(administrationAgreements.administrationId, administrationId);

    // Count query - counts distinct agreements (not versions)
    const countResult = await this.db
      .select({ count: count() })
      .from(administrationAgreements)
      .innerJoin(agreements, eq(agreements.id, administrationAgreements.agreementId))
      .where(whereCondition);

    const totalItems = countResult[0]?.count ?? 0;

    if (totalItems === 0) {
      return { items: [], totalItems: 0 };
    }

    // Use explicit column mapping for type safety
    // Cast is safe because API contract validates the sort field before reaching repository
    const sortField = orderBy?.field as AdministrationAgreementSortFieldType | undefined;
    const sortColumn = (sortField && AGREEMENT_SORT_COLUMNS[sortField]) || agreements.name;
    const primaryOrder = orderBy?.direction === SortOrder.DESC ? desc(sortColumn) : asc(sortColumn);

    // Data query - left join with agreement versions to get current version for locale
    // Left join ensures we return agreements even if no version exists for the locale
    const dataResult = await this.db
      .select({
        agreement: agreements,
        currentVersion: agreementVersions,
      })
      .from(administrationAgreements)
      .innerJoin(agreements, eq(agreements.id, administrationAgreements.agreementId))
      .leftJoin(
        agreementVersions,
        and(
          eq(agreementVersions.agreementId, agreements.id),
          eq(agreementVersions.isCurrent, true),
          eq(agreementVersions.locale, locale),
        ),
      )
      .where(whereCondition)
      .orderBy(primaryOrder, asc(agreements.id))
      .limit(perPage)
      .offset(offset);

    return {
      items: dataResult.map((row) => ({
        agreement: row.agreement,
        currentVersion: row.currentVersion,
      })),
      totalItems,
    };
  }

  // ---------------------------------------------------------------------------
  // Tree endpoint methods
  // ---------------------------------------------------------------------------

  /**
   * Get root-level tree nodes for an administration.
   *
   * Returns all entities directly assigned to the administration: districts,
   * schools, classes, and groups. Any entity type can be a direct assignee.
   *
   * hasChildren logic:
   * - Districts: true if any assigned schools or classes exist under them
   * - Schools: true if any assigned classes exist under them
   * - Classes: always false (leaf nodes)
   * - Groups: always false (leaf nodes)
   *
   * @param administrationId - The administration ID
   * @param options - Pagination options
   * @param accessibleIds - Optional set of entity IDs the user can access (FGA scoping).
   *   When provided, only entities in this set are returned.
   * @returns Paginated tree nodes
   */
  async getRootTreeNodes(
    administrationId: string,
    options: ListTreeNodesOptions,
    accessibleIds?: {
      districtIds?: string[];
      schoolIds?: string[];
      classIds?: string[];
      groupIds?: string[];
    },
  ): Promise<PaginatedResult<TreeNode>> {
    const { page, perPage } = options;
    const offset = (page - 1) * perPage;

    // Build FGA filters for each entity type
    const buildFgaFilter = (
      ids: string[] | undefined,
      column: typeof orgs.id | typeof classes.id | typeof groups.id,
    ) => {
      if (ids && ids.length > 0) {
        return sql`AND ${column} IN (${sql.join(
          ids.map((id) => sql`${id}`),
          sql`, `,
        )})`;
      }
      if (ids) return sql`AND FALSE`; // empty accessible list means no access
      return sql``; // undefined = no filter (super admin)
    };

    const districtFgaFilter = buildFgaFilter(accessibleIds?.districtIds, orgs.id);
    const schoolFgaFilter = buildFgaFilter(accessibleIds?.schoolIds, orgs.id);
    const classFgaFilter = buildFgaFilter(accessibleIds?.classIds, classes.id);
    const groupFgaFilter = buildFgaFilter(accessibleIds?.groupIds, groups.id);

    // UNION ALL of all 4 entity types directly assigned to the administration
    const query = sql`
      WITH root_nodes AS (
        -- Districts directly assigned
        SELECT
          ${orgs.id} AS id,
          ${orgs.name} AS name,
          'district' AS entity_type,
          EXISTS (
            SELECT 1 FROM ${orgs} o
              WHERE o.parent_org_id = ${orgs.id}
                AND o.org_type = ${OrgType.SCHOOL}
          ) AS has_children
        FROM ${administrationOrgs}
        INNER JOIN ${orgs} ON ${orgs.id} = ${administrationOrgs.orgId}
        WHERE ${administrationOrgs.administrationId} = ${administrationId}
          AND ${orgs.orgType} = ${OrgType.DISTRICT}
          ${districtFgaFilter}

        UNION ALL

        -- Schools directly assigned
        SELECT
          ${orgs.id} AS id,
          ${orgs.name} AS name,
          'school' AS entity_type,
          EXISTS (
            SELECT 1 FROM ${classes} c
              WHERE c.school_id = ${orgs.id}
          ) AS has_children
        FROM ${administrationOrgs}
        INNER JOIN ${orgs} ON ${orgs.id} = ${administrationOrgs.orgId}
        WHERE ${administrationOrgs.administrationId} = ${administrationId}
          AND ${orgs.orgType} = ${OrgType.SCHOOL}
          ${schoolFgaFilter}

        UNION ALL

        -- Classes directly assigned
        SELECT
          ${classes.id} AS id,
          ${classes.name} AS name,
          'class' AS entity_type,
          FALSE AS has_children
        FROM ${administrationClasses}
        INNER JOIN ${classes} ON ${classes.id} = ${administrationClasses.classId}
        WHERE ${administrationClasses.administrationId} = ${administrationId}
          ${classFgaFilter}

        UNION ALL

        -- Groups directly assigned
        SELECT
          ${groups.id} AS id,
          ${groups.name} AS name,
          'group' AS entity_type,
          FALSE AS has_children
        FROM ${administrationGroups}
        INNER JOIN ${groups} ON ${groups.id} = ${administrationGroups.groupId}
        WHERE ${administrationGroups.administrationId} = ${administrationId}
          ${groupFgaFilter}
      )
      SELECT id, name, entity_type, has_children,
             COUNT(*) OVER() AS total_count
      FROM root_nodes
      ORDER BY name ASC, id ASC
      LIMIT ${perPage} OFFSET ${offset}
    `;

    const result = await this.db.execute(query);

    const rows = result.rows as Array<{
      id: string;
      name: string;
      entity_type: string;
      has_children: boolean;
      total_count: string;
    }>;

    const totalItems = rows.length > 0 ? parseInt(rows[0]!.total_count, 10) : 0;

    const items: TreeNode[] = rows.map((row) => ({
      id: row.id,
      name: row.name,
      entityType: row.entity_type as TreeNodeEntityType,
      hasChildren: row.has_children,
    }));

    return { items, totalItems };
  }

  /**
   * Get child schools of a district that is assigned to an administration.
   *
   * Returns all schools that are children of the given district. Because the
   * parent district is assigned to the administration, its child schools are
   * implicitly part of the administration — no junction table check needed.
   *
   * @param _administrationId - The administration ID (unused, kept for signature consistency)
   * @param districtId - The parent district ID
   * @param options - Pagination options
   * @param accessibleSchoolIds - Optional set of school IDs the user can access (FGA scoping)
   * @returns Paginated tree nodes
   */
  async getDistrictChildTreeNodes(
    _administrationId: string,
    districtId: string,
    options: ListTreeNodesOptions,
    accessibleSchoolIds?: string[],
  ): Promise<PaginatedResult<TreeNode>> {
    const { page, perPage } = options;
    const offset = (page - 1) * perPage;

    const schoolFgaFilter =
      accessibleSchoolIds && accessibleSchoolIds.length > 0
        ? sql`AND ${orgs.id} IN (${sql.join(
            accessibleSchoolIds.map((id) => sql`${id}`),
            sql`, `,
          )})`
        : accessibleSchoolIds
          ? sql`AND FALSE`
          : sql``;

    const query = sql`
      WITH school_nodes AS (
        SELECT
          ${orgs.id} AS id,
          ${orgs.name} AS name,
          'school' AS entity_type,
          EXISTS (
            SELECT 1 FROM ${classes} c
              WHERE c.school_id = ${orgs.id}
          ) AS has_children
        FROM ${orgs}
        WHERE ${orgs.parentOrgId} = ${districtId}
          AND ${orgs.orgType} = ${OrgType.SCHOOL}
          ${schoolFgaFilter}
      )
      SELECT id, name, entity_type, has_children,
             COUNT(*) OVER() AS total_count
      FROM school_nodes
      ORDER BY name ASC, id ASC
      LIMIT ${perPage} OFFSET ${offset}
    `;

    const result = await this.db.execute(query);

    const rows = result.rows as Array<{
      id: string;
      name: string;
      entity_type: string;
      has_children: boolean;
      total_count: string;
    }>;

    const totalItems = rows.length > 0 ? parseInt(rows[0]!.total_count, 10) : 0;

    const items: TreeNode[] = rows.map((row) => ({
      id: row.id,
      name: row.name,
      entityType: row.entity_type as TreeNodeEntityType,
      hasChildren: row.has_children,
    }));

    return { items, totalItems };
  }

  /**
   * Get child classes of a school that is assigned to an administration.
   *
   * Returns all classes that belong to the given school. Because the parent
   * school (or its ancestor district) is assigned to the administration, child
   * classes are implicitly part of the administration — no junction table check needed.
   *
   * @param _administrationId - The administration ID (unused, kept for signature consistency)
   * @param schoolId - The parent school ID
   * @param options - Pagination options
   * @param accessibleClassIds - Optional set of class IDs the user can access (FGA scoping)
   * @returns Paginated tree nodes (classes are always leaf nodes)
   */
  async getSchoolChildTreeNodes(
    _administrationId: string,
    schoolId: string,
    options: ListTreeNodesOptions,
    accessibleClassIds?: string[],
  ): Promise<PaginatedResult<TreeNode>> {
    const { page, perPage } = options;
    const offset = (page - 1) * perPage;

    const classFgaFilter =
      accessibleClassIds && accessibleClassIds.length > 0
        ? sql`AND ${classes.id} IN (${sql.join(
            accessibleClassIds.map((id) => sql`${id}`),
            sql`, `,
          )})`
        : accessibleClassIds
          ? sql`AND FALSE`
          : sql``;

    const query = sql`
      WITH class_nodes AS (
        SELECT
          ${classes.id} AS id,
          ${classes.name} AS name,
          'class' AS entity_type,
          FALSE AS has_children
        FROM ${classes}
        WHERE ${classes.schoolId} = ${schoolId}
          ${classFgaFilter}
      )
      SELECT id, name, entity_type, has_children,
             COUNT(*) OVER() AS total_count
      FROM class_nodes
      ORDER BY name ASC, id ASC
      LIMIT ${perPage} OFFSET ${offset}
    `;

    const result = await this.db.execute(query);

    const rows = result.rows as Array<{
      id: string;
      name: string;
      entity_type: string;
      has_children: boolean;
      total_count: string;
    }>;

    const totalItems = rows.length > 0 ? parseInt(rows[0]!.total_count, 10) : 0;

    const items: TreeNode[] = rows.map((row) => ({
      id: row.id,
      name: row.name,
      entityType: row.entity_type as TreeNodeEntityType,
      hasChildren: row.has_children,
    }));

    return { items, totalItems };
  }

  /**
   * Dispatch a tree query based on the parent entity type.
   *
   * - No parent: root-level nodes (all directly assigned entities)
   * - district: all child schools of the district
   * - school: all child classes of the school
   * - class/group: empty result (leaf nodes)
   *
   * @param administrationId - The administration ID
   * @param parentEntityType - The parent entity type (undefined for root level)
   * @param parentEntityId - The parent entity ID (required when parentEntityType is set)
   * @param options - Pagination options
   * @param accessibleIds - Optional FGA-scoped entity IDs by type
   * @returns Paginated tree nodes
   */
  async getTreeNodes(
    administrationId: string,
    parentEntityType: TreeParentEntityType | undefined,
    parentEntityId: string | undefined,
    options: ListTreeNodesOptions,
    accessibleIds?: {
      districtIds?: string[];
      schoolIds?: string[];
      classIds?: string[];
      groupIds?: string[];
    },
  ): Promise<PaginatedResult<TreeNode>> {
    // Root level: all directly assigned entities
    if (!parentEntityType) {
      const rootFilter: {
        districtIds?: string[];
        schoolIds?: string[];
        classIds?: string[];
        groupIds?: string[];
      } = {};
      if (accessibleIds?.districtIds) rootFilter.districtIds = accessibleIds.districtIds;
      if (accessibleIds?.schoolIds) rootFilter.schoolIds = accessibleIds.schoolIds;
      if (accessibleIds?.classIds) rootFilter.classIds = accessibleIds.classIds;
      if (accessibleIds?.groupIds) rootFilter.groupIds = accessibleIds.groupIds;
      return this.getRootTreeNodes(administrationId, options, rootFilter);
    }

    // Leaf nodes: class and group have no children
    if (parentEntityType === 'class' || parentEntityType === 'group') {
      return { items: [], totalItems: 0 };
    }

    // District → schools
    if (parentEntityType === 'district' && parentEntityId) {
      return this.getDistrictChildTreeNodes(administrationId, parentEntityId, options, accessibleIds?.schoolIds);
    }

    // School → classes
    if (parentEntityType === 'school' && parentEntityId) {
      return this.getSchoolChildTreeNodes(administrationId, parentEntityId, options, accessibleIds?.classIds);
    }

    // Shouldn't reach here if query validation is correct
    return { items: [], totalItems: 0 };
  }
}
