import { and, eq, asc, desc, lte, gte, lt, gt, sql, count, countDistinct, inArray } from 'drizzle-orm';
import type { SQL, Column, InferInsertModel } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { PgColumn } from 'drizzle-orm/pg-core';
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
  userOrgs,
  userClasses,
  userGroups,
  type Administration,
  type AdministrationTaskVariant,
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
  AdministrationTaskVariantSortFieldType,
  AdministrationAgreementSortFieldType,
  AdministrationStatus,
  TreeParentEntityType,
} from '@roar-dashboard/api-contract';
import { SortOrder, TreeNodeEntityType } from '@roar-dashboard/api-contract';
import type { PaginatedResult } from './base.repository';
import { BaseRepository } from './base.repository';
import type { BaseGetAllParams, BasePaginatedQueryParams } from './interfaces/base.repository.interface';
import { isAncestorOrEqual } from './utils/is-ancestor-or-equal.utils';
import { isEnrollmentActive } from './utils/enrollment.utils';
import { OrgType } from '../enums/org-type.enum';
import { TaskVariantStatus } from '../enums/task-variant-status.enum';

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

/** Represents an assignee of an administration with identifiers. */
interface AdministrationAssignee {
  id: string;
  name: string;
}

/** Represents a school assignee of an administration with a parent organization ID. */
interface AdministrationSchoolAssignee extends AdministrationAssignee {
  parentOrgId: string;
}

/** Represents a class assignee of an administration with a school and district ID. */
interface AdministrationClassAssignee extends AdministrationAssignee {
  schoolId: string;
  districtId: string;
}

/**
 * Assignees of an administration (districts, schools, classes, groups).
 */
export interface AdministrationAssignees {
  districts: AdministrationAssignee[];
  schools: AdministrationSchoolAssignee[];
  classes: AdministrationClassAssignee[];
  groups: AdministrationAssignee[];
}

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

/** Raw tree node row with total count included for pagination. */
type TreeNodeRowWithCounts = {
  id: string;
  name: string;
  entity_type: TreeNodeEntityType;
  has_children: boolean;
  total_count: string;
};

/** Accessible IDs for FGA scoping in tree queries. */
export type AccessibleIds = {
  districtIds?: string[];
  schoolIds?: string[];
  classIds?: string[];
  groupIds?: string[];
};

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
 * Input for creating an administration with all related junction table entries.
 */
export interface CreateAdministrationInput {
  administration: InferInsertModel<typeof administrations>;
  orgIds: string[];
  classIds: string[];
  groupIds: string[];
  taskVariants: Array<{
    taskVariantId: string;
    orderIndex: number;
    conditionsAssignment?: unknown;
    conditionsRequirements?: unknown;
  }>;
  agreementIds: string[];
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
   * Get count of assigned users for multiple administrations.
   *
   * A user is "assigned" to an administration if they belong to an org, class, or group
   * that is linked to that administration. This respects the org hierarchy:
   * - Administration assigned to a district → includes users from all schools and classes in that district
   * - Administration assigned to a school → includes users from all classes in that school
   *
   * @param administrationIds - Array of administration IDs to count assigned users for
   * @returns Map of administration ID to assigned user count
   * @throws {Error} If called with empty administrationIds array
   */
  async getAssignedUserCountsByAdministrationIds(administrationIds: string[]): Promise<Map<string, number>> {
    if (administrationIds.length === 0) {
      throw new Error('administrationIds required for getting assigned user counts');
    }

    const assignments = this.buildAdministrationUserAssignmentsQuery(administrationIds).as('assignments');

    const result = await this.db
      .select({
        administrationId: assignments.administrationId,
        assignedCount: countDistinct(assignments.userId),
      })
      .from(assignments)
      .groupBy(assignments.administrationId);

    const countsMap = new Map<string, number>();
    for (const row of result) {
      countsMap.set(row.administrationId, row.assignedCount);
    }

    return countsMap;
  }

