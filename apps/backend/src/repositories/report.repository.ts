import { and, or, eq, sql, isNull, isNotNull, asc, desc, countDistinct, inArray } from 'drizzle-orm';
import type { SQL, Column } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  users,
  userOrgs,
  userClasses,
  userGroups,
  orgs,
  classes,
  groups,
  administrationOrgs,
  administrationClasses,
  administrationGroups,
  administrationTaskVariants,
  taskVariants,
  tasks,
} from '../db/schema';
import type * as CoreDbSchema from '../db/schema/core';
import { CoreDbClient } from '../db/clients';
import { fdwRuns } from '../db/schema/assessment-fdw/runs';
import { SortOrder } from '@roar-dashboard/api-contract';
import type { ScopeType } from '../services/report/report.types';
import { conditionToSql } from '../utils/condition-to-sql';
import type { Condition } from '../types/condition';
import type { ConditionFieldMap } from '../utils/condition-to-sql';
import { EntityType } from '../types/entity-type';
import { OrgType } from '../enums/org-type.enum';
import { UserRole } from '../enums/user-role.enum';
import { PROGRESS_PRIORITY_TO_STATUS } from '../constants/progress-status';
import type { ProgressStatus, ProgressStatusPriority } from '../constants/progress-status';
import type { PaginatedResult } from './base.repository';
import { isEnrollmentActive } from './utils/enrollment.utils';

/**
 * Scope parameters for report queries.
 */
export interface ReportScope {
  scopeType: ScopeType;
  scopeId: string;
}

/**
 * Task metadata resolved from administration_task_variants.
 * Includes condition JSONB for determining assigned vs optional status.
 */
export interface ReportTaskMeta {
  taskId: string;
  taskVariantId: string;
  taskSlug: string;
  taskName: string;
  orderIndex: number;
  /** assigned_if condition — null means assigned to all students */
  conditionsAssignment: Condition | null;
  /** optional_if condition — null means required for all assigned students */
  conditionsRequirements: Condition | null;
}

/**
 * Raw progress data for a single student from the database.
 */
export interface StudentProgressRow {
  userId: string;
  assessmentPid: string | null;
  username: string | null;
  email: string | null;
  nameFirst: string | null;
  nameLast: string | null;
  grade: string | null;
  schoolName: string | null;
  /** Demographic fields needed for condition evaluation */
  statusEll: string | null;
  statusIep: string | null;
  statusFrl: string | null;
  dob: string | null;
  gender: string | null;
  race: string | null;
  hispanicEthnicity: boolean | null;
  homeLanguage: string | null;
  /** Map of taskVariantId → run info. startedAt is from the FDW runs table's createdAt. */
  runs: Map<string, { completedAt: Date | null; startedAt: Date }>;
}

/**
 * Pagination options for report queries.
 */
export interface ReportPaginationOptions {
  page: number;
  perPage: number;
  sortColumn?: Column | SQL | undefined;
  sortDirection?: SortOrder | undefined;
}

/**
 * Parameters for sorting by progress status.
 * The repository builds a LEFT JOIN + CASE expression using these.
 */
export interface ProgressStatusSortParam {
  /** The task variant to sort by run status */
  taskVariantId: string;
  /** SQL condition for conditionsAssignment (from conditionToSql). undefined = assigned to all. */
  assignmentSql: SQL | undefined;
  /** SQL condition for conditionsRequirements (from conditionToSql). undefined = required for all. */
  requirementsSql: SQL | undefined;
}

/**
 * Parameters for filtering by progress status.
 * Each entry restricts results to students matching specific statuses for a task variant.
 */
export interface ProgressStatusFilterParam {
  /** The task variant to filter by run status */
  taskVariantId: string;
  /** Status values to include (e.g., ['completed', 'started']) */
  statusValues: string[];
  /** SQL condition for conditionsAssignment. undefined = assigned to all. */
  assignmentSql: SQL | undefined;
  /** SQL condition for conditionsRequirements. undefined = required for all. */
  requirementsSql: SQL | undefined;
}

/**
 * Per-task status counts from SQL-level aggregation.
 * Keyed by (taskId, status) → count.
 */
export interface TaskStatusCount {
  taskId: string;
  status: ProgressStatus;
  count: number;
}

/**
 * Result of the SQL-level progress overview aggregation.
 */
export interface ProgressOverviewCountsResult {
  totalStudents: number;
  taskStatusCounts: TaskStatusCount[];
}

/**
 * Maps JSONB condition field paths to Drizzle columns on the users table.
 * Used by conditionToSql to translate task variant conditions into SQL WHERE clauses.
 */
export const REPORT_CONDITION_FIELD_MAP: ConditionFieldMap = {
  'studentData.grade': users.grade,
  'studentData.statusEll': users.statusEll,
  'studentData.statusIep': users.statusIep,
  'studentData.statusFrl': users.statusFrl,
  'studentData.dob': users.dob,
  'studentData.gender': users.gender,
  'studentData.race': users.race,
  'studentData.hispanicEthnicity': users.hispanicEthnicity,
  'studentData.homeLanguage': users.homeLanguage,
};

