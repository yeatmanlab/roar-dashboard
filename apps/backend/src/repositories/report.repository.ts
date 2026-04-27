import { and, or, eq, sql, isNull, isNotNull, asc, desc, countDistinct, inArray, lte } from 'drizzle-orm';
import type { SQL, Column } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  users,
  userOrgs,
  userClasses,
  userGroups,
  userFamilies,
  families,
  orgs,
  classes,
  groups,
  administrations,
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
import { fdwRunScores } from '../db/schema/assessment-fdw/run-scores';
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
import { isEnrollmentActive, isActiveInFamily } from './utils/enrollment.utils';
import { alias } from 'drizzle-orm/pg-core';

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
  /** SQL condition for optional_if (conditionsRequirements). When true, the task is optional. undefined = required for all. */
  optionalIfSql: SQL | undefined;
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
  /** SQL condition for optional_if (conditionsRequirements). When true, the task is optional. undefined = required for all. */
  optionalIfSql: SQL | undefined;
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
 * Per-student, assignment-level progress counts.
 *
 * Each student is classified into exactly one bucket based on their required tasks:
 * - `studentsCompleted`: ALL required tasks at completed-required (priority 5)
 * - `studentsStarted`: at least one required task started or completed, but not all completed
 * - `studentsAssigned`: all required tasks still at assigned-required (priority 1)
 *
 * Students with only optional tasks (no required tasks) are excluded from all
 * three buckets and do not count toward `studentsWithRequiredTasks`.
 * Invariant: studentsAssigned + studentsStarted + studentsCompleted = studentsWithRequiredTasks.
 */
export interface StudentAssignmentLevelCounts {
  studentsWithRequiredTasks: number;
  studentsAssigned: number;
  studentsStarted: number;
  studentsCompleted: number;
}

/**
 * Raw student data for score overview aggregation.
 * Includes demographic fields for condition evaluation and grade for scoring.
 */
export interface StudentOverviewRow {
  userId: string;
  grade: string | null;
  statusEll: string | null;
  statusIep: string | null;
  statusFrl: string | null;
  dob: string | null;
  gender: string | null;
  race: string | null;
  hispanicEthnicity: boolean | null;
  homeLanguage: string | null;
}

/**
 * Raw run score row from the FDW run_scores table.
 * The service layer resolves these into percentile/rawScore values via the
 * scoring service's task-specific field mappings.
 */
export interface RunScoreRow {
  userId: string;
  taskVariantId: string;
  scoreName: string;
  scoreValue: string;
}

/** Score field type used in dynamic sort/filter on the student-scores endpoint. */
export type StudentScoresFieldType = 'rawScore' | 'percentile' | 'standardScore' | 'supportLevel';

/**
 * Parameters describing a single dynamic score-field sort or filter.
 *
 * The variant is the lowest-orderIndex variant of a multi-variant task — the
 * "primary variant". Sort and filter operate on its score values; students
 * with no score for the primary variant are sorted last (NULLS LAST).
 */
export interface StudentScoresFieldRef {
  /** The task variant to read scores from (primary variant of the task). */
  taskVariantId: string;
  /** The task slug — used for scoring-config lookups (cutoffs, support level). */
  taskSlug: string;
  /** The score field type to read. */
  fieldType: StudentScoresFieldType;
  /**
   * The scoring version for this variant (from task_variant_parameters), or null
   * for the legacy v0 path. Determines which cutoff/threshold table to use.
   */
  scoringVersion: number | null;
}

/** Operator for student-scores filter conditions on score fields. */
export type StudentScoresFilterOperator = 'eq' | 'neq' | 'gte' | 'lte' | 'in';

/**
 * A filter on a dynamic score field. `values` is always an array — single-value
 * operators use a one-element array; `in` may use multiple. For `supportLevel`
 * filters, values are support level priorities (1, 2, 3) rather than the string
 * names — the service translates names → priorities before passing to the repo.
 */
export interface StudentScoresFieldFilter extends StudentScoresFieldRef {
  operator: StudentScoresFilterOperator;
  /** String for numeric fields (cast in SQL); priority numbers for supportLevel. */
  values: string[];
}

/**
 * Resolved scoring cutoffs/thresholds for a single variant, ready to be emitted
 * into a SQL CASE expression. Built from the scoring config in JS at query-build
 * time.
 *
 * - `assessmentSupportLevelField`: when set, the variant uses
 *   classification.type === 'assessment-computed' and its support level lives
 *   in run_scores under this field name.
 * - `percentileCutoffs` / `rawScoreThresholds`: present when classification is
 *   `percentile-then-rawscore`. `null` for tasks with classification.type
 *   `'none'` or unknown taskSlug — the support level is unclassifiable.
 * - `percentileBelowGrade`: from the scoring config; null means "use percentile
 *   for all grades".
 */
export interface ResolvedScoringRules {
  assessmentSupportLevelField: string | null;
  percentileCutoffs: { achieved: number; developing: number } | null;
  rawScoreThresholds: { above: number; some: number } | null;
  percentileBelowGrade: number | null;
  /** Resolved field names for the variant + grade-aware fallback. */
  percentileFieldNames: string[];
  rawScoreFieldNames: string[];
  standardScoreFieldNames: string[];
}

/**
 * One historical run row for the individual-student-report endpoint.
 *
 * The repository returns one of these per (administration, taskVariant) the
 * student has a completed, reporting-eligible run for — across all
 * administrations whose `dateStart` is on or before a target date.
 *
 * The service layer joins these with the per-run score rows (returned
 * separately by `getScoresForRunIds`) to assemble the per-task
 * `historicalScores` arrays in the response.
 */
export interface HistoricalRunRow {
  runId: string;
  userId: string;
  taskId: string;
  taskVariantId: string;
  administrationId: string;
  administrationName: string;
  administrationDateStart: Date;
  completedAt: Date;
  reliableRun: boolean | null;
  engagementFlags: string[];
}

/**
 * Per-administration metadata returned by `getStudentAdministrations`.
 *
 * One row per administration the student has either started a run in or
 * remains assigned to via their org/class/group memberships, ordered by
 * `dateStart` ascending. The service joins this with task and score data
 * to populate the per-administration `tasks` array of the guardian report.
 */
export interface StudentAdministrationRow {
  id: string;
  name: string;
  dateStart: Date;
  dateEnd: Date;
}

/**
 * A single row from the paginated task-subscores query — student
 * demographics plus a `(variantId, name, value)` score map for the
 * variants the student has completed for this task.
 *
 * Multi-variant deduplication (which variant's row to surface when the
 * student completed multiple) happens in the service layer using the
 * lowest-`orderIndex` rule shared with the rest of the score-report
 * endpoints.
 */
export interface TaskSubscoreQueryRow {
  userId: string;
  assessmentPid: string | null;
  username: string | null;
  email: string | null;
  nameFirst: string | null;
  nameLast: string | null;
  grade: string | null;
  /** Map of taskVariantId → (run_scores.name → value) for the student's completed runs. */
  scores: Map<string, Map<string, string>>;
}

/**
 * Optional sort/filter parameters specific to the task-subscores endpoint.
 *
 * `subscoreSort` selects a `run_scores.name` and direction; the repo emits
 * a LEFT JOIN exposing that score's numeric value as the sort column.
 * `subscoreFilters` are AND-combined; each compiles to its own LEFT JOIN
 * with a `WHERE numericValueSql(value) <op> threshold` clause.
 *
 * The service is responsible for translating the API-level
 * `subscores.<key>` into a concrete `run_scores.name` via the subscore
 * registry — keys without a numeric form are rejected upstream.
 */
export interface TaskSubscoreNumericSort {
  /** `run_scores.name` carrying the numeric representation. */
  scoreName: string;
}

export interface TaskSubscoreNumericFilter {
  scoreName: string;
  operator: 'eq' | 'neq' | 'gte' | 'lte';
  value: number;
}

/**
 * A single row from the paginated student-scores query — student demographics
 * plus a flat list of (variantId, scoreName, scoreValue) score rows for that
 * student.
 *
 * Run-level metadata (`reliable`, `engagementFlags`, `runId`) is keyed by
 * variantId — a student has at most one selected completed run per variant
 * (the one used to populate scores).
 */
export interface StudentScoreQueryRow {
  userId: string;
  assessmentPid: string | null;
  username: string | null;
  email: string | null;
  nameFirst: string | null;
  nameLast: string | null;
  grade: string | null;
  /** Demographic fields needed for condition evaluation. */
  statusEll: string | null;
  statusIep: string | null;
  statusFrl: string | null;
  dob: string | null;
  gender: string | null;
  race: string | null;
  hispanicEthnicity: boolean | null;
  homeLanguage: string | null;
  /**
   * Map of taskVariantId → run metadata for the selected completed run.
   *
   * `completedAt` is the run's completion timestamp; included so the repository
   * can pick the most recent completed run per (user, variant) without an extra
   * lookup, and surfaced for any consumer that wants to display recency.
   */
  runs: Map<string, { runId: string; reliable: boolean | null; engagementFlags: string[]; completedAt: Date | null }>;
  /** Map of taskVariantId → score field name → value (raw text from run_scores). */
  scores: Map<string, Map<string, string>>;
}

/**
 * Result of the SQL-level progress overview aggregation.
 */