  /**
   * Returns all users assigned to the given administrations.
   *
   * Respects org hierarchy — an administration assigned to a district includes
   * users from all schools and classes in that district.
   *
   * Uses UNION ALL for performance (no deduplication). A user with multiple paths
   * to an administration appears multiple times. Always use COUNT(DISTINCT userId)
   * when aggregating.
   *
   * @param administrationIds - Array of administration IDs to query
   * @returns Drizzle subquery with `{ administrationId, userId }` rows
   */
  private buildAdministrationUserAssignmentsQuery(administrationIds: string[]) {
    const adminOrgTable = alias(orgs, 'admin_org');
    const userOrgTable = alias(orgs, 'user_org');

    // Path 1: Administration assigned to org → users in that org or descendant orgs
    const viaOrgToOrgUsers = this.db
      .select({
        administrationId: administrationOrgs.administrationId,
        userId: userOrgs.userId,
      })
      .from(administrationOrgs)
      .innerJoin(adminOrgTable, eq(adminOrgTable.id, administrationOrgs.orgId))
      .innerJoin(userOrgTable, isAncestorOrEqual(adminOrgTable.path, userOrgTable.path))
      .innerJoin(userOrgs, and(eq(userOrgs.orgId, userOrgTable.id), isEnrollmentActive(userOrgs)))
      .where(inArray(administrationOrgs.administrationId, administrationIds));

    // Path 2: Administration assigned to org → users in classes under that org
    const viaOrgToClassUsers = this.db
      .select({
        administrationId: administrationOrgs.administrationId,
        userId: userClasses.userId,
      })
      .from(administrationOrgs)
      .innerJoin(adminOrgTable, eq(adminOrgTable.id, administrationOrgs.orgId))
      .innerJoin(classes, isAncestorOrEqual(adminOrgTable.path, classes.orgPath))
      .innerJoin(userClasses, and(eq(userClasses.classId, classes.id), isEnrollmentActive(userClasses)))
      .where(inArray(administrationOrgs.administrationId, administrationIds));

    // Path 3: Administration assigned to class → users in that class
    const viaDirectClass = this.db
      .select({
        administrationId: administrationClasses.administrationId,
        userId: userClasses.userId,
      })
      .from(administrationClasses)
      .innerJoin(
        userClasses,
        and(eq(userClasses.classId, administrationClasses.classId), isEnrollmentActive(userClasses)),
      )
      .where(inArray(administrationClasses.administrationId, administrationIds));

    // Path 4: Administration assigned to group → users in that group
    const viaDirectGroup = this.db
      .select({
        administrationId: administrationGroups.administrationId,
        userId: userGroups.userId,
      })
      .from(administrationGroups)
      .innerJoin(userGroups, and(eq(userGroups.groupId, administrationGroups.groupId), isEnrollmentActive(userGroups)))
      .where(inArray(administrationGroups.administrationId, administrationIds));

    return viaOrgToOrgUsers.unionAll(viaOrgToClassUsers).unionAll(viaDirectClass).unionAll(viaDirectGroup);
  }