/**
 * ReportRepository
 *
 * Provides data access for reporting endpoints. This is a standalone class
 * (not extending BaseRepository) because it performs cross-database queries
 * via FDW tables and complex multi-table joins that don't fit the standard
 * CRUD pattern.
 *
 * Uses `CoreDbClient` despite querying assessment data because the FDW tables
 * (`app_assessment_fdw.runs`) are foreign tables defined in the core database
 * that bridge to the assessment database. All queries go through the core DB
 * connection; the FDW handles the cross-database communication transparently.
 */
export class ReportRepository {
  constructor(private readonly db: NodePgDatabase<typeof CoreDbSchema> = CoreDbClient) {}

  /**
   * Get task metadata for an administration, ordered by orderIndex.
   *
   * @param administrationId - The administration to get tasks for
   * @returns Ordered array of task metadata
   */
  async getTaskMetadata(administrationId: string): Promise<ReportTaskMeta[]> {
    const rows = await this.db
      .select({
        taskId: tasks.id,
        taskVariantId: taskVariants.id,
        taskSlug: tasks.slug,
        taskName: tasks.name,
        orderIndex: administrationTaskVariants.orderIndex,
        conditionsAssignment: administrationTaskVariants.conditionsAssignment,
        conditionsRequirements: administrationTaskVariants.conditionsRequirements,
      })
      .from(administrationTaskVariants)
      .innerJoin(taskVariants, eq(administrationTaskVariants.taskVariantId, taskVariants.id))
      .innerJoin(tasks, eq(taskVariants.taskId, tasks.id))
      .where(eq(administrationTaskVariants.administrationId, administrationId))
      .orderBy(asc(administrationTaskVariants.orderIndex));

    // Drizzle returns JSONB columns as `unknown`. Cast at the repository boundary
    // where JSONB → domain type conversion belongs.
    return rows as ReportTaskMeta[];
  }

  /**
   * Validate that a scope entity is assigned to the administration.
   *
   * @param administrationId - The administration ID
   * @param scope - The scope to validate
   * @returns true if the scope entity is assigned to the administration
   */
  async isScopeAssignedToAdministration(administrationId: string, scope: ReportScope): Promise<boolean> {
    let result: { exists: boolean }[];

    switch (scope.scopeType) {
      case EntityType.DISTRICT: {
        // Check administration_orgs for any org whose path is at or below the district
        result = await this.db
          .select({ exists: sql<boolean>`true` })
          .from(administrationOrgs)
          .innerJoin(orgs, eq(administrationOrgs.orgId, orgs.id))
          .where(
            and(
              eq(administrationOrgs.administrationId, administrationId),
              // ltree <@ includes self-matches, so an exact ID check is unnecessary
              sql`${orgs.path} <@ (SELECT path FROM app.orgs WHERE id = ${scope.scopeId})`,
            ),
          )
          .limit(1);
        if (result.length > 0) return true;

        // Also check administration_classes — the administration may only have classes assigned
        result = await this.db
          .select({ exists: sql<boolean>`true` })
          .from(administrationClasses)
          .innerJoin(classes, eq(administrationClasses.classId, classes.id))
          .where(
            and(
              eq(administrationClasses.administrationId, administrationId),
              sql`${classes.orgPath} <@ (SELECT path FROM app.orgs WHERE id = ${scope.scopeId})`,
            ),
          )
          .limit(1);
        return result.length > 0;
      }

      case EntityType.SCHOOL: {
        // Check administration_orgs for the school org itself
        result = await this.db
          .select({ exists: sql<boolean>`true` })
          .from(administrationOrgs)
          .innerJoin(orgs, eq(administrationOrgs.orgId, orgs.id))
          .where(
            and(
              eq(administrationOrgs.administrationId, administrationId),
              sql`${orgs.path} <@ (SELECT path FROM app.orgs WHERE id = ${scope.scopeId})`,
            ),
          )
          .limit(1);
        if (result.length > 0) return true;

        // Also check administration_classes where the class belongs to this school
        result = await this.db
          .select({ exists: sql<boolean>`true` })
          .from(administrationClasses)
          .innerJoin(classes, eq(administrationClasses.classId, classes.id))
          .where(and(eq(administrationClasses.administrationId, administrationId), eq(classes.schoolId, scope.scopeId)))
          .limit(1);
        return result.length > 0;
      }

      case EntityType.CLASS:
        result = await this.db
          .select({ exists: sql<boolean>`true` })
          .from(administrationClasses)
          .where(
            and(
              eq(administrationClasses.administrationId, administrationId),
              eq(administrationClasses.classId, scope.scopeId),
            ),
          )
          .limit(1);

        if (result.length > 0) return true;

        // A class also counts as assigned if its school or a parent org is assigned
        result = await this.db
          .select({ exists: sql<boolean>`true` })
          .from(administrationOrgs)
          .innerJoin(orgs, eq(administrationOrgs.orgId, orgs.id))
          .where(
            and(
              eq(administrationOrgs.administrationId, administrationId),
              sql`(SELECT org_path FROM app.classes WHERE id = ${scope.scopeId}) <@ ${orgs.path}`,
            ),
          )
          .limit(1);
        return result.length > 0;

      case EntityType.GROUP:
        result = await this.db
          .select({ exists: sql<boolean>`true` })
          .from(administrationGroups)
          .where(
            and(
              eq(administrationGroups.administrationId, administrationId),
              eq(administrationGroups.groupId, scope.scopeId),
            ),
          )
          .limit(1);
        return result.length > 0;
    }
  }