export interface ProgressOverviewCountsResult {
  totalStudents: number;
  taskStatusCounts: TaskStatusCount[];
  studentCounts: StudentAssignmentLevelCounts;
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
   *
   * 7-level priority scheme that evaluates conditions for ALL students to preserve
   * the required/optional distinction at every stage:
   *   completed-required (5) > completed-optional (4) > started-required (3) >
   *   started-optional (2) > assigned-required (1) > assigned-optional (0) > excluded (-1)
   *
   * Uses Drizzle subquery column references (for the LEFT JOIN subquery) instead of
   * raw SQL aliases. Mirrors buildOverviewStatusCase logic.
   */
  private buildProgressStatusSortExpression(
    sortParam: ProgressStatusSortParam,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Drizzle subquery type is complex
    statusRunSub: any,
  ): SQL {
    const { assignmentSql, optionalIfSql } = sortParam;

    // No conditions — all students are assigned and required
    if (!assignmentSql && !optionalIfSql) {
      return sql`CASE
        WHEN ${statusRunSub.completedAt} IS NOT NULL THEN 5
        WHEN ${statusRunSub.userId} IS NOT NULL THEN 3
        ELSE 1
      END`;
    }

    // Assignment condition but no optional_if — all assigned are required
    if (!optionalIfSql) {
      return sql`CASE
        WHEN ${statusRunSub.completedAt} IS NOT NULL AND (${assignmentSql}) THEN 5
        WHEN ${statusRunSub.userId} IS NOT NULL AND (${assignmentSql}) THEN 3
        WHEN (${assignmentSql}) THEN 1
        ELSE -1
      END`;
    }

    // No assignment condition (all assigned) but has optional_if — required vs optional
    if (!assignmentSql) {
      return sql`CASE
        WHEN ${statusRunSub.completedAt} IS NOT NULL AND (${optionalIfSql}) THEN 4
        WHEN ${statusRunSub.completedAt} IS NOT NULL THEN 5
        WHEN ${statusRunSub.userId} IS NOT NULL AND (${optionalIfSql}) THEN 2
        WHEN ${statusRunSub.userId} IS NOT NULL THEN 3
        WHEN (${optionalIfSql}) THEN 0
        ELSE 1
      END`;
    }

    // Both conditions present
    return sql`CASE
      WHEN ${statusRunSub.completedAt} IS NOT NULL AND (${assignmentSql}) AND (${optionalIfSql}) THEN 4
      WHEN ${statusRunSub.completedAt} IS NOT NULL AND (${assignmentSql}) THEN 5
      WHEN ${statusRunSub.userId} IS NOT NULL AND (${assignmentSql}) AND (${optionalIfSql}) THEN 2
      WHEN ${statusRunSub.userId} IS NOT NULL AND (${assignmentSql}) THEN 3
      WHEN (${assignmentSql}) AND (${optionalIfSql}) THEN 0
      WHEN (${assignmentSql}) THEN 1
      ELSE -1
    END`;
  }