  /**
   * Get all assignees (districts, schools, classes, groups) for an administration.
   *
   * Executes 3 parallel queries:
   * 1. Districts and schools via administration_orgs → orgs (split by orgType)
   * 2. Classes via administration_classes → classes
   * 3. Groups via administration_groups → groups
   *
   * Returns the complete assignee list for the administration.
   *
   * @param administrationId - The administration ID to get assignees for
   * @returns All districts, schools, classes, and groups assigned to the administration
   */
  async getAssignees(administrationId: string): Promise<AdministrationAssignees> {
    const [orgResults, classResults, groupResults] = await Promise.all([
      // Query districts and schools
      this.db
        .select({
          id: orgs.id,
          name: orgs.name,
          orgType: orgs.orgType,
          parentOrgId: orgs.parentOrgId,
        })
        .from(administrationOrgs)
        .innerJoin(orgs, eq(orgs.id, administrationOrgs.orgId))
        .where(eq(administrationOrgs.administrationId, administrationId)),
      // Query classes
      this.db
        .select({
          id: classes.id,
          name: classes.name,
          schoolId: classes.schoolId,
          districtId: classes.districtId,
        })
        .from(administrationClasses)
        .innerJoin(classes, eq(classes.id, administrationClasses.classId))
        .where(eq(administrationClasses.administrationId, administrationId)),
      // Query groups
      this.db
        .select({
          id: groups.id,
          name: groups.name,
        })
        .from(administrationGroups)
        .innerJoin(groups, eq(groups.id, administrationGroups.groupId))
        .where(eq(administrationGroups.administrationId, administrationId)),
    ]);

    // Split orgs into districts and schools
    const districts = orgResults
      .filter((row) => row.orgType === OrgType.DISTRICT)
      .map((row) => ({
        id: row.id,
        name: row.name,
      }));

    // Schools always have a parentOrgId (their district), but the column is nullable
    // in the schema because districts don't have parents. Filter + assert for type safety.
    const schools = orgResults
      .filter(
        (row): row is typeof row & { parentOrgId: string } =>
          row.orgType === OrgType.SCHOOL && row.parentOrgId !== null,
      )
      .map((row) => ({
        id: row.id,
        name: row.name,
        parentOrgId: row.parentOrgId,
      }));

    return {
      districts,
      schools,
      classes: classResults,
      groups: groupResults,
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
    accessibleIds?: AccessibleIds,
  ): Promise<PaginatedResult<TreeNode>> {
    const { page, perPage } = options;
    const offset = (page - 1) * perPage;

    // Build FGA filters for each entity type
    const buildFgaFilter = (ids: string[] | undefined, column: PgColumn) => {
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
          ${TreeNodeEntityType.DISTRICT} AS entity_type,
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
          ${TreeNodeEntityType.SCHOOL} AS entity_type,
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
          ${TreeNodeEntityType.CLASS} AS entity_type,
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
          ${TreeNodeEntityType.GROUP} AS entity_type,
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

    const rows = result.rows as TreeNodeRowWithCounts[];

    const totalItems = rows[0] ? parseInt(rows[0].total_count, 10) : 0;

    const items: TreeNode[] = rows.map((row) => ({
      id: row.id,
      name: row.name,
      entityType: row.entity_type,
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
          ${TreeNodeEntityType.SCHOOL} AS entity_type,
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

    const rows = result.rows as TreeNodeRowWithCounts[];

    const totalItems = rows[0] ? parseInt(rows[0].total_count, 10) : 0;

    const items: TreeNode[] = rows.map((row) => ({
      id: row.id,
      name: row.name,
      entityType: row.entity_type,
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
          ${TreeNodeEntityType.CLASS} AS entity_type,
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

    const rows = result.rows as TreeNodeRowWithCounts[];

    const totalItems = rows[0] ? parseInt(rows[0].total_count, 10) : 0;

    const items: TreeNode[] = rows.map((row) => ({
      id: row.id,
      name: row.name,
      entityType: row.entity_type,
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
    accessibleIds?: AccessibleIds,
  ): Promise<PaginatedResult<TreeNode>> {
    // Root level: all directly assigned entities
    if (!parentEntityType) {
      return this.getRootTreeNodes(administrationId, options, accessibleIds ?? {});
    }

    // Leaf nodes: class and group have no children
    if (parentEntityType === TreeNodeEntityType.CLASS || parentEntityType === TreeNodeEntityType.GROUP) {
      return { items: [], totalItems: 0 };
    }

    // District → schools
    if (parentEntityType === TreeNodeEntityType.DISTRICT && parentEntityId) {
      return this.getDistrictChildTreeNodes(administrationId, parentEntityId, options, accessibleIds?.schoolIds);
    }

    // School → classes
    if (parentEntityType === TreeNodeEntityType.SCHOOL && parentEntityId) {
      return this.getSchoolChildTreeNodes(administrationId, parentEntityId, options, accessibleIds?.classIds);
    }

    // Shouldn't reach here if query validation is correct
    return { items: [], totalItems: 0 };
  }

  /**
   * Creates an administration with all related junction table entries in a single transaction.
   *
   * Inserts into:
   * - administrations (main record)
   * - administration_orgs (org assignments)
   * - administration_classes (class assignments)
   * - administration_groups (group assignments)
   * - administration_task_variants (task variant assignments with conditions)
   * - administration_agreements (agreement requirements)
   *
   * @param input - The administration data and all related entity IDs
   * @returns The created administration record
   * @throws If any insert fails, the entire transaction is rolled back
   */
  async createWithAssignments(input: CreateAdministrationInput): Promise<Administration> {
    return this.runTransaction({
      fn: async (tx) => {
        // Insert the main administration record
        const [created] = await tx.insert(administrations).values(input.administration).returning();

        const administrationId = created!.id;

        // Insert org assignments
        if (input.orgIds.length > 0) {
          await tx.insert(administrationOrgs).values(
            input.orgIds.map((orgId) => ({
              administrationId,
              orgId,
            })),
          );
        }

        // Insert class assignments
        if (input.classIds.length > 0) {
          await tx.insert(administrationClasses).values(
            input.classIds.map((classId) => ({
              administrationId,
              classId,
            })),
          );
        }

        // Insert group assignments
        if (input.groupIds.length > 0) {
          await tx.insert(administrationGroups).values(
            input.groupIds.map((groupId) => ({
              administrationId,
              groupId,
            })),
          );
        }

        // Insert task variant assignments
        if (input.taskVariants.length > 0) {
          await tx.insert(administrationTaskVariants).values(
            input.taskVariants.map((tv) => ({
              administrationId,
              taskVariantId: tv.taskVariantId,
              orderIndex: tv.orderIndex,
              conditionsAssignment: tv.conditionsAssignment,
              conditionsRequirements: tv.conditionsRequirements,
            })),
          );
        }

        // Insert agreement requirements
        if (input.agreementIds.length > 0) {
          await tx.insert(administrationAgreements).values(
            input.agreementIds.map((agreementId) => ({
              administrationId,
              agreementId,
            })),
          );
        }

        return created;
      },
    });
  }

  /**
   * Check if an administration with the given name already exists.
   * Uses case-insensitive comparison to match the database unique constraint.
   *
   * @param name - The name to check
   * @returns true if an administration with this name exists, false otherwise
   */
  async existsByName(name: string): Promise<boolean> {
    const result = await this.db
      .select({ id: administrations.id })
      .from(administrations)
      .where(sql`lower(${administrations.name}) = lower(${name})`)
      .limit(1);

    return result.length > 0;
  }
}