  /**
   * Get the user's roles on the scope entity or its ancestors.
   * Used to determine if a user has a supervisory role at or above the scope level.
   *
   * @param userId - The user to check roles for
   * @param scope - The scope to check against
   * @returns Array of role strings the user holds at or above the scope
   */
  async getUserRolesAtOrAboveScope(userId: string, scope: ReportScope): Promise<string[]> {
    switch (scope.scopeType) {
      case EntityType.DISTRICT:
      case EntityType.SCHOOL: {
        // Check user_orgs for roles at the scope org or any ancestor
        const orgRoles = await this.db
          .select({ role: userOrgs.role })
          .from(userOrgs)
          .innerJoin(orgs, eq(userOrgs.orgId, orgs.id))
          .where(
            and(
              eq(userOrgs.userId, userId),
              isEnrollmentActive(userOrgs),
              isNull(orgs.rosteringEnded),
              sql`(SELECT path FROM app.orgs WHERE id = ${scope.scopeId}) <@ ${orgs.path}`,
            ),
          );
        return orgRoles.map((r) => r.role);
      }

      case EntityType.CLASS: {
        // Check user_classes for role on this class
        const classRoles = await this.db
          .select({ role: userClasses.role })
          .from(userClasses)
          .innerJoin(classes, eq(userClasses.classId, classes.id))
          .where(
            and(
              eq(userClasses.userId, userId),
              eq(userClasses.classId, scope.scopeId),
              isEnrollmentActive(userClasses),
              isNull(classes.rosteringEnded),
            ),
          );

        // Also check user_orgs for roles at the class's school or above
        const orgRoles = await this.db
          .select({ role: userOrgs.role })
          .from(userOrgs)
          .innerJoin(orgs, eq(userOrgs.orgId, orgs.id))
          .where(
            and(
              eq(userOrgs.userId, userId),
              isEnrollmentActive(userOrgs),
              isNull(orgs.rosteringEnded),
              sql`(SELECT org_path FROM app.classes WHERE id = ${scope.scopeId}) <@ ${orgs.path}`,
            ),
          );
        return [...classRoles.map((r) => r.role), ...orgRoles.map((r) => r.role)];
      }

      case EntityType.GROUP: {
        // Check user_groups for role on this group
        const groupRoles = await this.db
          .select({ role: userGroups.role })
          .from(userGroups)
          .innerJoin(groups, eq(userGroups.groupId, groups.id))
          .where(
            and(
              eq(userGroups.userId, userId),
              eq(userGroups.groupId, scope.scopeId),
              isEnrollmentActive(userGroups),
              isNull(groups.rosteringEnded),
            ),
          );
        return groupRoles.map((r) => r.role);
      }
    }
  }