  /**
   * Build a SQL WHERE condition for filtering by progress status.
   * Translates 7-level status values into run-state + condition SQL conditions.
   *
   * Each status encodes both the progress axis (assigned/started/completed) and
   * the requirement axis (required/optional). Conditions are evaluated for all
   * students, including those with runs.
   */
  private buildProgressStatusFilterCondition(
    filterParam: ProgressStatusFilterParam,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Drizzle subquery type is complex
    statusRunSub: any,
  ): SQL | undefined {
    const { statusValues, assignmentSql, optionalIfSql } = filterParam;
    const conditions: SQL[] = [];

    const isOptionalSql = optionalIfSql ?? sql`false`; // undefined = required for all
    const isRequiredSql = optionalIfSql ? sql`NOT (${optionalIfSql})` : sql`true`;
    const isAssignedSql = assignmentSql ?? sql`true`;

    for (const status of statusValues) {
      switch (status) {
        case 'completed-required':
          conditions.push(and(isNotNull(statusRunSub.completedAt), isAssignedSql, isRequiredSql)!);
          break;
        case 'completed-optional':
          conditions.push(and(isNotNull(statusRunSub.completedAt), isAssignedSql, isOptionalSql)!);
          break;
        case 'started-required':
          conditions.push(
            and(isNotNull(statusRunSub.userId), isNull(statusRunSub.completedAt), isAssignedSql, isRequiredSql)!,
          );
          break;
        case 'started-optional':
          conditions.push(
            and(isNotNull(statusRunSub.userId), isNull(statusRunSub.completedAt), isAssignedSql, isOptionalSql)!,
          );
          break;
        case 'assigned-required': {
          const noRun = isNull(statusRunSub.userId);
          conditions.push(and(noRun, isAssignedSql, isRequiredSql)!);
          break;
        }
        case 'assigned-optional': {
          const noRun = isNull(statusRunSub.userId);
          conditions.push(and(noRun, isAssignedSql, isOptionalSql)!);
          break;
        }
      }
    }

    if (conditions.length === 0) return undefined;
    if (conditions.length === 1) return conditions[0];
    // Multiple status values are ORed (e.g., status:in:completed-required,started-required)
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
   *
   * Public so that other repository methods (e.g., the student-scores listing) can
   * reuse the same lookup at district scope without duplicating the two-phase
   * user_orgs → user_classes fallback.
   */
  async getSchoolNamesForUsers(userIds: string[]): Promise<Map<string, string>> {
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
   * Get aggregated progress overview counts for multiple scopes in a single query.
   *
   * Extends the single-scope pattern to N scopes by adding a `scope_id` discriminator
   * column to both the students-in-scope CTE and the variant status subqueries.
   * All scopes share one pass through the variant × student × run join, so cost
   * scales with total students across scopes, not with the number of scopes.
   *
   * Uses a multi-step SQL approach:
   *
   * 1. Build a multi-scope students-in-scope CTE by UNIONing each scope's student
   *    query with a literal `scope_id` column. UNION (not UNION ALL) deduplicates
   *    within each scope, but a student may appear under multiple scopes.
   *
   * 2. Count total students per scope via `COUNT(DISTINCT user_id) ... GROUP BY scope_id`.
   *
   * 3. For each task variant, build a subquery that LEFT JOINs students (from the CTE)
   *    against FDW runs and computes a 7-level status priority via a CASE expression:
   *    completed-required=5, completed-optional=4, started-required=3, started-optional=2,
   *    assigned-required=1, assigned-optional=0, excluded=-1.
   *    Carries `scope_id` through. UNION ALL all variant subqueries.
   *
   * 4. Two-level aggregation + per-student assignment-level counts (per scope):
   *    - deduped: GROUP BY scope_id, user_id, task_id → MAX(status_priority) for dedup
   *    - task_counts: GROUP BY scope_id, task_id, max_priority → COUNT for per-task status counts
   *    - required_tasks_per_student: per-student, per-scope aggregation of required tasks only
   *      (priorities 1, 3, 5). Each student is bucketed by assignment-level status:
   *        completed: MIN(max_priority) = 5 (all required tasks completed)
   *        started: MAX(max_priority) >= 3 AND MIN(max_priority) < 5 (at least one started, not all done)
   *        assigned: MAX(max_priority) = 1 (all required tasks still at assigned-required)
   *
   * @param administrationId - The administration ID
   * @param scopes - Array of scopes to compute stats for
   * @param taskMetas - Task metadata with condition JSONB for each variant
   * @returns Map of scopeId → ProgressOverviewCountsResult
   */
  async getProgressOverviewCountsBulk(
    administrationId: string,
    scopes: ReportScope[],
    taskMetas: ReportTaskMeta[],
  ): Promise<Map<string, ProgressOverviewCountsResult>> {
    const resultMap = new Map<string, ProgressOverviewCountsResult>();

    if (scopes.length === 0) {
      return resultMap;
    }

    // 1. Build multi-scope students-in-scope CTE.
    // Each scope's student query gets a literal scope_id column.
    const scopeQueries: SQL[] = scopes.map((scope) => {
      const studentQuery = this.buildStudentInScopeQuery(scope);
      return sql`SELECT ${scope.scopeId}::text AS scope_id, sub.user_id FROM (${studentQuery}) sub`;
    });

    const multiScopeSisSql = sql.join(scopeQueries, sql` UNION `);

    // 2. Count total students per scope
    const countQuery = sql`
      WITH sis AS (
        ${multiScopeSisSql}
      )
      SELECT scope_id, COUNT(DISTINCT user_id)::int AS total
      FROM sis
      GROUP BY scope_id
    `;

    const countRows = await this.db.execute(countQuery);

    const totalStudentsMap = new Map<string, number>();
    for (const row of countRows.rows) {
      const r = row as { scope_id: string; total: number };
      totalStudentsMap.set(r.scope_id, r.total);
    }

    // Initialize result map with zeroed results for all scopes
    for (const scope of scopes) {
      resultMap.set(scope.scopeId, {
        totalStudents: totalStudentsMap.get(scope.scopeId) ?? 0,
        taskStatusCounts: [],
        studentCounts: {
          studentsWithRequiredTasks: 0,
          studentsAssigned: 0,
          studentsStarted: 0,
          studentsCompleted: 0,
        },
      });
    }

    // If no students at all or no tasks, return early with zeroed results
    const hasAnyStudents = [...totalStudentsMap.values()].some((total) => total > 0);
    if (!hasAnyStudents || taskMetas.length === 0) {
      return resultMap;
    }

    // 3. Build UNION ALL of per-variant status subqueries with scope_id.
    // The multi-scope CTE is referenced as `sis` in each variant subquery.
    const variantQueries: SQL[] = taskMetas.map((meta) => {
      const statusCase = this.buildOverviewStatusCase(meta);
      return sql`
        SELECT
          sis.scope_id,
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

    const unionSql = sql.join(variantQueries, sql` UNION ALL `);

    // 4. Two-level aggregation + per-student assignment-level counts (per scope):
    //   deduped: GROUP BY scope_id, user_id, task_id → MAX(status_priority) for multi-variant dedup
    //   task_counts: GROUP BY scope_id, task_id, max_priority → COUNT for per-task status counts
    //   required_tasks_per_student: per-student, per-scope aggregation of required tasks only.
    //     Required tasks are those with max_priority IN (1, 3, 5) — i.e., on the required axis.
    //     Each student is bucketed by assignment-level status:
    //       completed: MIN(max_priority) = 5 (all required tasks completed)
    //       started: MAX(max_priority) >= 3 AND MIN(max_priority) < 5 (at least one started, not all done)
    //       assigned: MAX(max_priority) = 1 (all required tasks still at assigned-required)
    const aggregationQuery = sql`
      WITH sis AS (
        ${multiScopeSisSql}
      ),
      variant_statuses AS (
        ${unionSql}
      ),
      deduped AS (
        SELECT
          scope_id,
          user_id,
          task_id,
          MAX(status_priority) AS max_priority
        FROM variant_statuses
        WHERE status_priority >= 0
        GROUP BY scope_id, user_id, task_id
      ),
      task_counts AS (
        SELECT
          scope_id,
          task_id,
          max_priority,
          COUNT(*)::int AS cnt
        FROM deduped
        GROUP BY scope_id, task_id, max_priority
      ),
      required_tasks_per_student AS (
        SELECT
          scope_id,
          user_id,
          COUNT(*) AS required_task_count,
          MIN(max_priority) AS min_required_priority,
          MAX(max_priority) AS max_required_priority
        FROM deduped
        WHERE max_priority IN (1, 3, 5)
        GROUP BY scope_id, user_id
      )
      SELECT 'task_count' AS result_type, scope_id, task_id, max_priority, cnt,
        NULL::bigint AS students_with_required, NULL::bigint AS students_completed,
        NULL::bigint AS students_started, NULL::bigint AS students_assigned
      FROM task_counts
      UNION ALL
      SELECT 'student_counts' AS result_type, scope_id, NULL AS task_id, NULL AS max_priority, NULL AS cnt,
        COUNT(*)::bigint AS students_with_required,
        COUNT(*) FILTER (WHERE min_required_priority = 5)::bigint AS students_completed,
        COUNT(*) FILTER (WHERE max_required_priority >= 3 AND min_required_priority < 5)::bigint AS students_started,
        COUNT(*) FILTER (WHERE max_required_priority = 1)::bigint AS students_assigned
      FROM required_tasks_per_student
      GROUP BY scope_id
    `;

    const rows = await this.db.execute(aggregationQuery);

    // Parse results: distribute task counts and student-level counts into per-scope results
    for (const row of rows.rows) {
      const r = row as {
        result_type: string;
        scope_id: string;
        task_id: string | null;
        max_priority: number | null;
        cnt: number | null;
        students_with_required: number | null;
        students_completed: number | null;
        students_started: number | null;
        students_assigned: number | null;
      };

      const scopeResult = resultMap.get(r.scope_id);
      if (!scopeResult) continue;

      if (r.result_type === 'student_counts') {
        scopeResult.studentCounts = {
          studentsWithRequiredTasks: Number(r.students_with_required ?? 0),
          studentsCompleted: Number(r.students_completed ?? 0),
          studentsStarted: Number(r.students_started ?? 0),
          studentsAssigned: Number(r.students_assigned ?? 0),
        };
      } else if (r.task_id !== null && r.max_priority !== null && r.cnt !== null) {
        const status = PROGRESS_PRIORITY_TO_STATUS[r.max_priority as ProgressStatusPriority];
        if (status) {
          scopeResult.taskStatusCounts.push({
            taskId: r.task_id,
            status,
            count: r.cnt,
          });
        }
      }
    }

    return resultMap;
  }

  /**
   * Get aggregated progress overview counts for a single scope.
   *
   * Delegates to {@link getProgressOverviewCountsBulk} with a single-element array,
   * extracting the result for the given scope.
   *
   * @param administrationId - The administration ID
   * @param scope - The scope to query students within
   * @param taskMetas - Task metadata with condition JSONB for each variant
   * @returns Total student count, per-task status counts, and per-student assignment-level counts
   */
  async getProgressOverviewCounts(
    administrationId: string,
    scope: ReportScope,
    taskMetas: ReportTaskMeta[],
  ): Promise<ProgressOverviewCountsResult> {
    const bulkResult = await this.getProgressOverviewCountsBulk(administrationId, [scope], taskMetas);
    return (
      bulkResult.get(scope.scopeId) ?? {
        totalStudents: 0,
        taskStatusCounts: [],
        studentCounts: {
          studentsWithRequiredTasks: 0,
          studentsAssigned: 0,
          studentsStarted: 0,
          studentsCompleted: 0,
        },
      }
    );
  }

  /**
   * Build a SQL CASE expression for overview status determination per variant.
   *
   * 7-level priority scheme that evaluates conditions for ALL students, including
   * those with runs, to preserve the required/optional distinction at every stage:
   *   completed-required (5) > completed-optional (4) > started-required (3) >
   *   started-optional (2) > assigned-required (1) > assigned-optional (0) > excluded (-1)
   *
   * Note on conditionsRequirements: despite the name, this is an "optional_if" condition.
   * When it evaluates to true, the task is OPTIONAL. When false/absent, the task is REQUIRED.
   *
   * Mirrors buildProgressStatusSortExpression but uses raw SQL column references
   * (for the LEFT JOIN alias `r`) instead of Drizzle subquery references.
   */
  private buildOverviewStatusCase(meta: ReportTaskMeta): SQL {
    const assignmentSql = conditionToSql(meta.conditionsAssignment, REPORT_CONDITION_FIELD_MAP);
    const isOptionalSql = conditionToSql(meta.conditionsRequirements, REPORT_CONDITION_FIELD_MAP);

    // No conditions — all students are assigned and required (no optional, no exclusion)
    if (!assignmentSql && !isOptionalSql) {
      return sql`CASE
        WHEN r.completed_at IS NOT NULL THEN 5
        WHEN r.user_id IS NOT NULL THEN 3
        ELSE 1
      END`;
    }

    // Assignment condition but no requirements — all assigned students are required
    if (!isOptionalSql) {
      return sql`CASE
        WHEN r.completed_at IS NOT NULL AND (${assignmentSql}) THEN 5
        WHEN r.user_id IS NOT NULL AND (${assignmentSql}) THEN 3
        WHEN (${assignmentSql}) THEN 1
        ELSE -1
      END`;
    }

    // No assignment condition (all assigned) but has requirements — required vs optional
    if (!assignmentSql) {
      return sql`CASE
        WHEN r.completed_at IS NOT NULL AND (${isOptionalSql}) THEN 4
        WHEN r.completed_at IS NOT NULL THEN 5
        WHEN r.user_id IS NOT NULL AND (${isOptionalSql}) THEN 2
        WHEN r.user_id IS NOT NULL THEN 3
        WHEN (${isOptionalSql}) THEN 0
        ELSE 1
      END`;
    }

    // Both conditions present
    return sql`CASE
      WHEN r.completed_at IS NOT NULL AND (${assignmentSql}) AND (${isOptionalSql}) THEN 4
      WHEN r.completed_at IS NOT NULL AND (${assignmentSql}) THEN 5
      WHEN r.user_id IS NOT NULL AND (${assignmentSql}) AND (${isOptionalSql}) THEN 2
      WHEN r.user_id IS NOT NULL AND (${assignmentSql}) THEN 3
      WHEN (${assignmentSql}) AND (${isOptionalSql}) THEN 0
      WHEN (${assignmentSql}) THEN 1
      ELSE -1
    END`;
  }

  /**
   * Get all students in scope with demographic fields for score overview aggregation.
   * Returns all students (no pagination) so the overview can aggregate across the full population.
   *
   * Implementation note: this method runs two queries — a `COUNT DISTINCT` for
   * `totalStudents` followed by a `SELECT DISTINCT` for the row data. Between
   * the two calls the underlying population could change (a roster sync, a
   * `rosteringEnded` update, or a concurrent admin-assignment edit), which
   * would let the returned `totalStudents` diverge from `students.length` by
   * a small amount. The window is very short and the worst case is an off-by-N
   * on the count for one request — acceptable for an aggregation endpoint that
   * already presents instantaneous snapshots. Wrap in a transaction with
   * `REPEATABLE READ` if precision tightens.
   *
   * @param scope - The scope to query students within
   * @param filterCondition - Optional SQL filter condition (must reference users table columns only)
   * @returns Total student count and all student rows with demographic data
   */
  async getAllStudentsInScope(
    scope: ReportScope,
    filterCondition?: SQL,
  ): Promise<{ totalStudents: number; students: StudentOverviewRow[] }> {
    const studentsInScope = this.buildStudentInScopeQuery(scope).as('students_in_scope');

    const [countRow] = await this.db
      .select({ total: countDistinct(users.id) })
      .from(users)
      .innerJoin(studentsInScope, eq(users.id, studentsInScope.userId))
      .where(filterCondition);

    const totalStudents = countRow?.total ?? 0;

    if (totalStudents === 0) {
      return { totalStudents: 0, students: [] };
    }

    const studentRows = await this.db
      .selectDistinct({
        userId: users.id,
        grade: users.grade,
        statusEll: users.statusEll,
        statusIep: users.statusIep,
        statusFrl: users.statusFrl,
        dob: users.dob,
        gender: users.gender,
        race: users.race,
        hispanicEthnicity: users.hispanicEthnicity,
        homeLanguage: users.homeLanguage,
      })
      .from(users)
      .innerJoin(studentsInScope, eq(users.id, studentsInScope.userId))
      .where(filterCondition);

    return { totalStudents, students: studentRows };
  }

  /**
   * Bulk fetch completed run scores for a set of students and task variants.
   * Returns raw score rows (scoreName + scoreValue) that the service layer
   * resolves into percentile/rawScore using task-specific field mappings.
   *
   * Filters: completed runs only (completedAt IS NOT NULL), non-aborted, non-deleted,
   * reporting-eligible. Mirrors the run filters used in `getProgressStudents`.
   *
   * Run-level dedup: this query does not de-duplicate at the run level — it returns
   * every score row for every matching run. The caller (`buildScoreLookup`) folds
   * scores into a `userId → taskVariantId → scoreName → value` map, with last-row-wins
   * on duplicate `(userId, taskVariantId, scoreName)` triples. That is correct only
   * if the assessment side guarantees at most one `useForReporting=true`,
   * non-aborted, non-deleted completed run per (user, variant). If that invariant
   * is ever broken, multi-run scoring will silently pick the last-fetched row's
   * value rather than e.g. the most recent one — surface this assumption here so
   * any future change to assessment-side run lifecycle gets reviewed against it.
   *
   * @param administrationId - The administration ID
   * @param studentIds - Student user IDs to fetch scores for
   * @param taskVariantIds - Task variant IDs to fetch scores for
   * @returns Array of raw score rows
   */
  async getCompletedRunScores(
    administrationId: string,
    studentIds: string[],
    taskVariantIds: string[],
  ): Promise<RunScoreRow[]> {
    if (studentIds.length === 0 || taskVariantIds.length === 0) {
      return [];
    }

    const rows = await this.db
      .select({
        userId: fdwRuns.userId,
        taskVariantId: fdwRuns.taskVariantId,
        scoreName: fdwRunScores.name,
        scoreValue: fdwRunScores.value,
      })
      .from(fdwRuns)
      .innerJoin(fdwRunScores, eq(fdwRuns.id, fdwRunScores.runId))
      .where(
        and(
          eq(fdwRuns.administrationId, administrationId),
          inArray(fdwRuns.userId, studentIds),
          inArray(fdwRuns.taskVariantId, taskVariantIds),
          isNull(fdwRuns.deletedAt),
          isNull(fdwRuns.abortedAt),
          eq(fdwRuns.useForReporting, true),
          isNotNull(fdwRuns.completedAt),
        ),
      );

    return rows;
  }

  /**
   * Get paginated per-student score rows for an administration.
   *
   * Returns one row per student in scope, with run metadata (`runs`) and raw
   * score values (`scores`) keyed by `taskVariantId` for every variant in the
   * filtered `taskMetas` set. The service layer assembles the final response
   * shape (deduping per taskId, computing supportLevel from scores, formatting).
   *
   * Dynamic sort/filter on `scores.<taskId>.<field>` is implemented via
   * per-variant LEFT JOIN subqueries against `runs` + `run_scores`. The sort
   * applies to one variant at most (the primary variant for the task selected
   * by the service); each filter targets one (variant, fieldType) pair. For
   * `supportLevel`, the SQL CASE is built from `scoringRulesByVariant` — the
   * service pre-resolves the scoring config's cutoffs/thresholds and passes
   * them in so the repository stays decoupled from the scoring service.
   *
   * @param administrationId - The administration ID
   * @param scope - The scope to query students within
   * @param taskMetas - Task metadata after taskId filtering
   * @param options - Pagination + static sort column
   * @param filterCondition - Optional SQL filter on user-level columns
   * @param sortField - Optional dynamic score-field sort
   * @param scoreFieldFilters - Optional dynamic score-field filters
   * @param scoringRulesByVariant - Resolved scoring rules per variant for supportLevel CASE generation
   * @returns Paginated student rows with run metadata and score values
   */
  async getStudentScores(
    administrationId: string,
    scope: ReportScope,
    taskMetas: ReportTaskMeta[],
    options: ReportPaginationOptions,
    filterCondition?: SQL,
    sortField?: StudentScoresFieldRef | null,
    scoreFieldFilters?: StudentScoresFieldFilter[],
    scoringRulesByVariant?: Map<string, ResolvedScoringRules>,
  ): Promise<PaginatedResult<StudentScoreQueryRow>> {
    const { page, perPage } = options;
    const offset = (page - 1) * perPage;

    const studentsInScope = this.buildStudentInScopeQuery(scope).as('students_in_scope');

    // 1. Determine which (variant, fieldType) joins are needed.
    // Sort and filters may target the same variant — we still build separate join
    // aliases per (variant, fieldType, joinPurpose) for clarity. PostgreSQL's
    // planner collapses redundancy.
    interface JoinPlan {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Drizzle subquery generics
      sub: any;
      alias: string;
      // SQL expression that evaluates to a comparable value (numeric for raw/pct/std,
      // priority integer for supportLevel) on the joined row.
      expr: SQL;
    }
    const joins: JoinPlan[] = [];

    /** Build a runs+run_scores subquery selecting `value` for one (variant, name) combo. */
    const buildScoreSub = (alias: string, variantId: string, scoreNames: string[]) =>
      this.db
        .select({
          userId: fdwRuns.userId,
          value: fdwRunScores.value,
        })
        .from(fdwRuns)
        .innerJoin(fdwRunScores, eq(fdwRuns.id, fdwRunScores.runId))
        .where(
          and(
            eq(fdwRuns.administrationId, administrationId),
            eq(fdwRuns.taskVariantId, variantId),
            isNull(fdwRuns.deletedAt),
            isNull(fdwRuns.abortedAt),
            eq(fdwRuns.useForReporting, true),
            isNotNull(fdwRuns.completedAt),
            scoreNames.length === 1 ? eq(fdwRunScores.name, scoreNames[0]!) : inArray(fdwRunScores.name, scoreNames),
          ),
        )
        .as(alias);

    /** Add a numeric (rawScore/percentile/standardScore) join for a field ref. */
    const addNumericJoin = (alias: string, ref: StudentScoresFieldRef): SQL | null => {
      const rules = scoringRulesByVariant?.get(ref.taskVariantId);
      const fieldNames =
        ref.fieldType === 'rawScore'
          ? rules?.rawScoreFieldNames
          : ref.fieldType === 'percentile'
            ? rules?.percentileFieldNames
            : ref.fieldType === 'standardScore'
              ? rules?.standardScoreFieldNames
              : undefined;
      if (!fieldNames || fieldNames.length === 0) {
        // Task has no resolvable field for this type (e.g., letter has no percentile)
        return null;
      }
      const sub = buildScoreSub(alias, ref.taskVariantId, fieldNames);
      const expr = numericValueSql(sub.value);
      joins.push({ sub, alias, expr });
      return expr;
    };

    /** Add support-level priority join(s) for a field ref. Returns the priority SQL or null. */
    const addSupportLevelJoin = (aliasPrefix: string, ref: StudentScoresFieldRef): SQL | null => {
      const rules = scoringRulesByVariant?.get(ref.taskVariantId);
      if (!rules) return null;

      // Assessment-computed: one join on the supportLevel field, mapped to priority
      if (rules.assessmentSupportLevelField) {
        const sub = buildScoreSub(`${aliasPrefix}_sl`, ref.taskVariantId, [rules.assessmentSupportLevelField]);
        const expr = sql`CASE ${sub.value}
          WHEN 'achievedSkill' THEN 3
          WHEN 'developingSkill' THEN 2
          WHEN 'needsExtraSupport' THEN 1
          ELSE NULL::integer
        END`;
        joins.push({ sub, alias: `${aliasPrefix}_sl`, expr });
        return expr;
      }

      // Percentile-then-rawscore: needs percentile + rawScore joins (each may be empty)
      const pctNames = rules.percentileFieldNames;
      const rawNames = rules.rawScoreFieldNames;
      let pctSql: SQL | null = null;
      let rawSql: SQL | null = null;

      if (pctNames.length > 0 && rules.percentileCutoffs) {
        const sub = buildScoreSub(`${aliasPrefix}_pct`, ref.taskVariantId, pctNames);
        joins.push({ sub, alias: `${aliasPrefix}_pct`, expr: numericValueSql(sub.value) });
        pctSql = numericValueSql(sub.value);
      }
      if (rawNames.length > 0 && rules.rawScoreThresholds) {
        const sub = buildScoreSub(`${aliasPrefix}_raw`, ref.taskVariantId, rawNames);
        joins.push({ sub, alias: `${aliasPrefix}_raw`, expr: numericValueSql(sub.value) });
        rawSql = numericValueSql(sub.value);
      }

      return buildSupportLevelPrioritySql(rules, gradeAsIntSql(users.grade), pctSql, rawSql);
    };

    // 2. Build sort expression (via dynamic field if requested)
    let dynamicSortExpr: SQL | undefined;
    if (sortField) {
      const sortAlias = `sort_${joins.length}`;
      const expr =
        sortField.fieldType === 'supportLevel'
          ? addSupportLevelJoin(sortAlias, sortField)
          : addNumericJoin(`${sortAlias}_${sortField.fieldType}`, sortField);
      if (expr) dynamicSortExpr = expr;
    }

    // 3. Build score-field filter conditions
    const fieldFilterConditions: SQL[] = [];
    if (scoreFieldFilters) {
      for (let i = 0; i < scoreFieldFilters.length; i++) {
        const f = scoreFieldFilters[i]!;
        const filterAlias = `filt_${i}`;
        const valueExpr =
          f.fieldType === 'supportLevel'
            ? addSupportLevelJoin(filterAlias, f)
            : addNumericJoin(`${filterAlias}_${f.fieldType}`, f);
        if (!valueExpr) continue; // No resolvable scores → filter has no effect (matches nothing)
        const condition = buildScoreFieldFilterCondition(valueExpr, f.operator, f.values);
        if (condition) fieldFilterConditions.push(condition);
      }
    }
    const fieldFilterSql = fieldFilterConditions.length > 0 ? and(...fieldFilterConditions) : undefined;

    // 4. Combined WHERE: user-level + score-field filters
    const combinedWhere = and(filterCondition, fieldFilterSql);

    // 5. School name lookup for sorting/filtering by user.schoolName at district scope.
    // Uses a correlated lateral subquery against user_orgs/orgs for SQL-side sortability.
    const schoolNameSql =
      scope.scopeType === EntityType.DISTRICT
        ? sql<string>`(
            SELECT MIN(${orgs.name}) FROM ${orgs}
            INNER JOIN ${userOrgs} ON ${userOrgs.orgId} = ${orgs.id}
            WHERE ${userOrgs.userId} = ${users.id}
              AND ${orgs.orgType} = ${OrgType.SCHOOL}
              AND ${isEnrollmentActive(userOrgs)}
              AND ${orgs.rosteringEnded} IS NULL
          )`
        : sql<string | null>`NULL::text`;

    // 6. Count query (DISTINCT on user.id because filter joins may multiply rows)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Drizzle dynamic chain
    let countQuery: any = this.db
      .select({ total: countDistinct(users.id) })
      .from(users)
      .innerJoin(studentsInScope, eq(users.id, studentsInScope.userId));
    for (const j of joins) {
      countQuery = countQuery.leftJoin(j.sub, eq(users.id, j.sub.userId));
    }
    const countResult = await countQuery.where(combinedWhere);
    const totalItems = countResult[0]?.total ?? 0;

    if (totalItems === 0) {
      return { items: [], totalItems: 0 };
    }

    // 7. Paginated data query
    const sortFn = options.sortDirection === SortOrder.DESC ? desc : asc;
    const baseSelect = {
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
      schoolName: schoolNameSql,
    };

    // When sorting by a dynamic expression, include it in the SELECT list so
    // PostgreSQL's DISTINCT-with-ORDER-BY rule is satisfied.
    const selectFields = dynamicSortExpr ? { ...baseSelect, _sort_expr: dynamicSortExpr } : baseSelect;
    const primarySort = dynamicSortExpr ?? options.sortColumn ?? users.nameLast;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Drizzle dynamic chain
    let dataQuery: any = this.db
      .selectDistinct(selectFields)
      .from(users)
      .innerJoin(studentsInScope, eq(users.id, studentsInScope.userId));
    for (const j of joins) {
      dataQuery = dataQuery.leftJoin(j.sub, eq(users.id, j.sub.userId));
    }

    const studentRows = await dataQuery
      .where(combinedWhere)
      .orderBy(sql`${sortFn(primarySort)} NULLS LAST`, asc(users.id))
      .limit(perPage)
      .offset(offset);

    if (studentRows.length === 0) {
      return { items: [], totalItems };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dataQuery is any from dynamic chain
    const studentIds = studentRows.map((s: any) => s.userId as string);
    const taskVariantIds = taskMetas.map((t) => t.taskVariantId);

    // 8. Bulk fetch run metadata (reliable, engagementFlags) for displayed students
    // and bulk fetch all run scores so the service can assemble per-task entries.
    const runsByStudent = new Map<string, StudentScoreQueryRow['runs']>();
    const scoresByStudent = new Map<string, Map<string, Map<string, string>>>();

    if (taskVariantIds.length > 0) {
      const runRows = await this.db
        .select({
          userId: fdwRuns.userId,
          taskVariantId: fdwRuns.taskVariantId,
          runId: fdwRuns.id,
          reliableRun: fdwRuns.reliableRun,
          engagementFlags: fdwRuns.engagementFlags,
          completedAt: fdwRuns.completedAt,
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
            isNotNull(fdwRuns.completedAt),
          ),
        );

      // Pick the most recent completed run per (user, variant) — defensive against
      // the rare case where multiple useForReporting runs exist (see getCompletedRunScores).
      // Tracking completedAt directly in the map value lets the comparison stay O(1)
      // per row instead of scanning runRows on every duplicate.
      for (const r of runRows) {
        if (!runsByStudent.has(r.userId)) runsByStudent.set(r.userId, new Map());
        const studentRuns = runsByStudent.get(r.userId)!;
        const existing = studentRuns.get(r.taskVariantId);
        const existingCompletedAt = existing?.completedAt ?? null;
        if (!existing || (r.completedAt && existingCompletedAt && r.completedAt > existingCompletedAt)) {
          studentRuns.set(r.taskVariantId, {
            runId: r.runId,
            reliable: r.reliableRun,
            engagementFlags: Array.isArray(r.engagementFlags) ? (r.engagementFlags as string[]) : [],
            completedAt: r.completedAt,
          });
        }
      }

      // Collect the selected run IDs from the deduped map (one per user/variant).
      const selectedRunIds: string[] = [];
      for (const studentRuns of runsByStudent.values()) {
        for (const meta of studentRuns.values()) {
          selectedRunIds.push(meta.runId);
        }
      }
      if (selectedRunIds.length > 0) {
        const scoreRows = await this.db
          .select({
            userId: fdwRuns.userId,
            taskVariantId: fdwRuns.taskVariantId,
            scoreName: fdwRunScores.name,
            scoreValue: fdwRunScores.value,
          })
          .from(fdwRuns)
          .innerJoin(fdwRunScores, eq(fdwRuns.id, fdwRunScores.runId))
          .where(inArray(fdwRuns.id, selectedRunIds));

        for (const row of scoreRows) {
          if (!scoresByStudent.has(row.userId)) scoresByStudent.set(row.userId, new Map());
          const variantMap = scoresByStudent.get(row.userId)!;
          if (!variantMap.has(row.taskVariantId)) variantMap.set(row.taskVariantId, new Map());
          variantMap.get(row.taskVariantId)!.set(row.scoreName, row.scoreValue);
        }
      }
    }

    // 9. Assemble result rows
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dataQuery is any from dynamic chain
    const items: StudentScoreQueryRow[] = studentRows.map((student: any) => ({
      userId: student.userId,
      assessmentPid: student.assessmentPid,
      username: student.username,
      email: student.email,
      nameFirst: student.nameFirst,
      nameLast: student.nameLast,
      grade: student.grade,
      statusEll: student.statusEll,
      statusIep: student.statusIep,
      statusFrl: student.statusFrl,
      dob: student.dob,
      gender: student.gender,
      race: student.race,
      hispanicEthnicity: student.hispanicEthnicity,
      homeLanguage: student.homeLanguage,
      runs: runsByStudent.get(student.userId) ?? new Map(),
      scores: scoresByStudent.get(student.userId) ?? new Map(),
    }));

    return { items, totalItems };
  }

  /**
   * Paginated students in scope with their subscore rows for a single task.
   *
   * Targets the task-subscores endpoint (#1685). The student population is
   * the same `buildStudentInScopeQuery` set used by other report queries;
   * we further restrict to students with at least one completed,
   * reporting-eligible run for the supplied task variant set, then layer
   * dynamic numeric subscore filters and sort on top.
   *
   * Returns `{user fields, scores: Map<variantId, Map<name, value>>}` —
   * the service layer applies multi-variant dedup and registry-based
   * value formatting.
   *
   * @param administrationId - The administration to query
   * @param scope - Scope filter (district/school/class/group)
   * @param taskVariantIds - All variants of the target task in this admin
   * @param options - Pagination + static sort column
   * @param filterCondition - Optional SQL filter on `users` columns
   * @param subscoreSort - Optional dynamic numeric sort on a subscore name
   * @param subscoreFilters - Optional dynamic numeric filters on subscore names
   * @returns Paginated student rows with score maps
   */
  async getTaskSubscoreStudents(
    administrationId: string,
    scope: ReportScope,
    taskVariantIds: string[],
    options: ReportPaginationOptions,
    filterCondition?: SQL,
    subscoreSort?: TaskSubscoreNumericSort | null,
    subscoreFilters?: TaskSubscoreNumericFilter[],
  ): Promise<PaginatedResult<TaskSubscoreQueryRow>> {
    const { page, perPage } = options;
    const offset = (page - 1) * perPage;

    // No variants ⇒ no rows by definition.
    if (taskVariantIds.length === 0) {
      return { items: [], totalItems: 0 };
    }

    const studentsInScope = this.buildStudentInScopeQuery(scope).as('students_in_scope');

    /** Build a runs+run_scores subquery exposing one (variantSet, name) score value per user. */
    const buildScoreSub = (alias: string, scoreName: string) =>
      this.db
        .select({
          userId: fdwRuns.userId,
          value: fdwRunScores.value,
        })
        .from(fdwRuns)
        .innerJoin(fdwRunScores, eq(fdwRuns.id, fdwRunScores.runId))
        .where(
          and(
            eq(fdwRuns.administrationId, administrationId),
            inArray(fdwRuns.taskVariantId, taskVariantIds),
            isNull(fdwRuns.deletedAt),
            isNull(fdwRuns.abortedAt),
            eq(fdwRuns.useForReporting, true),
            isNotNull(fdwRuns.completedAt),
            eq(fdwRunScores.name, scoreName),
          ),
        )
        .as(alias);

    // Restrict the population to students with at least one completed
    // reporting-eligible run for the target variant set. The runs table
    // links `userId` to `taskVariantId`, so a `WHERE EXISTS` against runs
    // narrows users-in-scope before the score joins explode the row count.
    const hasCompletedRunSql = sql`EXISTS (
      SELECT 1 FROM ${fdwRuns} r
      WHERE r.user_id = ${users.id}
        AND r.administration_id = ${administrationId}
        AND r.task_variant_id IN (${sql.join(
          taskVariantIds.map((v) => sql`${v}`),
          sql`, `,
        )})
        AND r.deleted_at IS NULL
        AND r.aborted_at IS NULL
        AND r.use_for_reporting = true
        AND r.completed_at IS NOT NULL
    )`;

    // Plan optional sort/filter score-name joins. PostgreSQL's planner
    // collapses redundant subqueries when the same name appears more than
    // once; we still alias each join distinctly for legibility.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Drizzle subquery generic
    const sortJoinPlan: { sub: any; alias: string; expr: SQL } | null = subscoreSort
      ? (() => {
          const sub = buildScoreSub(`sort_${subscoreSort.scoreName}`, subscoreSort.scoreName);
          return { sub, alias: `sort_${subscoreSort.scoreName}`, expr: numericValueSql(sub.value) };
        })()
      : null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Drizzle subquery generic
    const filterJoinPlans: Array<{ sub: any; alias: string; condition: SQL }> = (subscoreFilters ?? []).map(
      (f, idx) => {
        const alias = `filter_${idx}_${f.scoreName}`;
        const sub = buildScoreSub(alias, f.scoreName);
        const numeric = numericValueSql(sub.value);
        const condition: SQL = (() => {
          switch (f.operator) {
            case 'gte':
              return sql`${numeric} >= ${f.value}`;
            case 'lte':
              return sql`${numeric} <= ${f.value}`;
            case 'eq':
              return sql`${numeric} = ${f.value}`;
            case 'neq':
              return sql`${numeric} <> ${f.value}`;
            default: {
              assertUnreachableOperator(f.operator);
              throw new Error(`Unknown subscore filter operator`);
            }
          }
        })();
        return { sub, alias, condition };
      },
    );

    // Compose the WHERE list shared by count + page-data queries.
    const whereConditions: SQL[] = [hasCompletedRunSql];
    if (filterCondition) whereConditions.push(filterCondition);
    for (const plan of filterJoinPlans) {
      whereConditions.push(plan.condition);
    }

    // ─── Count query — total items before pagination ───
    let countQuery = this.db
      .select({ count: countDistinct(users.id) })
      .from(users)
      .innerJoin(studentsInScope, eq(users.id, studentsInScope.userId))
      .$dynamic();
    for (const plan of filterJoinPlans) {
      countQuery = countQuery.leftJoin(plan.sub, eq(plan.sub.userId, users.id));
    }
    const countResult = await countQuery.where(and(...whereConditions));
    const totalItems = countResult[0]?.count ?? 0;
    if (totalItems === 0) {
      return { items: [], totalItems: 0 };
    }

    // ─── Page-data query — selects user demographics + applies sort/limit ───
    const sortDirection = options.sortDirection === SortOrder.DESC ? desc : asc;
    let pageQuery = this.db
      .selectDistinct({
        userId: users.id,
        assessmentPid: users.assessmentPid,
        username: users.username,
        email: users.email,
        nameFirst: users.nameFirst,
        nameLast: users.nameLast,
        grade: users.grade,
        sortValue: sortJoinPlan ? sortJoinPlan.expr.as('sort_value') : sql`NULL`.as('sort_value'),
      })
      .from(users)
      .innerJoin(studentsInScope, eq(users.id, studentsInScope.userId))
      .$dynamic();
    for (const plan of filterJoinPlans) {
      pageQuery = pageQuery.leftJoin(plan.sub, eq(plan.sub.userId, users.id));
    }
    if (sortJoinPlan) {
      pageQuery = pageQuery.leftJoin(sortJoinPlan.sub, eq(sortJoinPlan.sub.userId, users.id));
    }

    // Resolve the primary sort column. When a subscore sort is requested,
    // we sort by its numeric expression with NULLs LAST so students who
    // didn't complete the matching subscore drop to the bottom; otherwise
    // we honor the static `options.sortColumn` (e.g., `users.lastName`).
    // A secondary sort on `users.id` keeps pagination stable regardless.
    const primarySort = sortJoinPlan
      ? sql`${sortJoinPlan.expr} ${sql.raw(options.sortDirection === SortOrder.DESC ? 'DESC' : 'ASC')} NULLS LAST`
      : options.sortColumn
        ? sortDirection(options.sortColumn)
        : asc(users.nameLast);

    const studentRows = await pageQuery
      .where(and(...whereConditions))
      .orderBy(primarySort, asc(users.id))
      .limit(perPage)
      .offset(offset);

    if (studentRows.length === 0) {
      return { items: [], totalItems };
    }

    // ─── Score lookup — fetch all run_scores rows for the chosen page ───
    const studentIds = studentRows.map((s) => s.userId);
    const scoreRows = await this.db
      .select({
        userId: fdwRuns.userId,
        taskVariantId: fdwRuns.taskVariantId,
        scoreName: fdwRunScores.name,
        scoreValue: fdwRunScores.value,
      })
      .from(fdwRuns)
      .innerJoin(fdwRunScores, eq(fdwRuns.id, fdwRunScores.runId))
      .where(
        and(
          eq(fdwRuns.administrationId, administrationId),
          inArray(fdwRuns.taskVariantId, taskVariantIds),
          inArray(fdwRuns.userId, studentIds),
          isNull(fdwRuns.deletedAt),
          isNull(fdwRuns.abortedAt),
          eq(fdwRuns.useForReporting, true),
          isNotNull(fdwRuns.completedAt),
        ),
      );

    // Index scores by userId → variantId → scoreName → scoreValue.
    const scoresByStudent = new Map<string, Map<string, Map<string, string>>>();
    for (const row of scoreRows) {
      let byVariant = scoresByStudent.get(row.userId);
      if (!byVariant) {
        byVariant = new Map();
        scoresByStudent.set(row.userId, byVariant);
      }
      let byName = byVariant.get(row.taskVariantId);
      if (!byName) {
        byName = new Map();
        byVariant.set(row.taskVariantId, byName);
      }
      byName.set(row.scoreName, row.scoreValue);
    }

    const items: TaskSubscoreQueryRow[] = studentRows.map((student) => ({
      userId: student.userId,
      assessmentPid: student.assessmentPid,
      username: student.username,
      email: student.email,
      nameFirst: student.nameFirst,
      nameLast: student.nameLast,
      grade: student.grade,
      scores: scoresByStudent.get(student.userId) ?? new Map(),
    }));

    return { items, totalItems };
  }

  /**
   * Verify that a student is in the requested scope as a STUDENT-role enrollment
   * AND has not had their roster ended.
   *
   * Two checks combined:
   * 1. The user's enrollment passes `buildStudentInScopeQuery` — they appear as
   *    a student in the scope's org/class/group hierarchy and the underlying
   *    org/class/group does not have `rosteringEnded` set.
   * 2. The user record itself does not have `rosteringEnded` set.
   *
   * Returns `true` only when both pass. The service uses this to surface a 404
   * for individual-student-report requests targeting a user not in scope (or
   * whose own roster has ended), as required by the ticket.
   */
  async verifyStudentInScope(scope: ReportScope, userId: string): Promise<boolean> {
    const studentsInScope = this.buildStudentInScopeQuery(scope).as('sis');

    const rows = await this.db
      .select({ userId: users.id })
      .from(users)
      .innerJoin(studentsInScope, eq(users.id, studentsInScope.userId))
      .where(and(eq(users.id, userId), isNull(users.rosteringEnded)))
      .limit(1);

    return rows.length > 0;
  }

  /**
   * Fetch historical run rows for one student across all administrations whose
   * `dateStart` is on or before `currentAdminDateStart`, restricted to a list of
   * task IDs (so callers don't pull in irrelevant runs from other tasks the
   * student happened to complete in earlier administrations).
   *
   * Returns one row per (administration, taskVariant) with run-level metadata
   * and the parent administration's name and start date — the service uses these
   * to assemble per-task historical entries and label trend chart points.
   *
   * Score rows are NOT included; the service follows up with
   * `getScoresForRunIds` keyed by the run IDs returned here. Splitting
   * the two queries keeps the data shape predictable and lets the service
   * decide which scores to surface per task.
   *
   * Filters: completed runs only, non-aborted, non-deleted, reporting-eligible.
   * Includes the current administration too (because `<=`), which the service
   * treats as the most-recent point on the trend line.
   *
   * @param userId - The student's user ID
   * @param currentAdminDateStart - Inclusive upper bound on `administration.dateStart`
   * @param taskIds - Restrict to these task IDs (typically the current admin's tasks)
   * @returns One row per (administration, taskVariant) with run + admin metadata
   */
  async getHistoricalRunsForUser(
    userId: string,
    currentAdminDateStart: Date,
    taskIds: string[],
  ): Promise<HistoricalRunRow[]> {
    if (taskIds.length === 0) return [];

    const rows = await this.db
      .select({
        runId: fdwRuns.id,
        userId: fdwRuns.userId,
        taskId: fdwRuns.taskId,
        taskVariantId: fdwRuns.taskVariantId,
        administrationId: fdwRuns.administrationId,
        administrationName: administrations.name,
        administrationDateStart: administrations.dateStart,
        completedAt: fdwRuns.completedAt,
        reliableRun: fdwRuns.reliableRun,
        engagementFlags: fdwRuns.engagementFlags,
      })
      .from(fdwRuns)
      .innerJoin(administrations, eq(fdwRuns.administrationId, administrations.id))
      .where(
        and(
          eq(fdwRuns.userId, userId),
          inArray(fdwRuns.taskId, taskIds),
          lte(administrations.dateStart, currentAdminDateStart),
          isNull(fdwRuns.deletedAt),
          isNull(fdwRuns.abortedAt),
          eq(fdwRuns.useForReporting, true),
          isNotNull(fdwRuns.completedAt),
        ),
      );

    return rows.map((r) => ({
      runId: r.runId,
      userId: r.userId,
      taskId: r.taskId,
      taskVariantId: r.taskVariantId,
      administrationId: r.administrationId,
      administrationName: r.administrationName,
      administrationDateStart: r.administrationDateStart,
      completedAt: r.completedAt!,
      reliableRun: r.reliableRun,
      engagementFlags: Array.isArray(r.engagementFlags) ? (r.engagementFlags as string[]) : [],
    }));
  }

  /**
   * Bulk fetch run-level metadata for one student's completed runs in one
   * administration, restricted to a list of task variants.
   *
   * Returns the run id plus the fields the individual-student-report endpoint
   * surfaces alongside scores: `reliable` (from `reliableRun`),
   * `engagementFlags`, and `completedAt`. The companion `getCompletedRunScores`
   * method returns the score values; together they let the service assemble
   * the per-task entry without losing run-level signals.
   *
   * Multiple completed runs per (user, variant) are not deduplicated here —
   * the service is responsible for picking one (typically the most recent).
   * The same `useForReporting=true` invariant documented on
   * `getCompletedRunScores` applies: the assessment side guarantees at most
   * one such run per (user, variant) in practice.
   *
   * Filters mirror `getCompletedRunScores`: completed runs only
   * (`completedAt IS NOT NULL`), non-aborted, non-deleted, reporting-eligible.
   */
  async getCompletedRunsForUser(
    administrationId: string,
    userId: string,
    taskVariantIds: string[],
  ): Promise<
    Array<{
      runId: string;
      taskVariantId: string;
      reliable: boolean | null;
      engagementFlags: string[];
      completedAt: Date;
    }>
  > {
    if (taskVariantIds.length === 0) return [];

    const rows = await this.db
      .select({
        runId: fdwRuns.id,
        taskVariantId: fdwRuns.taskVariantId,
        reliableRun: fdwRuns.reliableRun,
        engagementFlags: fdwRuns.engagementFlags,
        completedAt: fdwRuns.completedAt,
      })
      .from(fdwRuns)
      .where(
        and(
          eq(fdwRuns.administrationId, administrationId),
          eq(fdwRuns.userId, userId),
          inArray(fdwRuns.taskVariantId, taskVariantIds),
          isNull(fdwRuns.deletedAt),
          isNull(fdwRuns.abortedAt),
          eq(fdwRuns.useForReporting, true),
          isNotNull(fdwRuns.completedAt),
        ),
      );

    return rows.map((r) => ({
      runId: r.runId,
      taskVariantId: r.taskVariantId,
      reliable: r.reliableRun,
      engagementFlags: Array.isArray(r.engagementFlags) ? (r.engagementFlags as string[]) : [],
      completedAt: r.completedAt!,
    }));
  }

  /**
   * Bulk fetch all run_scores rows for the given run IDs.
   *
   * Companion to `getHistoricalRunsForUser` — the service uses this to attach
   * scores to historical entries. Returns raw `(runId, scoreName, scoreValue)`
   * triples; the service is responsible for resolving them via
   * `resolveScoreFieldNames` against the run's task slug + scoring version.
   *
   * Splitting from the runs query (rather than a single JOIN) keeps the row
   * count proportional to (runs × scoresPerRun) only when scores actually
   * exist, and lets the service short-circuit when no historical runs exist.
   */
  async getScoresForRunIds(runIds: string[]): Promise<Array<{ runId: string; scoreName: string; scoreValue: string }>> {
    if (runIds.length === 0) return [];

    const rows = await this.db
      .select({
        runId: fdwRunScores.runId,
        scoreName: fdwRunScores.name,
        scoreValue: fdwRunScores.value,
      })
      .from(fdwRunScores)
      .where(inArray(fdwRunScores.runId, runIds));

    return rows;
  }

  /**
   * Verify that a guardian user is currently linked to a target student via
   * the `user_families` junction table.
   *
   * The guardian must hold `role='parent'` and the student must hold
   * `role='child'` in the same family, both with active membership
   * (`isActiveInFamily`), and the family must not have its rostering ended.
   *
   * Used by the guardian student report to authorize access without leaking
   * whether the guardian is generally a parent in the system or whether the
   * student exists — both ambiguous cases collapse to a single boolean.
   *
   * @param guardianUserId - The user requesting access (must hold role='parent')
   * @param studentUserId - The target student user (must hold role='child')
   * @returns `true` only when an active parent-child link exists in the same family
   */
  async verifyGuardianStudentLink(guardianUserId: string, studentUserId: string): Promise<boolean> {
    const parentMembership = alias(userFamilies, 'parent_uf');
    const childMembership = alias(userFamilies, 'child_uf');

    const rows = await this.db
      .select({ familyId: parentMembership.familyId })
      .from(parentMembership)
      .innerJoin(childMembership, eq(parentMembership.familyId, childMembership.familyId))
      .innerJoin(families, eq(parentMembership.familyId, families.id))
      .where(
        and(
          eq(parentMembership.userId, guardianUserId),
          eq(parentMembership.role, 'parent'),
          isActiveInFamily(parentMembership),
          eq(childMembership.userId, studentUserId),
          eq(childMembership.role, 'child'),
          isActiveInFamily(childMembership),
          isNull(families.rosteringEnded),
        ),
      )
      .limit(1);

    return rows.length > 0;
  }

  /**
   * Verify that a supervisory user shares an org/class/group scope with the
   * target student (the "org-overlap guard" for the guardian student report).
   *
   * Returns `true` if any of the following overlaps exist:
   * - Supervisor has any of `supervisorRoles` on an org whose ltree path is
   *   an ancestor (or equal to) one of the student's effective paths
   *   (the student's own user_orgs paths or the orgPath of a class the
   *   student is in).
   * - Supervisor has any of `supervisorRoles` directly on a class the
   *   student is also in.
   * - Supervisor has any of `supervisorRoles` directly on a group the
   *   student is also in.
   *
   * All memberships must be currently active and the underlying entities
   * must not have rostering ended.
   *
   * @param supervisorUserId - The user requesting access
   * @param studentUserId - The target student
   * @param supervisorRoles - Allowlist of roles for the supervisor side
   * @returns `true` when overlap exists, `false` otherwise
   */
  async verifyUserOrgOverlap(
    supervisorUserId: string,
    studentUserId: string,
    supervisorRoles: ReadonlyArray<UserRole>,
  ): Promise<boolean> {
    if (supervisorRoles.length === 0) return false;

    // Composite role-list literal for embedding in IN (...) clauses below.
    // `sql.join` on enum values is parameterized by the driver; the enum
    // values themselves are typed (`UserRole`) so there's no injection
    // surface to worry about.
    const roleList = sql.join(
      supervisorRoles.map((r) => sql`${r}`),
      sql`, `,
    );

    // One round-trip across all three overlap paths. PostgreSQL's planner
    // short-circuits the OR/EXISTS chain once any branch matches, so this
    // is no slower than the previous chained-Drizzle implementation in the
    // happy path and is one round-trip cheaper in the no-overlap path.
    const result = await this.db.execute<{ ok: number }>(sql`
      SELECT 1 AS ok
      WHERE
        -- Path 1: supervisor's user_orgs path contains a student effective path
        EXISTS (
          SELECT 1
          FROM ${userOrgs} sup_uo
          INNER JOIN ${orgs} sup_org ON sup_uo.org_id = sup_org.id
          WHERE sup_uo.user_id = ${supervisorUserId}
            AND sup_uo.role IN (${roleList})
            AND sup_uo.enrollment_start <= NOW()
            AND (sup_uo.enrollment_end IS NULL OR sup_uo.enrollment_end > NOW())
            AND sup_org.rostering_ended IS NULL
            AND (
              EXISTS (
                SELECT 1 FROM ${userOrgs} stu_uo
                INNER JOIN ${orgs} stu_org ON stu_uo.org_id = stu_org.id
                WHERE stu_uo.user_id = ${studentUserId}
                  AND stu_uo.role = ${UserRole.STUDENT}
                  AND stu_uo.enrollment_start <= NOW()
                  AND (stu_uo.enrollment_end IS NULL OR stu_uo.enrollment_end > NOW())
                  AND stu_org.rostering_ended IS NULL
                  AND stu_org.path <@ sup_org.path
              )
              OR EXISTS (
                SELECT 1 FROM ${userClasses} stu_uc
                INNER JOIN ${classes} stu_cls ON stu_uc.class_id = stu_cls.id
                WHERE stu_uc.user_id = ${studentUserId}
                  AND stu_uc.role = ${UserRole.STUDENT}
                  AND stu_uc.enrollment_start <= NOW()
                  AND (stu_uc.enrollment_end IS NULL OR stu_uc.enrollment_end > NOW())
                  AND stu_cls.rostering_ended IS NULL
                  AND stu_cls.org_path <@ sup_org.path
              )
            )
        )
        OR
        -- Path 2: supervisor and student share a class directly.
        EXISTS (
          SELECT 1
          FROM ${userClasses} sup_uc
          INNER JOIN ${classes} c ON sup_uc.class_id = c.id
          INNER JOIN ${userClasses} stu_uc
            ON stu_uc.class_id = sup_uc.class_id
            AND stu_uc.user_id = ${studentUserId}
          WHERE sup_uc.user_id = ${supervisorUserId}
            AND sup_uc.role IN (${roleList})
            AND sup_uc.enrollment_start <= NOW()
            AND (sup_uc.enrollment_end IS NULL OR sup_uc.enrollment_end > NOW())
            AND stu_uc.role = ${UserRole.STUDENT}
            AND stu_uc.enrollment_start <= NOW()
            AND (stu_uc.enrollment_end IS NULL OR stu_uc.enrollment_end > NOW())
            AND c.rostering_ended IS NULL
        )
        OR
        -- Path 3: supervisor and student share a group directly.
        EXISTS (
          SELECT 1
          FROM ${userGroups} sup_ug
          INNER JOIN ${groups} g ON sup_ug.group_id = g.id
          INNER JOIN ${userGroups} stu_ug
            ON stu_ug.group_id = sup_ug.group_id
            AND stu_ug.user_id = ${studentUserId}
          WHERE sup_ug.user_id = ${supervisorUserId}
            AND sup_ug.role IN (${roleList})
            AND sup_ug.enrollment_start <= NOW()
            AND (sup_ug.enrollment_end IS NULL OR sup_ug.enrollment_end > NOW())
            AND stu_ug.role = ${UserRole.STUDENT}
            AND stu_ug.enrollment_start <= NOW()
            AND (stu_ug.enrollment_end IS NULL OR stu_ug.enrollment_end > NOW())
            AND g.rostering_ended IS NULL
        )
      LIMIT 1
    `);

    return result.rows.length > 0;
  }

  /**
   * Fetch the set of administrations a student is connected to — either by
   * having started a run in `app_assessment_fdw.runs`, or by remaining
   * actively assigned via their org / class / group memberships.
   *
   * The four contributing paths are:
   * - **Runs:** any administration the student has a non-deleted run in.
   * - **Org assignment:** any administration assigned at an org whose
   *   ltree `path` is an ancestor (or equal to) one of the student's
   *   effective paths — their `user_orgs` orgs or the `orgPath` of a class
   *   they're enrolled in.
   * - **Class assignment:** any administration assigned directly at a
   *   class the student is enrolled in.
   * - **Group assignment:** any administration assigned directly at a
   *   group the student is in.
   *
   * Results are deduplicated via the `selectDistinct` and ordered by
   * `dateStart` ascending so the service can render `administrations`
   * chronologically without an additional sort.
   *
   * @param studentUserId - The target student
   * @returns Administrations the student is connected to, oldest first
   */
  async getStudentAdministrations(studentUserId: string): Promise<StudentAdministrationRow[]> {
    const rows = await this.db
      .selectDistinct({
        id: administrations.id,
        name: administrations.name,
        dateStart: administrations.dateStart,
        dateEnd: administrations.dateEnd,
      })
      .from(administrations)
      .where(
        // The administrations table has no soft-delete column; existence
        // alone is enough to consider an admin in scope here. We still
        // filter the FDW runs by `r.deleted_at IS NULL` in path A so that
        // soft-deleted runs don't pull dead administrations into the result.
        or(
          // Path A: student has a run in this admin
          sql`EXISTS (
            SELECT 1 FROM ${fdwRuns} r
            WHERE r.administration_id = ${administrations.id}
              AND r.user_id = ${studentUserId}
              AND r.deleted_at IS NULL
          )`,
          // Path B: org-assignment whose path contains a student effective path
          sql`EXISTS (
            SELECT 1
            FROM ${administrationOrgs} ao
            INNER JOIN ${orgs} ao_org ON ao.org_id = ao_org.id
            WHERE ao.administration_id = ${administrations.id}
              AND ao_org.rostering_ended IS NULL
              AND (
                EXISTS (
                  SELECT 1 FROM ${userOrgs} stu_uo
                  INNER JOIN ${orgs} stu_org ON stu_uo.org_id = stu_org.id
                  WHERE stu_uo.user_id = ${studentUserId}
                    AND stu_uo.role = ${UserRole.STUDENT}
                    AND stu_uo.enrollment_start <= NOW()
                    AND (stu_uo.enrollment_end IS NULL OR stu_uo.enrollment_end > NOW())
                    AND stu_org.rostering_ended IS NULL
                    AND stu_org.path <@ ao_org.path
                )
                OR EXISTS (
                  SELECT 1 FROM ${userClasses} stu_uc
                  INNER JOIN ${classes} stu_cls ON stu_uc.class_id = stu_cls.id
                  WHERE stu_uc.user_id = ${studentUserId}
                    AND stu_uc.role = ${UserRole.STUDENT}
                    AND stu_uc.enrollment_start <= NOW()
                    AND (stu_uc.enrollment_end IS NULL OR stu_uc.enrollment_end > NOW())
                    AND stu_cls.rostering_ended IS NULL
                    AND stu_cls.org_path <@ ao_org.path
                )
              )
          )`,
          // Path C: admin assigned at a class the student is in
          sql`EXISTS (
            SELECT 1
            FROM ${administrationClasses} ac
            INNER JOIN ${userClasses} uc ON ac.class_id = uc.class_id
            INNER JOIN ${classes} c ON ac.class_id = c.id
            WHERE ac.administration_id = ${administrations.id}
              AND uc.user_id = ${studentUserId}
              AND uc.role = ${UserRole.STUDENT}
              AND uc.enrollment_start <= NOW()
              AND (uc.enrollment_end IS NULL OR uc.enrollment_end > NOW())
              AND c.rostering_ended IS NULL
          )`,
          // Path D: admin assigned at a group the student is in
          sql`EXISTS (
            SELECT 1
            FROM ${administrationGroups} ag
            INNER JOIN ${userGroups} ug ON ag.group_id = ug.group_id
            INNER JOIN ${groups} g ON ag.group_id = g.id
            WHERE ag.administration_id = ${administrations.id}
              AND ug.user_id = ${studentUserId}
              AND ug.role = ${UserRole.STUDENT}
              AND ug.enrollment_start <= NOW()
              AND (ug.enrollment_end IS NULL OR ug.enrollment_end > NOW())
              AND g.rostering_ended IS NULL
          )`,
        ),
      )
      .orderBy(asc(administrations.dateStart), asc(administrations.id));

    return rows;
  }
}

// --- SQL emission helpers for the student-scores query (top-level utilities) ---

/**
 * Emit SQL that coerces a text grade column to a numeric grade level.
 *
 * Strips every non-digit character before casting to integer:
 *   `'Kindergarten'` → NULL, `'3'` → 3, `'12'` → 12, `'K-3'` → 3 (the digit only).
 *
 * Negative grades are not part of any roster convention we currently support, so
 * the regex deliberately excludes `-` — keeping it would let `'K-3'` parse as
 * `-3`, which would silently mis-classify scoring config branches that compare
 * grade against `percentileBelowGrade` (e.g., grade < 6 → percentile path).
 */
function gradeAsIntSql(gradeColumn: SQL | Column | PgColumn): SQL {
  return sql`CAST(NULLIF(REGEXP_REPLACE(${gradeColumn}::text, '[^0-9]', '', 'g'), '') AS INTEGER)`;
}

/**
 * Emit SQL that strips non-numeric characters from a text score value and casts
 * to NUMERIC. Handles angle-bracket strings like `'>99'` (→ 99) and `'<1'` (→ 1).
 * Used for percentile/rawScore/standardScore values stored as text in run_scores.
 */
function numericValueSql(valueExpr: SQL | Column): SQL {
  return sql`CAST(NULLIF(REGEXP_REPLACE(${valueExpr}, '[^0-9.-]', '', 'g'), '') AS NUMERIC)`;
}

/**
 * Emit SQL CASE returning support-level priority for a single variant.
 *
 * Priority mapping: 3 = achievedSkill, 2 = developingSkill, 1 = needsExtraSupport,
 * NULL = unclassified (no scores, no config, classification.type === 'none', or
 * thresholds/cutoffs unavailable for the resolved scoring version).
 *
 * For percentile-then-rawscore tasks, the CASE evaluates percentile cutoffs when
 * the student's grade is below `percentileBelowGrade`, otherwise raw-score
 * thresholds. Cutoffs/thresholds are emitted as numeric literals from the
 * pre-resolved `ResolvedScoringRules` so the repository stays decoupled from
 * the scoring service.
 *
 * @param rules - Pre-resolved scoring rules for the variant
 * @param gradeIntSql - SQL expression evaluating to the student's numeric grade
 * @param pctSql - SQL expression evaluating to the student's percentile (or null if no percentile join)
 * @param rawSql - SQL expression evaluating to the student's raw score (or null if no raw-score join)
 * @returns CASE expression returning priority integer or NULL — null when no rules apply
 */
function buildSupportLevelPrioritySql(
  rules: ResolvedScoringRules,
  gradeIntSql: SQL,
  pctSql: SQL | null,
  rawSql: SQL | null,
): SQL | null {
  const pct = rules.percentileCutoffs;
  const raw = rules.rawScoreThresholds;
  if (!pct && !raw) return null;

  const branches: SQL[] = [];

  if (pct && pctSql) {
    const gradeGate =
      rules.percentileBelowGrade !== null
        ? sql`AND (${gradeIntSql}) IS NOT NULL AND (${gradeIntSql}) < ${rules.percentileBelowGrade}`
        : sql``;
    branches.push(sql`WHEN ${pctSql} IS NOT NULL ${gradeGate} THEN
      CASE
        WHEN ${pctSql} >= ${pct.achieved} THEN 3
        WHEN ${pctSql} >= ${pct.developing} THEN 2
        ELSE 1
      END`);
  }
  if (raw && rawSql) {
    branches.push(sql`WHEN ${rawSql} IS NOT NULL THEN
      CASE
        WHEN ${rawSql} >= ${raw.above} THEN 3
        WHEN ${rawSql} >= ${raw.some} THEN 2
        ELSE 1
      END`);
  }

  if (branches.length === 0) return null;

  return sql`CASE ${sql.join(branches, sql` `)} ELSE NULL::integer END`;
}

/**
 * Build a SQL WHERE condition from a value expression + operator + values list.
 *
 * For numeric fields, values are cast to numeric. For supportLevel, the value
 * expression already returns a priority integer and the values are priority
 * strings (e.g., `'3'`) — they cast to integer via the same numeric path.
 *
 * Returns undefined for empty value lists (no-op filter).
 */
function buildScoreFieldFilterCondition(
  valueExpr: SQL,
  operator: StudentScoresFilterOperator,
  values: string[],
): SQL | undefined {
  if (values.length === 0) return undefined;
  const numericValues = values.map((v) => Number(v)).filter((n) => !isNaN(n));

  switch (operator) {
    case 'eq':
      return numericValues[0] !== undefined ? sql`${valueExpr} = ${numericValues[0]}` : undefined;
    case 'neq':
      return numericValues[0] !== undefined ? sql`${valueExpr} <> ${numericValues[0]}` : undefined;
    case 'gte':
      return numericValues[0] !== undefined ? sql`${valueExpr} >= ${numericValues[0]}` : undefined;
    case 'lte':
      return numericValues[0] !== undefined ? sql`${valueExpr} <= ${numericValues[0]}` : undefined;
    case 'in':
      return numericValues.length > 0
        ? sql`${valueExpr} IN (${sql.join(
            numericValues.map((n) => sql`${n}`),
            sql`, `,
          )})`
        : undefined;
    default:
      // Exhaustiveness check — adding a new StudentScoresFilterOperator without
      // updating this switch will fail compilation here. The runtime fallback
      // is also a defensive guard against unsupported operators (e.g., `contains`
      // is valid for user-level fields but not for score fields).
      return assertUnreachableOperator(operator);
  }
}

/**
 * Compile-time exhaustiveness check used by `buildScoreFieldFilterCondition`'s
 * default branch. Adding a new `StudentScoresFilterOperator` value will produce
 * a TypeScript error at the call site if this switch isn't extended. At runtime
 * the function returns `undefined` (no-op filter) — defensive but visible.
 */
function assertUnreachableOperator(op: never): undefined {
  // Intentionally swallow the unknown operator at runtime — the TypeScript
  // narrowing above already prevents this branch in normal code paths.
  void op;
  return undefined;
}