  /**
   * Get paginated students within a scope, with their run data for the given task variants.
   *
   * Students are resolved from the scope entity (org/class/group junction tables),
   * filtered to student roles, and left-joined with FDW runs for completion status.
   *
   * When `progressStatusSort` is provided, a LEFT JOIN against the target variant's runs
   * is added to enable SQL-level sorting by completion status (completed > started > optional > assigned).
   * The CASE expression uses conditionToSql-translated conditions for assigned vs optional distinction.
   *
   * When `progressStatusFilters` are provided, similar LEFT JOINs + WHERE conditions restrict
   * results to students matching specific status values for specific task variants.
   *
   * @param administrationId - The administration ID
   * @param scope - The scope to query students within
   * @param taskVariantIds - The task variant IDs to get run data for
   * @param options - Pagination and sorting options
   * @param filterCondition - Optional SQL filter condition (must reference users table columns only)
   * @param progressStatusSort - Optional: sort by progress status for a specific task variant
   * @param progressStatusFilters - Optional: filter by progress status for specific task variants
   * @returns Paginated student rows with run data
   */
  async getProgressStudents(
    administrationId: string,
    scope: ReportScope,
    taskVariantIds: string[],
    options: ReportPaginationOptions,
    filterCondition?: SQL,
    progressStatusSort?: ProgressStatusSortParam,
    progressStatusFilters?: ProgressStatusFilterParam[],
  ): Promise<PaginatedResult<StudentProgressRow>> {
    const { page, perPage } = options;
    const offset = (page - 1) * perPage;

    // Build the student-in-scope subquery
    const studentsInScope = this.buildStudentInScopeQuery(scope).as('students_in_scope');

    // Build LEFT JOIN subqueries for progress status sort and filter.
    // Each progress status filter targets a specific task variant and needs its own
    // subquery against the FDW runs table. The sort may also need one. When the sort
    // targets the same variant as a filter, they share a subquery to avoid redundancy.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Drizzle subquery generics are complex
    const buildRunSub = (variantId: string, alias: string): any =>
      this.db
        .select({
          userId: fdwRuns.userId,
          completedAt: fdwRuns.completedAt,
        })
        .from(fdwRuns)
        .where(
          and(
            eq(fdwRuns.administrationId, administrationId),
            eq(fdwRuns.taskVariantId, variantId),
            isNull(fdwRuns.deletedAt),
            isNull(fdwRuns.abortedAt),
            eq(fdwRuns.useForReporting, true),
          ),
        )
        .as(alias);

    // Build filter subqueries — one per progress status filter (up to 3).
    // Track variant→subquery mapping so the sort can reuse one if it targets the same variant.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Drizzle subquery generics are complex
    const variantSubqueryMap = new Map<string, any>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Drizzle subquery generics are complex
    const filterSubs: { sub: any; filter: ProgressStatusFilterParam }[] = [];

    if (progressStatusFilters) {
      for (let i = 0; i < progressStatusFilters.length; i++) {
        const pf = progressStatusFilters[i]!;
        const alias = `filter_run_${i}`;
        const sub = buildRunSub(pf.taskVariantId, alias);
        variantSubqueryMap.set(pf.taskVariantId, sub);
        filterSubs.push({ sub, filter: pf });
      }
    }

    // Build sort subquery — reuse a filter subquery if it targets the same variant.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Drizzle subquery generics are complex
    let sortRunSub: any = null;
    if (progressStatusSort) {
      const existing = variantSubqueryMap.get(progressStatusSort.taskVariantId);
      sortRunSub = existing ?? buildRunSub(progressStatusSort.taskVariantId, 'sort_run');
    }

    // Collect all unique subqueries that need LEFT JOINs.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Drizzle subquery generics are complex
    const allJoinSubs: any[] = [];
    const addedAliases = new Set<string>();

    for (const { sub } of filterSubs) {
      const alias = sub._.alias as string;
      if (!addedAliases.has(alias)) {
        allJoinSubs.push(sub);
        addedAliases.add(alias);
      }
    }
    if (sortRunSub) {
      const alias = sortRunSub._.alias as string;
      if (!addedAliases.has(alias)) {
        allJoinSubs.push(sortRunSub);
        addedAliases.add(alias);
      }
    }

    // Build progress status filter SQL — AND all filter conditions together.
    const statusFilterConditions: SQL[] = [];
    for (const { sub, filter } of filterSubs) {
      const condition = this.buildProgressStatusFilterCondition(filter, sub);
      if (condition) statusFilterConditions.push(condition);
    }
    const statusFilterSql = statusFilterConditions.length > 0 ? and(...statusFilterConditions) : undefined;

    // Combined WHERE: user-level filter AND all progress status filters
    const combinedWhere = and(filterCondition, statusFilterSql);

    // Get total count — use countDistinct because the UNION-based subquery
    // can produce duplicate userIds (e.g., a student in both user_orgs and user_classes).
    // Apply filter LEFT JOINs to the count query (but not sort-only JOINs).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Drizzle query builder chain
    let countQueryBuilder: any = this.db
      .select({ total: countDistinct(users.id) })
      .from(users)
      .innerJoin(studentsInScope, eq(users.id, studentsInScope.userId));

    for (const { sub } of filterSubs) {
      countQueryBuilder = countQueryBuilder.leftJoin(sub, eq(users.id, sub.userId));
    }
    const countResult = await countQueryBuilder.where(combinedWhere);

    const totalItems = countResult[0]?.total ?? 0;

    if (totalItems === 0) {
      return { items: [], totalItems: 0 };
    }

    // Build sort expression.
    // When sorting by progress status, the CASE expression must be in the SELECT list
    // because PostgreSQL requires ORDER BY expressions to appear in SELECT DISTINCT.
    const sortFn = options.sortDirection === SortOrder.DESC ? desc : asc;
    let statusSortExpr: SQL | undefined;

    if (progressStatusSort && sortRunSub) {
      statusSortExpr = this.buildProgressStatusSortExpression(progressStatusSort, sortRunSub);
    }

    // Get paginated students with sorting.
    // When sorting by progress status, we use a two-step approach:
    // 1. Inner query: SELECT DISTINCT with the CASE in the select list (satisfies PG DISTINCT rule)
    // 2. Use the CASE expression directly in ORDER BY (Drizzle handles the expression matching)
    //
    // Without progress status sort, this is a straightforward selectDistinct + orderBy.
    const baseSelectFields = {
      userId: users.id,
      assessmentPid: users.assessmentPid,
      username: users.username,
      email: users.email,
      nameFirst: users.nameFirst,
      nameLast: users.nameLast,
      grade: users.grade,
      statusEll: users.statusEll,
      statusIep: users.statusIep,
      statusFrl: users.statusFrl,
      dob: users.dob,
      gender: users.gender,
      race: users.race,
      hispanicEthnicity: users.hispanicEthnicity,
      homeLanguage: users.homeLanguage,
    };

    // When sorting by progress status, include the CASE in the SELECT list and
    // ORDER BY it directly. PostgreSQL requires ORDER BY expressions in SELECT DISTINCT
    // to be in the select list, and using the same SQL object for both ensures they match.
    const selectFields = statusSortExpr ? { ...baseSelectFields, status_sort_order: statusSortExpr } : baseSelectFields;
    const primarySort = statusSortExpr ?? options.sortColumn ?? users.nameLast;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Drizzle query builder chain
    let dataQuery: any = this.db
      .selectDistinct(selectFields)
      .from(users)
      .innerJoin(studentsInScope, eq(users.id, studentsInScope.userId));

    // Chain all LEFT JOINs (filter + sort subqueries, deduplicated by alias)
    for (const sub of allJoinSubs) {
      dataQuery = dataQuery.leftJoin(sub, eq(users.id, sub.userId));
    }

    const studentRows = await dataQuery
      .where(combinedWhere)
      .orderBy(sortFn(primarySort), asc(users.id))
      .limit(perPage)
      .offset(offset);

    if (studentRows.length === 0) {
      return { items: [], totalItems };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dataQuery is any due to dynamic chaining
    const studentIds = studentRows.map((s: any) => s.userId as string);

    // Skip FDW query when there are no task variants — nothing to look up
    if (taskVariantIds.length === 0) {
      return {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dataQuery is any due to dynamic chaining
        items: studentRows.map((student: any) => ({
          ...student,
          schoolName: null,
          runs: new Map(),
        })) as StudentProgressRow[],
        totalItems,
      };
    }

    // Bulk fetch runs for these students.
    // Filter out soft-deleted, aborted, and non-reporting runs.
    // reliableRun is intentionally not filtered — unreliable runs still represent progress.
    const runRows = await this.db
      .select({
        userId: fdwRuns.userId,
        taskVariantId: fdwRuns.taskVariantId,
        completedAt: fdwRuns.completedAt,
        createdAt: fdwRuns.createdAt,
      })
      .from(fdwRuns)
      .where(
        and(
          eq(fdwRuns.administrationId, administrationId),
          inArray(fdwRuns.userId, studentIds),
          inArray(fdwRuns.taskVariantId, taskVariantIds),
          isNull(fdwRuns.deletedAt),
          isNull(fdwRuns.abortedAt),
          eq(fdwRuns.useForReporting, true),
        ),
      );

    // Build run maps per student.
    // If multiple runs exist for the same task variant, prefer completed over non-completed,
    // and among completed runs prefer the most recent completedAt.
    const runsByStudent = new Map<string, Map<string, { completedAt: Date | null; startedAt: Date }>>();
    for (const run of runRows) {
      if (!runsByStudent.has(run.userId)) {
        runsByStudent.set(run.userId, new Map());
      }
      const studentRuns = runsByStudent.get(run.userId)!;
      const existing = studentRuns.get(run.taskVariantId);
      const shouldReplace =
        !existing ||
        (run.completedAt && !existing.completedAt) ||
        (run.completedAt && existing.completedAt && run.completedAt > existing.completedAt);
      if (shouldReplace) {
        studentRuns.set(run.taskVariantId, {
          completedAt: run.completedAt,
          startedAt: run.createdAt,
        });
      }
    }

    // Resolve school names if district scope
    let schoolNamesByUser: Map<string, string> | undefined;
    if (scope.scopeType === EntityType.DISTRICT) {
      schoolNamesByUser = await this.getSchoolNamesForUsers(studentIds);
    }

    // Assemble results — explicit any needed because dynamic LEFT JOIN chain erases types
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dataQuery is any due to dynamic chaining
    const items: StudentProgressRow[] = studentRows.map((student: any) => ({
      userId: student.userId,
      assessmentPid: student.assessmentPid,
      username: student.username,
      email: student.email,
      nameFirst: student.nameFirst,
      nameLast: student.nameLast,
      grade: student.grade,
      schoolName: schoolNamesByUser?.get(student.userId) ?? null,
      statusEll: student.statusEll,
      statusIep: student.statusIep,
      statusFrl: student.statusFrl,
      dob: student.dob,
      gender: student.gender,
      race: student.race,
      hispanicEthnicity: student.hispanicEthnicity,
      homeLanguage: student.homeLanguage,
      runs: runsByStudent.get(student.userId) ?? new Map(),
    }));

    return { items, totalItems };
  }

  /**
   * Build a SQL CASE expression for sorting by progress status.
   * Maps run state + condition evaluation to a numeric sort order:
   *   completed (3) > started (2) > assigned (1) > optional (0)
   *
   * For students with no run, uses the SQL-translated conditions to distinguish
   * assigned from optional. Students not assigned to the task sort to -1 (excluded
   * from visible results by the condition evaluation in buildProgressMap).
   */
  private buildProgressStatusSortExpression(
    sortParam: ProgressStatusSortParam,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Drizzle subquery type is complex
    statusRunSub: any,
  ): SQL {
    const { assignmentSql, requirementsSql } = sortParam;

    // Build the CASE levels for no-run students
    // If both conditions are undefined (null in JSONB = no restriction), all no-run students are "assigned"
    if (!assignmentSql && !requirementsSql) {
      return sql`CASE
        WHEN ${statusRunSub.completedAt} IS NOT NULL THEN 3
        WHEN ${statusRunSub.userId} IS NOT NULL THEN 2
        ELSE 1
      END`;
    }

    if (!requirementsSql) {
      // Has assignment condition but no requirements — all assigned students are "required" (status = assigned)
      return sql`CASE
        WHEN ${statusRunSub.completedAt} IS NOT NULL THEN 3
        WHEN ${statusRunSub.userId} IS NOT NULL THEN 2
        WHEN (${assignmentSql}) THEN 1
        ELSE -1
      END`;
    }

    if (!assignmentSql) {
      // No assignment condition (assigned to all) but has requirements — assigned vs optional
      return sql`CASE
        WHEN ${statusRunSub.completedAt} IS NOT NULL THEN 3
        WHEN ${statusRunSub.userId} IS NOT NULL THEN 2
        WHEN (${requirementsSql}) THEN 0
        ELSE 1
      END`;
    }

    // Both conditions present
    return sql`CASE
      WHEN ${statusRunSub.completedAt} IS NOT NULL THEN 3
      WHEN ${statusRunSub.userId} IS NOT NULL THEN 2
      WHEN (${assignmentSql}) AND (${requirementsSql}) THEN 0
      WHEN (${assignmentSql}) THEN 1
      ELSE -1
    END`;
  }

  /**
   * Build a SQL WHERE condition for filtering by progress status.
   * Translates status values into run-state + condition SQL conditions.
   */
  private buildProgressStatusFilterCondition(
    filterParam: ProgressStatusFilterParam,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Drizzle subquery type is complex
    statusRunSub: any,
  ): SQL | undefined {
    const { statusValues, assignmentSql, requirementsSql } = filterParam;
    const conditions: SQL[] = [];

    for (const status of statusValues) {
      switch (status) {
        case 'completed':
          conditions.push(isNotNull(statusRunSub.completedAt));
          break;
        case 'started':
          conditions.push(and(isNotNull(statusRunSub.userId), isNull(statusRunSub.completedAt))!);
          break;
        case 'assigned': {
          // No run + assigned + not optional
          const noRun = isNull(statusRunSub.userId);
          const assigned = assignmentSql ?? sql`true`;
          const notOptional = requirementsSql ? sql`NOT (${requirementsSql})` : sql`true`;
          conditions.push(and(noRun, assigned, notOptional)!);
          break;
        }
        case 'optional': {
          // No run + assigned + optional
          const noRun = isNull(statusRunSub.userId);
          const assigned = assignmentSql ?? sql`true`;
          const optional = requirementsSql ?? sql`false`; // null requirements = required for all, never optional
          conditions.push(and(noRun, assigned, optional)!);
          break;
        }
      }
    }

    if (conditions.length === 0) return undefined;
    if (conditions.length === 1) return conditions[0];
    // Multiple status values are ORed (e.g., status:in:completed,started)
    return or(...conditions);
  }

  /**
   * Builds a Drizzle query that returns student userIds within a scope.
   * Filters to student roles and excludes rosteringEnded entities.
   * UNION (not UNION ALL) handles deduplication across branches.
   *
   * Returns the query without `.as()` so callers can either:
   * - Add `.as('students_in_scope')` for use as a Drizzle subquery alias
   * - Embed directly in a `sql` template literal for use as a CTE
   *
   * No `deletedAt` filter on users is needed because the users table has no
   * soft-delete column. Instead, rostered users are protected from hard deletion
   * by the `prevent_rostered_entity_delete` DB trigger.
   */
  private buildStudentInScopeQuery(scope: ReportScope) {
    switch (scope.scopeType) {
      case EntityType.DISTRICT:
        // Students in user_orgs where org path is at or below the district
        // UNION students in user_classes where class orgPath is at or below.
        // UNION (not UNION ALL) deduplicates across branches; no selectDistinct needed.
        return this.db
          .select({ userId: userOrgs.userId })
          .from(userOrgs)
          .innerJoin(orgs, eq(userOrgs.orgId, orgs.id))
          .where(
            and(
              eq(userOrgs.role, UserRole.STUDENT),
              isEnrollmentActive(userOrgs),
              isNull(orgs.rosteringEnded),
              sql`${orgs.path} <@ (SELECT path FROM app.orgs WHERE id = ${scope.scopeId})`,
            ),
          )
          .union(
            this.db
              .select({ userId: userClasses.userId })
              .from(userClasses)
              .innerJoin(classes, eq(userClasses.classId, classes.id))
              .where(
                and(
                  eq(userClasses.role, UserRole.STUDENT),
                  isEnrollmentActive(userClasses),
                  isNull(classes.rosteringEnded),
                  sql`${classes.orgPath} <@ (SELECT path FROM app.orgs WHERE id = ${scope.scopeId})`,
                ),
              ),
          );

      case EntityType.SCHOOL:
        // Students in user_orgs where orgId = schoolId
        // UNION students in user_classes where class.schoolId = schoolId
        return this.db
          .select({ userId: userOrgs.userId })
          .from(userOrgs)
          .innerJoin(orgs, eq(userOrgs.orgId, orgs.id))
          .where(
            and(
              eq(userOrgs.role, UserRole.STUDENT),
              isEnrollmentActive(userOrgs),
              isNull(orgs.rosteringEnded),
              eq(userOrgs.orgId, scope.scopeId),
            ),
          )
          .union(
            this.db
              .select({ userId: userClasses.userId })
              .from(userClasses)
              .innerJoin(classes, eq(userClasses.classId, classes.id))
              .where(
                and(
                  eq(userClasses.role, UserRole.STUDENT),
                  isEnrollmentActive(userClasses),
                  isNull(classes.rosteringEnded),
                  eq(classes.schoolId, scope.scopeId),
                ),
              ),
          );

      case EntityType.CLASS:
        return this.db
          .select({ userId: userClasses.userId })
          .from(userClasses)
          .innerJoin(classes, eq(userClasses.classId, classes.id))
          .where(
            and(
              eq(userClasses.role, UserRole.STUDENT),
              isEnrollmentActive(userClasses),
              isNull(classes.rosteringEnded),
              eq(userClasses.classId, scope.scopeId),
            ),
          );

      case EntityType.GROUP:
        return this.db
          .select({ userId: userGroups.userId })
          .from(userGroups)
          .innerJoin(groups, eq(userGroups.groupId, groups.id))
          .where(
            and(
              eq(userGroups.role, UserRole.STUDENT),
              isEnrollmentActive(userGroups),
              isNull(groups.rosteringEnded),
              eq(userGroups.groupId, scope.scopeId),
            ),
          );

      default:
        // Exhaustive check — this should never be reached since ScopeType is validated by Zod
        throw new Error(`Unsupported scope type: ${scope.scopeType satisfies never}`);
    }
  }

  /**
   * Resolve school names for a set of users by looking up their org memberships.
   * Returns the name of the school-type org the user belongs to.
   * If a user belongs to multiple schools, uses the alphabetically first school name
   * for deterministic results.
   *
   * Note: This lookup is not scoped to the administration's assigned orgs — it returns
   * the user's school from their org membership regardless of which schools are part of
   * the administration. For a user enrolled in multiple schools, the alphabetically first
   * school may not be the most relevant one for the current report context.
   */
  private async getSchoolNamesForUsers(userIds: string[]): Promise<Map<string, string>> {
    const rows = await this.db
      .selectDistinct({
        userId: userOrgs.userId,
        schoolName: orgs.name,
      })
      .from(userOrgs)
      .innerJoin(orgs, eq(userOrgs.orgId, orgs.id))
      .where(
        and(
          inArray(userOrgs.userId, userIds),
          eq(orgs.orgType, OrgType.SCHOOL),
          isEnrollmentActive(userOrgs),
          isNull(orgs.rosteringEnded),
        ),
      )
      .orderBy(asc(orgs.name));

    const map = new Map<string, string>();
    for (const row of rows) {
      // If a user belongs to multiple schools, use the alphabetically first one
      if (!map.has(row.userId)) {
        map.set(row.userId, row.schoolName);
      }
    }

    // Also check user_classes → classes → school for users not found via user_orgs
    const missingUserIds = userIds.filter((id) => !map.has(id));
    if (missingUserIds.length > 0) {
      const classRows = await this.db
        .selectDistinct({
          userId: userClasses.userId,
          schoolName: orgs.name,
        })
        .from(userClasses)
        .innerJoin(classes, eq(userClasses.classId, classes.id))
        .innerJoin(orgs, eq(classes.schoolId, orgs.id))
        .where(
          and(
            inArray(userClasses.userId, missingUserIds),
            isEnrollmentActive(userClasses),
            isNull(classes.rosteringEnded),
            isNull(orgs.rosteringEnded),
          ),
        )
        .orderBy(asc(orgs.name));

      for (const row of classRows) {
        if (!map.has(row.userId)) {
          map.set(row.userId, row.schoolName);
        }
      }
    }

    return map;
  }

  /**
   * Get aggregated progress overview counts using SQL-level aggregation.
   *
   * Uses a three-step SQL approach to minimize data transfer and post-query processing:
   *
   * 1. Count total students in scope via `countDistinct` on the students-in-scope subquery.
   *
   * 2. For each task variant, build a subquery that LEFT JOINs students against FDW runs
   *    and computes a status priority via a CASE expression (mirroring buildProgressStatusSortExpression):
   *    completed=3, started=2, assigned=1, optional=0, excluded=-1.
   *    UNION ALL all variant subqueries.
   *
   * 3. GROUP BY user_id, task_id with MAX(status_priority) for multi-variant dedup,
   *    then GROUP BY task_id, status with COUNT for final per-task aggregation.
   *
   * @param administrationId - The administration ID
   * @param scope - The scope to query students within
   * @param taskMetas - Task metadata with condition JSONB for each variant
   * @returns Total student count and per-task status counts
   */
  async getProgressOverviewCounts(
    administrationId: string,
    scope: ReportScope,
    taskMetas: ReportTaskMeta[],
  ): Promise<ProgressOverviewCountsResult> {
    const studentsInScope = this.buildStudentInScopeQuery(scope).as('students_in_scope');

    // 1. Count total students in scope
    const countResult = await this.db
      .select({ total: countDistinct(users.id) })
      .from(users)
      .innerJoin(studentsInScope, eq(users.id, studentsInScope.userId));

    const totalStudents = countResult[0]?.total ?? 0;

    if (totalStudents === 0 || taskMetas.length === 0) {
      return { totalStudents, taskStatusCounts: [] };
    }

    // 2. Build UNION ALL of per-variant status subqueries.
    // Each subquery LEFT JOINs students with runs for one variant and computes
    // a status priority via CASE. The students-in-scope query is defined as a CTE
    // (sis) so it's written once by Drizzle and referenced by name in each branch.
    const studentsInScopeQuery = this.buildStudentInScopeQuery(scope);

    const variantQueries: SQL[] = taskMetas.map((meta) => {
      const statusCase = this.buildOverviewStatusCase(meta);
      // Uses fully qualified table names (not aliases) because conditionToSql generates
      // Drizzle SQL referencing "app"."users"."column" — PostgreSQL requires the same
      // naming used in the FROM clause for column resolution.
      return sql`
        SELECT
          ${users.id} AS user_id,
          ${meta.taskId}::text AS task_id,
          (${statusCase}) AS status_priority
        FROM ${users}
        INNER JOIN sis ON ${users.id} = sis.user_id
        LEFT JOIN app_assessment_fdw.runs r ON r.user_id = ${users.id}
          AND r.administration_id = ${administrationId}
          AND r.task_variant_id = ${meta.taskVariantId}
          AND r.deleted_at IS NULL
          AND r.aborted_at IS NULL
          AND r.use_for_reporting = true
      `;
    });

    // UNION ALL the variant subqueries
    const unionSql = sql.join(variantQueries, sql` UNION ALL `);

    // 3. Two-level aggregation:
    //   Inner: GROUP BY user_id, task_id → MAX(status_priority) for multi-variant dedup
    //   Outer: GROUP BY task_id, max_priority → COUNT for final per-task status counts
    //   Filter out status_priority = -1 (excluded students)
    const aggregationQuery = sql`
      WITH sis AS (
        ${studentsInScopeQuery}
      ),
      variant_statuses AS (
        ${unionSql}
      ),
      deduped AS (
        SELECT
          user_id,
          task_id,
          MAX(status_priority) AS max_priority
        FROM variant_statuses
        WHERE status_priority >= 0
        GROUP BY user_id, task_id
      )
      SELECT
        task_id,
        max_priority,
        COUNT(*)::int AS cnt
      FROM deduped
      GROUP BY task_id, max_priority
      ORDER BY task_id, max_priority
    `;

    const rows = await this.db.execute(aggregationQuery);

    // Map priority numbers back to status strings

    const taskStatusCounts: TaskStatusCount[] = [];
    for (const row of rows.rows) {
      const r = row as { task_id: string; max_priority: number; cnt: number };
      const status = PROGRESS_PRIORITY_TO_STATUS[r.max_priority as ProgressStatusPriority];
      if (status) {
        taskStatusCounts.push({
          taskId: r.task_id,
          status,
          count: r.cnt,
        });
      }
    }

    return { totalStudents, taskStatusCounts };
  }

  /**
   * Build a SQL CASE expression for overview status determination per variant.
   * Maps run state + condition evaluation to a numeric priority:
   *   completed (3) > started (2) > assigned (1) > optional (0) > excluded (-1)
   *
   * Mirrors buildProgressStatusSortExpression but uses raw SQL column references
   * (for the LEFT JOIN alias `r`) instead of Drizzle subquery references.
   */
  private buildOverviewStatusCase(meta: ReportTaskMeta): SQL {
    const assignmentSql = conditionToSql(meta.conditionsAssignment, REPORT_CONDITION_FIELD_MAP);
    const requirementsSql = conditionToSql(meta.conditionsRequirements, REPORT_CONDITION_FIELD_MAP);

    // No conditions — all students are assigned (no optional, no exclusion)
    if (!assignmentSql && !requirementsSql) {
      return sql`CASE
        WHEN r.completed_at IS NOT NULL THEN 3
        WHEN r.user_id IS NOT NULL THEN 2
        ELSE 1
      END`;
    }

    // Assignment condition but no requirements — assigned or excluded
    if (!requirementsSql) {
      return sql`CASE
        WHEN r.completed_at IS NOT NULL THEN 3
        WHEN r.user_id IS NOT NULL THEN 2
        WHEN (${assignmentSql}) THEN 1
        ELSE -1
      END`;
    }

    // No assignment condition but has requirements — assigned vs optional
    if (!assignmentSql) {
      return sql`CASE
        WHEN r.completed_at IS NOT NULL THEN 3
        WHEN r.user_id IS NOT NULL THEN 2
        WHEN (${requirementsSql}) THEN 0
        ELSE 1
      END`;
    }

    // Both conditions present
    return sql`CASE
      WHEN r.completed_at IS NOT NULL THEN 3
      WHEN r.user_id IS NOT NULL THEN 2
      WHEN (${assignmentSql}) AND (${requirementsSql}) THEN 0
      WHEN (${assignmentSql}) THEN 1
      ELSE -1
    END`;
  }
}
