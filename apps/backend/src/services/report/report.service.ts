import { StatusCodes } from 'http-status-codes';
import type { Column } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';
import type {
  ScopeType,
  ProgressStudentsInput,
  ProgressStudentsSortField,
  ProgressStudentsFilterField,
  ServiceTaskMetadata,
  ServiceProgressStudent,
  ServiceProgressEntry,
  ProgressStudentsResult,
  ProgressOverviewInput,
  ProgressOverviewResult,
  ServiceTaskOverview,
  ScoreOverviewInput,
  ScoreOverviewResult,
  ServiceTaskScoreOverview,
  StudentScoresInput,
  StudentScoresSortField,
  StudentScoresFilterField,
  StudentScoresResult,
  ServiceStudentScoreRow,
  ServiceStudentScoreEntry,
  ServiceSupportLevelValue,
  IndividualStudentReportInput,
  IndividualStudentReportResult,
  ServiceIndividualStudentReportTask,
  ServiceTaskScores,
  ServiceSubscoreEntry,
  ServiceHistoricalScore,
  ServiceTaskTag,
  ParsedFilter,
} from './report.types';
import { PROGRESS_TASK_STATUS_PATTERN, SCORE_TASK_FIELD_PATTERN } from '@roar-dashboard/api-contract';
import { PROGRESS_STATUS_PRIORITY } from '../../constants/progress-status';
import { buildFilterConditions } from '../../utils/build-filter-conditions.util';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { ApiErrorMessage } from '../../enums/api-error-message.enum';
import { ApiError } from '../../errors/api-error';
import { logger } from '../../logger';
import { users } from '../../db/schema';
import { EntityType } from '../../types/entity-type';
import { AdministrationService } from '../administration/administration.service';
import { ReportRepository, REPORT_CONDITION_FIELD_MAP } from '../../repositories/report.repository';
import type {
  ReportTaskMeta,
  StudentProgressRow,
  StudentOverviewRow,
  RunScoreRow,
  ProgressStatusSortParam,
  ProgressStatusFilterParam,
  StudentScoresFieldRef,
  StudentScoresFieldFilter,
  StudentScoresFilterOperator,
  StudentScoresFieldType,
  StudentScoreQueryRow,
  ResolvedScoringRules,
  HistoricalRunRow,
} from '../../repositories/report.repository';
import { TaskService } from '../task/task.service';
import { AuthorizationService } from '../authorization/authorization.service';
import { FgaType, FgaRelation } from '../authorization/fga-constants';
import { TaskVariantParameterRepository } from '../../repositories/task-variant-parameter.repository';
import {
  getScoringConfig,
  getSubscoresConfig,
  getSupportLevel,
  parseScoreValue,
  resolveScoreFieldNames,
  PA_SKILL_THRESHOLD,
  PA_SKILL_LEGACY_THRESHOLD,
  PA_SUBTASK_KEYS,
} from '../scoring';
import { UserRepository } from '../../repositories/user.repository';
import { getGradeAsNumber } from '../../utils/get-grade-as-number.util';
import { conditionToSql } from '../../utils/condition-to-sql';
import type { Condition, ConditionEvaluationUser } from '../../types/condition';
import type { AuthContext } from '../../types/auth-context';

/** Map sortBy field strings to Drizzle column references for progress students. */
const PROGRESS_SORT_COLUMNS: Record<ProgressStudentsSortField, Column> = {
  'user.lastName': users.nameLast,
  'user.firstName': users.nameFirst,
  'user.username': users.username,
  'user.grade': users.grade,
};

/** Map filter field strings to Drizzle column references for progress students. */
const PROGRESS_FILTER_FIELDS: Record<ProgressStudentsFilterField, PgColumn> = {
  'user.grade': users.grade,
  'user.firstName': users.nameFirst,
  'user.lastName': users.nameLast,
  'user.username': users.username,
  'user.email': users.email,
};

/** Fields that use grade-aware numeric ordering for gte/lte comparisons. */
const GRADE_AWARE_FIELDS: ReadonlySet<string> = new Set(['user.grade']);

/**
 * Map filter field strings to Drizzle column references for score overview.
 * Only includes user-level fields that can be applied as SQL WHERE conditions.
 * `taskId` is handled separately in the service layer (it filters task metadata,
 * not student rows).
 */
const SCORE_OVERVIEW_USER_FILTER_FIELDS: Record<string, PgColumn> = {
  'user.grade': users.grade,
};

/**
 * Map sortBy field strings to Drizzle column references for student scores.
 *
 * `user.schoolName` is intentionally excluded — it has no direct column to
 * point at (the value is a correlated subquery built inside the repository).
 * The service routes that case explicitly before consulting this map, and the
 * type omits it so any accidental lookup fails at compile time rather than
 * silently falling back to a wrong column.
 */
const STUDENT_SCORES_SORT_COLUMNS: Record<Exclude<StudentScoresSortField, 'user.schoolName'>, Column> = {
  'user.lastName': users.nameLast,
  'user.firstName': users.nameFirst,
  'user.username': users.username,
  'user.grade': users.grade,
};

/**
 * Map static filter field strings to Drizzle column references for student scores.
 * `user.schoolName` is filterable via ILIKE in district scope; the column reference
 * is `orgs.name` joined indirectly via user_orgs — represented as a sentinel here
 * because buildFilterConditions can't directly express a correlated lookup.
 * Currently we only support exact-match user-level filters in SQL; schoolName
 * filtering is delegated to the repository's own correlated subquery.
 */
const STUDENT_SCORES_USER_FILTER_FIELDS: Record<Exclude<StudentScoresFilterField, 'user.schoolName'>, PgColumn> = {
  'user.grade': users.grade,
  'user.firstName': users.nameFirst,
  'user.lastName': users.nameLast,
  'user.username': users.username,
  'user.email': users.email,
};

/** Per-task status counters for progress overview aggregation (7-level). */
interface TaskStatusCounter {
  'assigned-required': number;
  'assigned-optional': number;
  'started-required': number;
  'started-optional': number;
  'completed-required': number;
  'completed-optional': number;
}

/**
 * ReportService
 *
 * Provides business logic for reporting endpoints.
 * Handles authorization, scope validation, and data assembly for reports.
 *
 * @param params - Configuration object with repository instances (optional)
 * @returns ReportService methods
 */
export function ReportService({
  administrationService = AdministrationService(),
  reportRepository = new ReportRepository(),
  taskService = TaskService(),
  authorizationService = AuthorizationService(),
  taskVariantParameterRepository = new TaskVariantParameterRepository(),
  userRepository = new UserRepository(),
}: {
  administrationService?: ReturnType<typeof AdministrationService>;
  reportRepository?: ReportRepository;
  taskService?: ReturnType<typeof TaskService>;
  authorizationService?: ReturnType<typeof AuthorizationService>;
  taskVariantParameterRepository?: TaskVariantParameterRepository;
  userRepository?: UserRepository;
} = {}) {
  /** Map report scope types to FGA object type prefixes. */
  const SCOPE_TO_FGA_TYPE: Record<ScopeType, FgaType> = {
    [EntityType.DISTRICT]: FgaType.DISTRICT,
    [EntityType.SCHOOL]: FgaType.SCHOOL,
    [EntityType.CLASS]: FgaType.CLASS,
    [EntityType.GROUP]: FgaType.GROUP,
  };

  /**
   * Validate scope and authorize the user to access data at the requested scope level.
   *
   * Checks:
   * 1. The scope entity is assigned to the administration (business rule)
   * 2. FGA grants the requested relation on the scope entity (default: can_read_progress)
   *
   * The FGA model defines `can_read_progress` and `can_read_scores` as
   * `supervisory_tier_group` on all scope types (district, school, class, group).
   * FGA's hierarchy relations handle ancestor visibility: a district admin's
   * membership propagates to child schools and classes, so a permission check
   * on a school passes if the user has a supervisory role at the school's
   * parent district.
   *
   * @param authContext - User's auth context
   * @param administrationId - The administration ID
   * @param scopeType - The scope type (district, school, class, group)
   * @param scopeId - The scope entity ID
   * @param relation - The FGA relation to check (defaults to CAN_READ_PROGRESS)
   * @throws {ApiError} BAD_REQUEST if scope is not assigned to the administration
   * @throws {ApiError} FORBIDDEN if user lacks the requested relation on the scope entity
   */
  async function authorizeScopeAccess(
    authContext: AuthContext,
    administrationId: string,
    scopeType: ScopeType,
    scopeId: string,
    relation: FgaRelation = FgaRelation.CAN_READ_PROGRESS,
  ) {
    const { userId, isSuperAdmin } = authContext;

    // Validate scope is assigned to the administration (business rule, not authorization)
    const isAssigned = await reportRepository.isScopeAssignedToAdministration(administrationId, {
      scopeType,
      scopeId,
    });
    if (!isAssigned) {
      throw new ApiError('Scope entity is not assigned to this administration', {
        statusCode: StatusCodes.BAD_REQUEST,
        code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
        context: { userId, administrationId, scopeType, scopeId },
      });
    }

    // Super admins bypass scope authorization
    if (isSuperAdmin) return;

    // Verify user has the requested permission on the scope entity via FGA
    const fgaType = SCOPE_TO_FGA_TYPE[scopeType];
    await authorizationService.requirePermission(userId, relation, `${fgaType}:${scopeId}`);
  }

  /**
   * List paginated student progress for an administration.
   *
   * Authorization flow (two FGA checks, in order):
   *
   * 1. **Administration progress access** (AdministrationService.verifyAdministrationAccess
   *    with `CAN_READ_PROGRESS`):
   *    Checks existence (404 before 403) then verifies `can_read_progress` on the
   *    administration via FGA. This replaces the old 3-step pattern (administration
   *    access → Reports.Progress.READ → hasSupervisoryRole) with a single call.
   *    `can_read_progress: supervisory_tier_group` in the FGA model grants access
   *    only to admin-tier and educator-tier roles, denying students and caregivers.
   *
   * 2. **Scope-level authorization** (authorizeScopeAccess):
   *    Validates the scope is assigned to the administration (business rule), then
   *    checks `can_read_progress` on the scope entity (district/school/class/group)
   *    via FGA. This prevents e.g., a teacher at School A from viewing School B's
   *    report within a shared district administration.
   *
   * @param authContext - User's auth context
   * @param administrationId - The administration to report on
   * @param query - Query parameters (scope, filters, pagination, sort)
   * @returns Task metadata and paginated student progress rows
   * @throws {ApiError} NOT_FOUND if administration doesn't exist
   * @throws {ApiError} FORBIDDEN if user lacks access or permission
   * @throws {ApiError} BAD_REQUEST if scope is invalid
   */
  async function listProgressStudents(
    authContext: AuthContext,
    administrationId: string,
    query: ProgressStudentsInput,
  ): Promise<ProgressStudentsResult> {
    const { userId } = authContext;
    const { scopeType, scopeId, page, perPage, sortBy, sortOrder, filter } = query;

    try {
      // 1. Verify administration exists and user has can_read_progress
      await administrationService.verifyAdministrationAccess(
        authContext,
        administrationId,
        FgaRelation.CAN_READ_PROGRESS,
      );

      // 2. Validate scope and authorize can_read_progress on the scope entity
      await authorizeScopeAccess(authContext, administrationId, scopeType, scopeId);

      // 3. Get task metadata
      const taskMetas = await reportRepository.getTaskMetadata(administrationId);
      const taskVariantIds = taskMetas.map((t) => t.taskVariantId);

      // 4. Resolve sort column, progress sort, user filters, and progress filters.
      const { sortColumn, progressStatusSort } = resolveProgressSort(sortBy, taskMetas);
      const { userFilters, progressStatusFilters } = resolveProgressFilters(filter, taskMetas);

      const filterCondition =
        userFilters.length > 0
          ? buildFilterConditions(userFilters, PROGRESS_FILTER_FIELDS, { gradeAwareFields: GRADE_AWARE_FIELDS })
          : undefined;

      // 5. Get paginated students with run data.
      // Progress status sort/filter is handled via LEFT JOIN + CASE in the repository.
      const result = await reportRepository.getProgressStudents(
        administrationId,
        { scopeType, scopeId },
        taskVariantIds,
        { page, perPage, sortColumn, sortDirection: sortOrder },
        filterCondition,
        progressStatusSort ?? undefined,
        progressStatusFilters.length > 0 ? progressStatusFilters : undefined,
      );

      // 6. Transform to response shape
      const tasks: ServiceTaskMetadata[] = taskMetas.map((t) => ({
        taskId: t.taskId,
        taskSlug: t.taskSlug,
        taskName: t.taskName,
        orderIndex: t.orderIndex,
      }));

      const items: ServiceProgressStudent[] = result.items.map((student) => ({
        user: {
          userId: student.userId,
          assessmentPid: student.assessmentPid,
          username: student.username,
          email: student.email,
          firstName: student.nameFirst,
          lastName: student.nameLast,
          grade: student.grade,
          schoolName: scopeType === EntityType.DISTRICT ? (student.schoolName ?? null) : null,
        },
        progress: buildProgressMap(student, taskMetas, taskService.evaluateTaskVariantEligibility),
      }));

      // totalItems reflects the DB student count, not post-condition-evaluation count.
      // Students with an empty progress map (all tasks excluded by conditionsAssignment)
      // are intentionally included — they are enrolled in the scope and the empty row is
      // meaningful to teachers. Excluding them would cause pagination instability.
      return { tasks, items, totalItems: result.totalItems };
    } catch (error) {
      if (error instanceof ApiError) throw error;

      logger.error(
        { err: error, context: { userId, administrationId, scopeType, scopeId } },
        'Failed to retrieve progress students report',
      );

      throw new ApiError('Failed to retrieve progress report', {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
        context: { userId, administrationId },
        cause: error,
      });
    }
  }

  /**
   * Get aggregated completion statistics for each task in an administration.
   *
   * Returns per-task breakdowns of assigned, started, completed, and optional counts,
   * plus aggregate totals. Powers the summary counts at the top of the progress report page.
   *
   * Authorization flow is identical to listProgressStudents (two FGA checks):
   * 1. Administration progress access (can_read_progress on administration)
   * 2. Scope-level authorization (can_read_progress on scope entity)
   *
   * Multi-variant dedup: when multiple variants share a taskId, each student is counted
   * once at their highest-priority status (completed > started > assigned > optional),
   * consistent with buildProgressMap.
   *
   * @param authContext - User's auth context
   * @param administrationId - The administration to report on
   * @param query - Query parameters (scopeType, scopeId)
   * @returns Aggregated completion statistics per task
   * @throws {ApiError} NOT_FOUND if administration doesn't exist
   * @throws {ApiError} FORBIDDEN if user lacks access or permission
   * @throws {ApiError} BAD_REQUEST if scope is invalid
   */
  async function getProgressOverview(
    authContext: AuthContext,
    administrationId: string,
    query: ProgressOverviewInput,
  ): Promise<ProgressOverviewResult> {
    const { userId } = authContext;
    const { scopeType, scopeId } = query;

    try {
      // 1. Verify administration exists and user has can_read_progress
      await administrationService.verifyAdministrationAccess(
        authContext,
        administrationId,
        FgaRelation.CAN_READ_PROGRESS,
      );

      // 2. Validate scope and authorize can_read_progress on the scope entity
      await authorizeScopeAccess(authContext, administrationId, scopeType, scopeId);

      // 3. Get task metadata and run SQL-level aggregation
      const taskMetas = await reportRepository.getTaskMetadata(administrationId);

      const { totalStudents, taskStatusCounts, studentCounts } = await reportRepository.getProgressOverviewCounts(
        administrationId,
        { scopeType, scopeId },
        taskMetas,
      );

      // 4. Build per-task counters from unique taskIds (preserving order from metadata)
      const taskIdOrder: string[] = [];
      const taskMetaByTaskId = new Map<string, ServiceTaskMetadata>();
      for (const t of taskMetas) {
        if (!taskMetaByTaskId.has(t.taskId)) {
          taskIdOrder.push(t.taskId);
          taskMetaByTaskId.set(t.taskId, {
            taskId: t.taskId,
            taskSlug: t.taskSlug,
            taskName: t.taskName,
            orderIndex: t.orderIndex,
          });
        }
      }

      // Initialize 7-level counters for all tasks (ensures tasks with zero counts appear)
      const taskStatusCounters = new Map<string, TaskStatusCounter>();
      for (const taskId of taskIdOrder) {
        taskStatusCounters.set(taskId, {
          'assigned-required': 0,
          'assigned-optional': 0,
          'started-required': 0,
          'started-optional': 0,
          'completed-required': 0,
          'completed-optional': 0,
        });
      }

      // 5. Populate counters from SQL aggregation results
      for (const { taskId, status, count } of taskStatusCounts) {
        const counters = taskStatusCounters.get(taskId);
        if (counters) {
          counters[status] += count;
        }
      }

      // 6. Assemble response with 7-level per-task counts and student-level assignment counts.
      const byTask: ServiceTaskOverview[] = taskIdOrder.map((taskId) => {
        const meta = taskMetaByTaskId.get(taskId)!;
        const c = taskStatusCounters.get(taskId)!;

        // Convenience totals by progress axis
        const assigned = c['assigned-required'] + c['assigned-optional'];
        const started = c['started-required'] + c['started-optional'];
        const completed = c['completed-required'] + c['completed-optional'];
        // Convenience totals by requirement axis
        const required = c['assigned-required'] + c['started-required'] + c['completed-required'];
        const optional = c['assigned-optional'] + c['started-optional'] + c['completed-optional'];

        return {
          taskId: meta.taskId,
          taskSlug: meta.taskSlug,
          taskName: meta.taskName,
          orderIndex: meta.orderIndex,
          assignedRequired: c['assigned-required'],
          assignedOptional: c['assigned-optional'],
          startedRequired: c['started-required'],
          startedOptional: c['started-optional'],
          completedRequired: c['completed-required'],
          completedOptional: c['completed-optional'],
          assigned,
          started,
          completed,
          required,
          optional,
        };
      });

      return {
        totalStudents,
        studentsWithRequiredTasks: studentCounts.studentsWithRequiredTasks,
        studentsAssigned: studentCounts.studentsAssigned,
        studentsStarted: studentCounts.studentsStarted,
        studentsCompleted: studentCounts.studentsCompleted,
        byTask,
        computedAt: new Date().toISOString(),
      };
    } catch (error) {
      if (error instanceof ApiError) throw error;

      logger.error(
        { err: error, context: { userId, administrationId, scopeType, scopeId } },
        'Failed to retrieve progress overview report',
      );

      throw new ApiError('Failed to retrieve progress overview', {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
        context: { userId, administrationId },
        cause: error,
      });
    }
  }

  /**
   * Get aggregated score overview for an administration.
   *
   * Returns per-task support level distributions (achievedSkill, developingSkill,
   * needsExtraSupport) with counts, plus totalAssessed and
   * totalNotAssessed (required/optional) counts.
   *
   * Authorization (two FGA checks, in order):
   *
   * 1. **Administration score-read access** (AdministrationService.verifyAdministrationAccess
   *    with `CAN_READ_SCORES`):
   *    Checks existence (404 before 403) then verifies `can_read_scores` on the
   *    administration via FGA. The FGA model grants this only to admin-tier and
   *    educator-tier roles, denying students and caregivers.
   *
   * 2. **Scope-level authorization** (authorizeScopeAccess with CAN_READ_SCORES):
   *    Validates the scope is assigned to the administration (business rule), then
   *    checks `can_read_scores` on the scope entity. This prevents e.g., a teacher
   *    at School A from viewing School B's score report within a shared district
   *    administration.
   *
   * Multi-variant dedup: when multiple variants share a taskId, each student is
   * counted once at the first variant that has completed run scores. Eligibility
   * for not-assessed counts is evaluated across all variants — a student is
   * "assigned" if ANY variant assigns them, "optional" only if ALL assigning
   * variants are optional.
   *
   * @param authContext - User's auth context
   * @param administrationId - The administration to report on
   * @param query - Query parameters (scope, filters)
   * @returns Score overview with per-task distributions
   * @throws {ApiError} NOT_FOUND if administration doesn't exist
   * @throws {ApiError} FORBIDDEN if user lacks can_read_scores
   * @throws {ApiError} BAD_REQUEST if scope is invalid
   */
  async function getScoreOverview(
    authContext: AuthContext,
    administrationId: string,
    query: ScoreOverviewInput,
  ): Promise<ScoreOverviewResult> {
    const { userId } = authContext;
    const { scopeType, scopeId, filter } = query;

    try {
      // 1. Verify administration exists and user has can_read_scores
      await administrationService.verifyAdministrationAccess(
        authContext,
        administrationId,
        FgaRelation.CAN_READ_SCORES,
      );

      // 2. Validate scope and authorize can_read_scores on the scope entity
      await authorizeScopeAccess(authContext, administrationId, scopeType, scopeId, FgaRelation.CAN_READ_SCORES);

      // 3. Get task metadata
      let taskMetas = await reportRepository.getTaskMetadata(administrationId);

      // 4. Extract taskId filters (if any) and user-level filters separately.
      // Multiple `taskId:in:...` filter entries are merged into a single allow-list —
      // a client passing `?filter=taskId:in:a,b&filter=taskId:in:c` should see all three.
      // Using filter().flatMap() rather than find() to avoid silently dropping later entries.
      const taskIdFilters = filter.filter((f) => f.field === 'taskId');
      if (taskIdFilters.length > 0) {
        const allowedTaskIds = new Set(taskIdFilters.flatMap((f) => f.value.split(',').map((v) => v.trim())));
        taskMetas = taskMetas.filter((t) => allowedTaskIds.has(t.taskId));
      }

      const userFilters = filter.filter((f) => f.field !== 'taskId');
      const filterCondition =
        userFilters.length > 0
          ? buildFilterConditions(userFilters, SCORE_OVERVIEW_USER_FILTER_FIELDS, {
              gradeAwareFields: GRADE_AWARE_FIELDS,
            })
          : undefined;

      // 5. Group variants by taskId for multi-variant deduplication.
      // Multiple variants can share a taskId (e.g., grade-specific variants).
      // Each student should be counted once per task at their best variant's score.
      // This is pure (no I/O), so derive it before any DB calls — when a taskId
      // filter eliminates every task we can short-circuit without touching the DB.
      const taskGroups = groupVariantsByTaskId(taskMetas);

      if (taskGroups.length === 0) {
        return {
          totalStudents: 0,
          tasks: [],
          computedAt: new Date().toISOString(),
        };
      }

      // 6. Get all students in scope (no pagination — overview aggregates the full population)
      const { totalStudents, students } = await reportRepository.getAllStudentsInScope(
        { scopeType, scopeId },
        filterCondition,
      );

      if (totalStudents === 0) {
        return {
          totalStudents,
          tasks: taskGroups.map(({ representative }) => buildEmptyTaskOverview(representative)),
          computedAt: new Date().toISOString(),
        };
      }

      // 7. Fetch scoring versions from task_variant_parameters
      const taskVariantIds = taskMetas.map((t) => t.taskVariantId);
      const allParams = await taskVariantParameterRepository.getByTaskVariantIds(taskVariantIds);
      const scoringVersionByVariant = new Map<string, number>();
      for (const param of allParams) {
        if (param.name === 'scoringVersion') {
          const version = typeof param.value === 'number' ? param.value : Number(param.value);
          if (!isNaN(version)) {
            scoringVersionByVariant.set(param.taskVariantId, version);
          }
        }
      }

      // 8. Bulk fetch completed run scores
      const studentIds = students.map((s) => s.userId);
      const scoreRows = await reportRepository.getCompletedRunScores(administrationId, studentIds, taskVariantIds);

      // Build a lookup: userId → taskVariantId → Map<scoreName, scoreValue>
      const scoresByStudentTask = buildScoreLookup(scoreRows);

      // 9. Aggregate per task (deduplicated across variants)
      const tasks: ServiceTaskScoreOverview[] = taskGroups.map(({ representative, variants }) =>
        aggregateTaskGroup(
          representative,
          variants,
          students,
          scoresByStudentTask,
          scoringVersionByVariant,
          taskService.evaluateTaskVariantEligibility,
        ),
      );

      return { totalStudents, tasks, computedAt: new Date().toISOString() };
    } catch (error) {
      if (error instanceof ApiError) throw error;

      logger.error(
        { err: error, context: { userId, administrationId, scopeType, scopeId } },
        'Failed to retrieve score overview',
      );

      throw new ApiError('Failed to retrieve score overview', {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
        context: { userId, administrationId, scopeType, scopeId },
        cause: error,
      });
    }
  }

  /**
   * List paginated per-student scores for an administration.
   *
   * Authorization (two FGA checks):
   * 1. `verifyAdministrationAccess` — administration-level can_read_scores
   * 2. `authorizeScopeAccess` with CAN_READ_SCORES — scope-level
   *
   * Sort and filter accept dynamic `scores.<taskId>.<field>` fields where
   * `<field>` is one of `rawScore`, `percentile`, `standardScore`, `supportLevel`.
   * The taskId is validated against the administration's tasks (400 if unknown).
   * For multi-variant tasks, dynamic sort/filter targets the lowest-orderIndex
   * variant of the task (the "primary variant") so SQL-level ordering remains
   * deterministic across pages.
   *
   * Per-row dedup: each task in the response has at most one score entry per
   * student. The service picks the first variant (in orderIndex order) with a
   * completed run for that student. Students with no completed run on any
   * variant of a task get `completed: false` and `supportLevel` either
   * `'optional'` (task optional for them) or `null` (assigned-required).
   *
   * @throws {ApiError} NOT_FOUND if administration doesn't exist
   * @throws {ApiError} FORBIDDEN if user lacks can_read_scores
   * @throws {ApiError} BAD_REQUEST if scope or sort/filter task ID is invalid
   */
  async function listStudentScores(
    authContext: AuthContext,
    administrationId: string,
    query: StudentScoresInput,
  ): Promise<StudentScoresResult> {
    const { userId } = authContext;
    const { scopeType, scopeId, page, perPage, sortBy, sortOrder, filter } = query;

    try {
      // 1. Authorization
      await administrationService.verifyAdministrationAccess(
        authContext,
        administrationId,
        FgaRelation.CAN_READ_SCORES,
      );
      await authorizeScopeAccess(authContext, administrationId, scopeType, scopeId, FgaRelation.CAN_READ_SCORES);

      // 2. Get task metadata and apply taskId filter (merge multiple entries)
      let taskMetas = await reportRepository.getTaskMetadata(administrationId);
      const taskIdFilters = filter.filter((f) => f.field === 'taskId');
      if (taskIdFilters.length > 0) {
        const allowedTaskIds = new Set(taskIdFilters.flatMap((f) => f.value.split(',').map((v) => v.trim())));
        taskMetas = taskMetas.filter((t) => allowedTaskIds.has(t.taskId));
      }

      // 3. Build per-task primary variant map (lowest-orderIndex variant of each task)
      const primaryVariantByTaskId = buildPrimaryVariantMap(taskMetas);

      // 4. Validate any dynamic score-field references in sort/filter BEFORE
      // any further DB call — bad task IDs should fail fast as 400, not get
      // silently swallowed into a 500 by a downstream failure.
      validateDynamicFieldTaskIds(sortBy, filter, primaryVariantByTaskId, taskMetas);

      // 5. Resolve scoring versions per variant
      const taskVariantIds = taskMetas.map((t) => t.taskVariantId);
      const allParams =
        taskVariantIds.length > 0 ? await taskVariantParameterRepository.getByTaskVariantIds(taskVariantIds) : [];
      const scoringVersionByVariant = new Map<string, number>();
      for (const param of allParams) {
        if (param.name === 'scoringVersion') {
          const version = typeof param.value === 'number' ? param.value : Number(param.value);
          if (!isNaN(version)) {
            scoringVersionByVariant.set(param.taskVariantId, version);
          }
        }
      }

      // 6. Resolve scoring rules per variant for SQL CASE generation in the repo
      const scoringRulesByVariant = new Map<string, ResolvedScoringRules>();
      for (const variant of taskMetas) {
        scoringRulesByVariant.set(
          variant.taskVariantId,
          resolveScoringRulesForVariant(variant.taskSlug, scoringVersionByVariant.get(variant.taskVariantId) ?? null),
        );
      }

      // 7. Resolve dynamic sort field (against primary variants)
      const sortField = resolveDynamicSortField(sortBy, primaryVariantByTaskId, scoringVersionByVariant);

      // 8. Resolve dynamic score-field filters (against primary variants)
      const userLevelFilters: ParsedFilter[] = [];
      const scoreFieldFilters: StudentScoresFieldFilter[] = [];
      for (const f of filter) {
        if (f.field === 'taskId') continue;
        if (SCORE_TASK_FIELD_PATTERN.test(f.field)) {
          const filterRef = resolveDynamicFilter(f, primaryVariantByTaskId, scoringVersionByVariant);
          if (filterRef) scoreFieldFilters.push(filterRef);
          continue;
        }
        userLevelFilters.push(f);
      }

      const filterCondition =
        userLevelFilters.length > 0
          ? buildFilterConditions(userLevelFilters, STUDENT_SCORES_USER_FILTER_FIELDS, {
              gradeAwareFields: GRADE_AWARE_FIELDS,
            })
          : undefined;

      // Short-circuit: when the taskId filter (or an empty administration) leaves
      // no tasks in scope, no per-task entries can be assembled. Skip the
      // pagination + score JOINs and return an empty page. Matches the analogous
      // short-circuit in getScoreOverview.
      if (taskMetas.length === 0) {
        return { tasks: [], items: [], totalItems: 0 };
      }

      // 9. Determine the static sort column when sorting by a user field.
      // user.schoolName is handled inside the repository as a correlated subquery,
      // so we pass undefined and rely on the dynamic-sort path falling through to
      // the repo's school-name expression. Other static fields use their column.
      // The map deliberately omits `user.schoolName` — TypeScript's narrowing on
      // the explicit equality check below makes the lookup safe.
      let staticSortColumn: Column | undefined;
      if (!sortField) {
        if (sortBy === 'user.schoolName') {
          staticSortColumn = undefined; // repo will use schoolNameSql
        } else {
          const key = sortBy as Exclude<StudentScoresSortField, 'user.schoolName'>;
          staticSortColumn = STUDENT_SCORES_SORT_COLUMNS[key] ?? users.nameLast;
        }
      }

      // 10. Repository call
      const result = await reportRepository.getStudentScores(
        administrationId,
        { scopeType, scopeId },
        taskMetas,
        { page, perPage, sortColumn: staticSortColumn, sortDirection: sortOrder },
        filterCondition,
        sortField,
        scoreFieldFilters,
        scoringRulesByVariant,
      );

      // 11. Build response — dedupe per taskId, classify, set optional/completed
      const tasksOrdered: ServiceTaskMetadata[] = uniqueTaskMetadataInOrder(taskMetas);

      // Resolve schoolNames for district-scope rows (not auto-populated by repo for that field)
      let schoolNamesByUser: Map<string, string> | undefined;
      if (scopeType === EntityType.DISTRICT) {
        schoolNamesByUser = await reportRepository.getSchoolNamesForUsers(result.items.map((s) => s.userId));
      }

      // Group taskMetas by taskId once — the grouping is independent of the
      // per-student row data, so hoisting it out of the per-row map saves
      // O(students × variants) reallocations.
      const { taskOrder, variantsByTaskId } = groupTaskMetasByTaskId(taskMetas);

      const items: ServiceStudentScoreRow[] = result.items.map((row) =>
        assembleStudentScoreRow(
          row,
          taskOrder,
          variantsByTaskId,
          scoringVersionByVariant,
          taskService.evaluateTaskVariantEligibility,
          scopeType,
          schoolNamesByUser,
        ),
      );

      return { tasks: tasksOrdered, items, totalItems: result.totalItems };
    } catch (error) {
      if (error instanceof ApiError) throw error;

      logger.error(
        { err: error, context: { userId, administrationId, scopeType, scopeId } },
        'Failed to retrieve student scores report',
      );

      throw new ApiError('Failed to retrieve student scores report', {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
        context: { userId, administrationId, scopeType, scopeId },
        cause: error,
      });
    }
  }

  /**
   * Get a single student's detailed score report for an administration.
   *
   * Authorization (three checks, in order — 404-before-403 throughout):
   * 1. `verifyAdministrationScoreReadAccess` — administration exists and the
   *    user has FGA `can_read_scores` on it.
   * 2. `authorizeScopeAccess(...CAN_READ_SCORES)` — scope is assigned to the
   *    administration and the user has FGA `can_read_scores` on the scope.
   * 3. `verifyStudentInScope` — the target student is enrolled as a STUDENT in
   *    the requested scope and has not had their roster ended. This step
   *    surfaces a 404 (not 403) per the ticket: callers should not be able to
   *    distinguish between "student not in scope" and "student doesn't exist".
   *
   * Per-task assembly mirrors `listStudentScores`'s row-level dedup: pick the
   * lowest-orderIndex variant with completed runs + scores; classify via
   * `getSupportLevel`; evaluate eligibility across all variants for the
   * `optional` flag. Adds three #1684-specific concerns:
   * - **Subscores** — extracted from `run_scores` for tasks declaring a
   *   `subscores` block in their scoring config (PA, phonics).
   * - **`skillsToWorkOn`** — PA only; the subset of subscore keys whose
   *   `percentCorrect` is below `PA_SKILL_THRESHOLD`.
   * - **`historicalScores`** — one entry per (prior administration, task) the
   *   student has completed runs in, including the current administration as
   *   the most-recent point on the trend line.
   *
   * @param authContext - User's auth context
   * @param administrationId - The administration to report on
   * @param targetUserId - The student whose report to fetch
   * @param query - Scope params
   * @returns Full individual student report
   * @throws {ApiError} NOT_FOUND if administration missing, student not in scope, or roster ended
   * @throws {ApiError} FORBIDDEN if FGA denies can_read_scores at administration or scope level
   * @throws {ApiError} BAD_REQUEST if scope is invalid
   */
  async function getIndividualStudentReport(
    authContext: AuthContext,
    administrationId: string,
    targetUserId: string,
    query: IndividualStudentReportInput,
  ): Promise<IndividualStudentReportResult> {
    const { userId } = authContext;
    const { scopeType, scopeId } = query;

    try {
      // 1. Administration-level authorization (also returns the loaded
      // administration record, avoiding a redundant getById in step 4)
      const administration = await verifyAdministrationScoreReadAccess(authContext, administrationId);

      // 2. Scope-level authorization
      await authorizeScopeAccess(authContext, administrationId, scopeType, scopeId, FgaRelation.CAN_READ_SCORES);

      // 3. Student-in-scope check (also enforces user.rosteringEnded IS NULL)
      const studentInScope = await reportRepository.verifyStudentInScope({ scopeType, scopeId }, targetUserId);
      if (!studentInScope) {
        // Use the generic NOT_FOUND message — distinguishing "student doesn't
        // exist" from "student isn't in this scope" would leak scope membership.
        throw new ApiError(ApiErrorMessage.NOT_FOUND, {
          statusCode: StatusCodes.NOT_FOUND,
          code: ApiErrorCode.RESOURCE_NOT_FOUND,
          context: { userId, administrationId, targetUserId, scopeType, scopeId },
        });
      }

      // 4. Fetch supporting data in parallel: target user, task metadata
      const [targetUser, taskMetas] = await Promise.all([
        userRepository.getById({ id: targetUserId }),
        reportRepository.getTaskMetadata(administrationId),
      ]);

      // verifyStudentInScope already ensured the user exists and isn't roster-ended.
      if (!targetUser) {
        throw new ApiError(ApiErrorMessage.NOT_FOUND, {
          statusCode: StatusCodes.NOT_FOUND,
          code: ApiErrorCode.RESOURCE_NOT_FOUND,
          context: { userId, targetUserId },
        });
      }

      // 5. Fetch scoring versions per variant (drives both classification and subscore lookups)
      const taskVariantIds = taskMetas.map((t) => t.taskVariantId);
      const allParams =
        taskVariantIds.length > 0 ? await taskVariantParameterRepository.getByTaskVariantIds(taskVariantIds) : [];
      const scoringVersionByVariant = new Map<string, number>();
      for (const param of allParams) {
        if (param.name === 'scoringVersion') {
          const version = typeof param.value === 'number' ? param.value : Number(param.value);
          if (!isNaN(version)) {
            scoringVersionByVariant.set(param.taskVariantId, version);
          }
        }
      }

      // 6. Fetch the student's current-admin scores, run metadata, and historical
      // runs/scores in parallel. Run metadata (reliable, engagementFlags) lives
      // on the runs row; getCompletedRunScores only returns score rows, so we
      // also call getCompletedRunsForUser for the run-level signals.
      const taskIdsInAdmin = Array.from(new Set(taskMetas.map((t) => t.taskId)));
      const [currentScoreRows, currentRunRows, historicalRuns] = await Promise.all([
        reportRepository.getCompletedRunScores(administrationId, [targetUserId], taskVariantIds),
        reportRepository.getCompletedRunsForUser(administrationId, targetUserId, taskVariantIds),
        reportRepository.getHistoricalRunsForUser(targetUserId, administration.dateStart, taskIdsInAdmin),
      ]);

      const historicalRunIds = historicalRuns.map((r) => r.runId);
      const historicalScoreRows =
        historicalRunIds.length > 0 ? await reportRepository.getScoresForRunIds(historicalRunIds) : [];

      // 7. Build per-task entries
      const { taskOrder, variantsByTaskId } = groupTaskMetasByTaskId(taskMetas);

      // Index current-admin scores: variantId → name → value
      const currentScoresByVariant = buildVariantScoreLookup(currentScoreRows);

      // Index current-admin run metadata: variantId → most-recent-completed run.
      // When multiple runs match the (user, variant) — defensive against the rare
      // multi-run case — pick the latest by completedAt.
      const currentRunByVariant = new Map<string, { reliable: boolean | null; engagementFlags: string[] }>();
      const seenRunCompletedAt = new Map<string, Date>();
      for (const r of currentRunRows) {
        const existing = seenRunCompletedAt.get(r.taskVariantId);
        if (!existing || r.completedAt > existing) {
          currentRunByVariant.set(r.taskVariantId, {
            reliable: r.reliable,
            engagementFlags: r.engagementFlags,
          });
          seenRunCompletedAt.set(r.taskVariantId, r.completedAt);
        }
      }

      // Index historical scores: runId → name → value
      const historicalScoresByRun = buildRunScoreLookup(historicalScoreRows);

      const tasks: ServiceIndividualStudentReportTask[] = [];
      let completedTaskCount = 0;
      let totalTaskCount = 0;

      for (const taskId of taskOrder) {
        const variants = variantsByTaskId.get(taskId)!;

        // Eligibility for the optional/visibility decision
        const eligibility = evaluateAcrossVariants(targetUser, variants, taskService.evaluateTaskVariantEligibility);
        if (!eligibility.isAssigned) {
          // Task is excluded from the student's view per condition evaluation
          continue;
        }
        totalTaskCount++;

        // Find the first variant with a completed run + scores
        let scoredVariant: ReportTaskMeta | null = null;
        let scoredScoreMap: Map<string, string> | null = null;
        for (const v of variants) {
          const map = currentScoresByVariant.get(v.taskVariantId);
          if (map && map.size > 0) {
            scoredVariant = v;
            scoredScoreMap = map;
            break;
          }
        }

        const representative = variants[0]!;
        const taskMeta: ServiceTaskMetadata = {
          taskId: representative.taskId,
          taskSlug: representative.taskSlug,
          taskName: representative.taskName,
          orderIndex: representative.orderIndex,
        };

        if (scoredVariant && scoredScoreMap) {
          completedTaskCount++;
          const runMeta = currentRunByVariant.get(scoredVariant.taskVariantId) ?? null;
          const taskEntry = buildAssessedTaskEntry(
            taskMeta,
            scoredVariant,
            scoredScoreMap,
            scoringVersionByVariant.get(scoredVariant.taskVariantId) ?? null,
            targetUser.grade,
            eligibility.isOptional,
            historicalRuns,
            historicalScoresByRun,
            runMeta,
          );
          tasks.push(taskEntry);
        } else {
          tasks.push(buildUnassessedTaskEntry(taskMeta, eligibility.isOptional, historicalRuns, historicalScoresByRun));
        }
      }

      return {
        student: {
          userId: targetUser.id,
          firstName: targetUser.nameFirst,
          lastName: targetUser.nameLast,
          username: targetUser.username,
          grade: targetUser.grade,
        },
        administration: {
          id: administration.id,
          name: administration.name,
          dateStart: administration.dateStart.toISOString(),
          dateEnd: administration.dateEnd.toISOString(),
        },
        tasks,
        completedTaskCount,
        totalTaskCount,
      };
    } catch (error) {
      if (error instanceof ApiError) throw error;

      logger.error(
        { err: error, context: { userId, administrationId, targetUserId, scopeType, scopeId } },
        'Failed to retrieve individual student report',
      );

      throw new ApiError('Failed to retrieve individual student report', {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
        context: { userId, administrationId, targetUserId, scopeType, scopeId },
        cause: error,
      });
    }
  }

  return {
    listProgressStudents,
    getProgressOverview,
    getScoreOverview,
    listStudentScores,
    getIndividualStudentReport,
  };
}

// --- Progress sort/filter resolution helpers ---

/**
 * Extract a taskId UUID from a `progress.<uuid>.status` field string.
 * Returns null if the field doesn't match the expected pattern.
 */
function extractTaskIdFromField(field: string): string | null {
  if (!PROGRESS_TASK_STATUS_PATTERN.test(field)) return null;
  return field.split('.')[1] ?? null;
}

/**
 * Find a task in the administration's task metadata by taskId.
 * Throws 400 if the taskId is not found.
 */
function findTaskOrThrow(taskId: string, taskMetas: ReportTaskMeta[]): ReportTaskMeta {
  const task = taskMetas.find((t) => t.taskId === taskId);
  if (!task) {
    throw new ApiError('Invalid task ID in sort/filter field', {
      statusCode: StatusCodes.BAD_REQUEST,
      code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
      context: { taskId, availableTaskIds: taskMetas.map((t) => t.taskId) },
    });
  }
  return task;
}

/**
 * Build SQL conditions from a task's JSONB conditions for use in the repository's
 * progress status CASE expression.
 */
function buildConditionSqlParams(task: ReportTaskMeta): {
  assignmentSql: ReturnType<typeof conditionToSql>;
  optionalIfSql: ReturnType<typeof conditionToSql>;
} {
  return {
    assignmentSql: conditionToSql(task.conditionsAssignment, REPORT_CONDITION_FIELD_MAP),
    optionalIfSql: conditionToSql(task.conditionsRequirements, REPORT_CONDITION_FIELD_MAP),
  };
}

/**
 * Resolve the sort column for progress students.
 * Static user fields map to Drizzle columns. Dynamic `progress.<taskId>.status`
 * fields resolve to a ProgressStatusSortParam for the repository.
 */
function resolveProgressSort(
  sortBy: string,
  taskMetas: ReportTaskMeta[],
): { sortColumn: Column | undefined; progressStatusSort: ProgressStatusSortParam | null } {
  const staticColumn = PROGRESS_SORT_COLUMNS[sortBy as ProgressStudentsSortField];
  if (staticColumn) {
    return { sortColumn: staticColumn, progressStatusSort: null };
  }

  const taskId = extractTaskIdFromField(sortBy);
  if (taskId) {
    const task = findTaskOrThrow(taskId, taskMetas);
    const { assignmentSql, optionalIfSql } = buildConditionSqlParams(task);
    return {
      sortColumn: undefined,
      progressStatusSort: {
        taskVariantId: task.taskVariantId,
        assignmentSql,
        optionalIfSql,
      },
    };
  }

  // Unrecognized field — contract validates, so this shouldn't happen. Fall back to default.
  return { sortColumn: undefined, progressStatusSort: null };
}

/**
 * Separate user-level filters from progress.<taskId>.status filters.
 * User-level filters become SQL WHERE conditions via buildFilterConditions.
 * Progress status filters become ProgressStatusFilterParam for the repository.
 *
 * Up to 3 progress status filters are supported per request. Each adds a LEFT JOIN
 * against the FDW runs table for a specific task variant. More than 3 would add
 * excessive query complexity with diminishing value.
 *
 * @throws {ApiError} BAD_REQUEST if more than 3 progress status filters are provided
 */
function resolveProgressFilters(
  filters: ParsedFilter[],
  taskMetas: ReportTaskMeta[],
): { userFilters: ParsedFilter[]; progressStatusFilters: ProgressStatusFilterParam[] } {
  const MAX_PROGRESS_FILTERS = 3;
  const userFilters: ParsedFilter[] = [];
  const progressStatusFilters: ProgressStatusFilterParam[] = [];

  for (const f of filters) {
    const taskId = extractTaskIdFromField(f.field);
    if (taskId) {
      if (progressStatusFilters.length >= MAX_PROGRESS_FILTERS) {
        throw new ApiError(`At most ${MAX_PROGRESS_FILTERS} progress status filters are supported per request`, {
          statusCode: StatusCodes.BAD_REQUEST,
          code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
          context: { field: f.field, maxProgressFilters: MAX_PROGRESS_FILTERS },
        });
      }
      const task = findTaskOrThrow(taskId, taskMetas);
      const { assignmentSql, optionalIfSql } = buildConditionSqlParams(task);
      const statusValues = f.operator === 'in' ? f.value.split(',').map((v) => v.trim()) : [f.value];
      progressStatusFilters.push({
        taskVariantId: task.taskVariantId,
        statusValues,
        assignmentSql,
        optionalIfSql,
      });
    } else {
      userFilters.push(f);
    }
  }

  return { userFilters, progressStatusFilters };
}
/**
 * Type for the evaluateTaskVariantEligibility function from TaskService.
 * Uses ConditionEvaluationUser (the narrow interface) so callers can pass
 * either a full User entity or a StudentProgressRow without casting.
 */
type EligibilityEvaluator = (
  user: ConditionEvaluationUser,
  conditionsAssignment: Condition | null,
  conditionsRequirements: Condition | null,
) => { isAssigned: boolean; isOptional: boolean };

/**
 * Build a progress map for a student keyed by taskId.
 * Determines status from run data and condition evaluation:
 * - completed: run exists with completedAt
 * - started: run exists without completedAt
 * - optional: no run, but task variant conditions mark it optional for this student
 * - assigned: no run, task variant is assigned (not optional) for this student
 *
 * Tasks where conditionsAssignment evaluates to false for the student are excluded
 * from the progress map entirely — the task is not visible to that student.
 *
 * When an administration has multiple variants for the same task (e.g., grade-specific
 * variants), each variant is checked independently but they share the same taskId key.
 * The highest-priority status wins: completed > started > assigned. This prevents a
 * variant without a run from overwriting a completed/started entry from another variant.
 *
 * Exported for independent testing.
 *
 * @param student - Student data with demographic fields for condition evaluation
 * @param taskMetas - Task metadata including condition JSONB
 * @param evaluateEligibility - Function to evaluate task variant conditions against user data
 */
export function buildProgressMap(
  student: StudentProgressRow,
  taskMetas: ReportTaskMeta[],
  evaluateEligibility: EligibilityEvaluator,
): Record<string, ServiceProgressEntry> {
  const progress: Record<string, ServiceProgressEntry> = {};

  for (const task of taskMetas) {
    const run = student.runs.get(task.taskVariantId);

    let entry: ServiceProgressEntry;

    if (run) {
      // Student has a run — evaluate conditions to determine required vs optional,
      // but don't skip the task even if isAssigned is false. A student who actually
      // did the work should see their progress regardless of condition changes.
      // Default to "required" if conditions would exclude them entirely.
      const { isOptional } = evaluateEligibility(student, task.conditionsAssignment, task.conditionsRequirements);

      if (run.completedAt) {
        entry = {
          status: isOptional ? 'completed-optional' : 'completed-required',
          startedAt: run.startedAt.toISOString(),
          completedAt: run.completedAt.toISOString(),
        };
      } else {
        entry = {
          status: isOptional ? 'started-optional' : 'started-required',
          startedAt: run.startedAt.toISOString(),
          completedAt: null,
        };
      }
    } else {
      // No run — evaluate conditions to determine assigned vs optional vs excluded.
      const { isAssigned, isOptional } = evaluateEligibility(
        student,
        task.conditionsAssignment,
        task.conditionsRequirements,
      );

      if (!isAssigned) {
        // Task is not assigned to this student — skip it entirely
        continue;
      }

      entry = {
        status: isOptional ? 'assigned-optional' : 'assigned-required',
        startedAt: null,
        completedAt: null,
      };
    }

    // When multiple variants share a taskId, keep the highest-priority status.
    const existing = progress[task.taskId];
    const entryPriority = PROGRESS_STATUS_PRIORITY[entry.status];
    const existingPriority = existing ? PROGRESS_STATUS_PRIORITY[existing.status] : -1;
    if (!existing || entryPriority > existingPriority) {
      progress[task.taskId] = entry;
    }
  }

  return progress;
}

// --- Score overview helpers ---

/**
 * Conventional score names that hold the assessment-computed support level
 * for tasks like `roam-alpaca`. The scoring service's
 * `getSupportLevelFieldName(taskSlug)` is the source of truth per slug; this
 * list is the order in which we probe `run_scores` if the slug-specific name
 * isn't in the score map (handles the `support_level` snake_case alias too).
 */
const ASSESSMENT_SUPPORT_LEVEL_FIELDS: ReadonlyArray<string> = ['supportLevel', 'support_level'];

/** Nested lookup: userId → taskVariantId → scoreName → scoreValue (raw string from FDW). */
type ScoreLookup = Map<string, Map<string, Map<string, string>>>;

/** A group of task variants sharing the same taskId. */
interface TaskGroup {
  /** First variant in orderIndex order — used for taskId, taskSlug, taskName, orderIndex */
  representative: ReportTaskMeta;
  /** All variants for this taskId, in orderIndex order */
  variants: ReportTaskMeta[];
}

/**
 * Group task variants by taskId, preserving the orderIndex ordering of the input.
 * Returns one TaskGroup per unique taskId, using the lowest-orderIndex variant
 * as the representative (for metadata in the response).
 *
 * Exported for independent testing.
 */
export function groupVariantsByTaskId(taskMetas: ReportTaskMeta[]): TaskGroup[] {
  const groups = new Map<string, ReportTaskMeta[]>();
  const orderedTaskIds: string[] = [];
  for (const meta of taskMetas) {
    const existing = groups.get(meta.taskId);
    if (existing) {
      existing.push(meta);
    } else {
      groups.set(meta.taskId, [meta]);
      orderedTaskIds.push(meta.taskId);
    }
  }

  return orderedTaskIds.map((taskId) => {
    const variants = groups.get(taskId)!;
    return { representative: variants[0]!, variants };
  });
}

/**
 * Build a nested lookup: userId → taskVariantId → Map<scoreName, scoreValue>.
 * For duplicate score names within the same user-task-variant, the last value wins.
 */
function buildScoreLookup(scoreRows: RunScoreRow[]): ScoreLookup {
  const lookup: ScoreLookup = new Map();
  for (const row of scoreRows) {
    if (!lookup.has(row.userId)) {
      lookup.set(row.userId, new Map());
    }
    const userScores = lookup.get(row.userId)!;
    if (!userScores.has(row.taskVariantId)) {
      userScores.set(row.taskVariantId, new Map());
    }
    userScores.get(row.taskVariantId)!.set(row.scoreName, row.scoreValue);
  }
  return lookup;
}

/**
 * Build an empty task overview (all zeros) for when there are no students or
 * no variants are in scope after filtering.
 */
function buildEmptyTaskOverview(task: ReportTaskMeta): ServiceTaskScoreOverview {
  return {
    taskId: task.taskId,
    taskSlug: task.taskSlug,
    taskName: task.taskName,
    orderIndex: task.orderIndex,
    totalAssessed: 0,
    totalNotAssessed: { required: 0, optional: 0 },
    supportLevels: {
      achievedSkill: { count: 0 },
      developingSkill: { count: 0 },
      needsExtraSupport: { count: 0 },
    },
  };
}

/**
 * Find the first variant (in orderIndex order) with completed run scores for a student.
 * Returns the variant and its score map, or null if no variant has scores.
 */
function findScoredVariant(
  userId: string,
  variants: ReportTaskMeta[],
  scoresByStudentTask: ScoreLookup,
): { variant: ReportTaskMeta; scores: Map<string, string> } | null {
  const userScores = scoresByStudentTask.get(userId);
  if (!userScores) return null;

  for (const variant of variants) {
    const scores = userScores.get(variant.taskVariantId);
    if (scores && scores.size > 0) {
      return { variant, scores };
    }
  }
  return null;
}

/**
 * Evaluate eligibility across all variants of a task for a student.
 *
 * A student is "assigned" if ANY variant assigns them. They are "optional" only
 * if every assigning variant marks them as optional. This mirrors the priority
 * logic in `buildProgressMap`: a student's effective status is their best across
 * all variants of the same task.
 */
function evaluateEligibilityAcrossVariants(
  student: StudentOverviewRow,
  variants: ReportTaskMeta[],
  evaluateEligibility: EligibilityEvaluator,
): { isAssigned: boolean; isOptional: boolean } {
  let anyAssigned = false;
  let anyRequired = false;

  for (const variant of variants) {
    const { isAssigned, isOptional } = evaluateEligibility(
      student,
      variant.conditionsAssignment,
      variant.conditionsRequirements,
    );
    if (isAssigned) {
      anyAssigned = true;
      if (!isOptional) anyRequired = true;
    }
  }

  return { isAssigned: anyAssigned, isOptional: anyAssigned && !anyRequired };
}

/**
 * Resolve a numeric score from the score map by trying each field name in order.
 * Uses parseScoreValue from the scoring service to handle angle-bracket strings
 * like ">99" or "<1" found in newer norming tables.
 *
 * Returns the first valid numeric value found, or null if none match.
 */
function resolveNumericScore(scores: Map<string, string>, fieldNames: string[]): number | null {
  for (const name of fieldNames) {
    const raw = scores.get(name);
    if (raw !== undefined) {
      const parsed = parseScoreValue(raw);
      if (parsed !== null) return parsed;
    }
  }
  return null;
}

/**
 * Resolve a string score (e.g., assessment-computed support level for roam-alpaca)
 * from the score map by trying each field name in order.
 */
function resolveStringScore(scores: Map<string, string>, fieldNames: ReadonlyArray<string>): string | null {
  for (const name of fieldNames) {
    const raw = scores.get(name);
    if (raw !== undefined) return raw;
  }
  return null;
}

/**
 * Aggregate support level distributions for a task across all its variants.
 *
 * Multi-variant deduplication: when a task has multiple variants (e.g., grade-specific),
 * each student is counted once at the first variant that has completed run scores.
 * For students with no completed runs on any variant, condition evaluation checks
 * all variants — the student is "assigned" if ANY variant assigns them, and "optional"
 * only if all matching variants are optional.
 */
function aggregateTaskGroup(
  representative: ReportTaskMeta,
  variants: ReportTaskMeta[],
  students: StudentOverviewRow[],
  scoresByStudentTask: ScoreLookup,
  scoringVersionByVariant: Map<string, number>,
  evaluateEligibility: EligibilityEvaluator,
): ServiceTaskScoreOverview {
  let totalAssessed = 0;
  let notAssessedRequired = 0;
  let notAssessedOptional = 0;
  let achievedCount = 0;
  let developingCount = 0;
  let needsSupportCount = 0;

  for (const student of students) {
    // Check all variants for this task — use the first with completed scores
    const scored = findScoredVariant(student.userId, variants, scoresByStudentTask);

    if (scored) {
      totalAssessed++;

      const scoringVersion = scoringVersionByVariant.get(scored.variant.taskVariantId) ?? null;
      const gradeLevel = getGradeAsNumber(student.grade);
      const fieldNames = resolveScoreFieldNames(scored.variant.taskSlug, gradeLevel);

      const percentile = resolveNumericScore(scored.scores, fieldNames.percentileFieldNames);
      const rawScore = resolveNumericScore(scored.scores, fieldNames.rawScoreFieldNames);
      const assessmentSupportLevel = resolveStringScore(scored.scores, ASSESSMENT_SUPPORT_LEVEL_FIELDS);

      const supportLevel = getSupportLevel({
        grade: student.grade,
        percentile,
        rawScore,
        taskSlug: scored.variant.taskSlug,
        scoringVersion,
        assessmentSupportLevel,
      });

      if (supportLevel === 'achievedSkill') achievedCount++;
      else if (supportLevel === 'developingSkill') developingCount++;
      else if (supportLevel === 'needsExtraSupport') needsSupportCount++;
      // null support level (raw-score-only tasks, unknown tasks) → counted in
      // totalAssessed but not in any bucket
    } else {
      // No completed run on any variant — evaluate conditions across all variants.
      const eligibility = evaluateEligibilityAcrossVariants(student, variants, evaluateEligibility);

      if (!eligibility.isAssigned) continue;
      if (eligibility.isOptional) notAssessedOptional++;
      else notAssessedRequired++;
    }
  }

  return {
    taskId: representative.taskId,
    taskSlug: representative.taskSlug,
    taskName: representative.taskName,
    orderIndex: representative.orderIndex,
    totalAssessed,
    totalNotAssessed: { required: notAssessedRequired, optional: notAssessedOptional },
    supportLevels: {
      achievedSkill: { count: achievedCount },
      developingSkill: { count: developingCount },
      needsExtraSupport: { count: needsSupportCount },
    },
  };
}

// --- Student-scores helpers ---

/**
 * Build a map of taskId → primary variant (lowest orderIndex within the task).
 * The primary variant is what dynamic sort/filter on `scores.<taskId>.<field>`
 * resolves against — it ensures SQL ordering is deterministic across pages
 * even when a task has multiple grade-specific variants.
 *
 * Assumes `taskMetas` is already ordered by orderIndex (as returned by
 * `getTaskMetadata`).
 */
function buildPrimaryVariantMap(taskMetas: ReportTaskMeta[]): Map<string, ReportTaskMeta> {
  const out = new Map<string, ReportTaskMeta>();
  for (const meta of taskMetas) {
    if (!out.has(meta.taskId)) {
      out.set(meta.taskId, meta);
    }
  }
  return out;
}

/**
 * Return a deduplicated list of task metadata (one entry per taskId) preserving
 * the orderIndex order of the input. Used for the response's `tasks` array so
 * the frontend renders one column per task.
 */
function uniqueTaskMetadataInOrder(taskMetas: ReportTaskMeta[]): ServiceTaskMetadata[] {
  const seen = new Set<string>();
  const out: ServiceTaskMetadata[] = [];
  for (const meta of taskMetas) {
    if (!seen.has(meta.taskId)) {
      seen.add(meta.taskId);
      out.push({
        taskId: meta.taskId,
        taskSlug: meta.taskSlug,
        taskName: meta.taskName,
        orderIndex: meta.orderIndex,
      });
    }
  }
  return out;
}

/**
 * Resolve the scoring config for a variant + scoring version into the shape the
 * repository needs for SQL CASE generation. Decouples the repository from the
 * scoring service.
 *
 * Returns an empty rules object for unknown task slugs and for `'none'`
 * classification — those tasks have no support level the SQL CASE can compute.
 */
function resolveScoringRulesForVariant(taskSlug: string, scoringVersion: number | null): ResolvedScoringRules {
  const empty: ResolvedScoringRules = {
    assessmentSupportLevelField: null,
    percentileCutoffs: null,
    rawScoreThresholds: null,
    percentileBelowGrade: null,
    percentileFieldNames: [],
    rawScoreFieldNames: [],
    standardScoreFieldNames: [],
  };

  const config = getScoringConfig(taskSlug);
  if (!config) return empty;

  const fieldNames = resolveScoreFieldNames(taskSlug, null, scoringVersion);
  const baseRules: ResolvedScoringRules = {
    ...empty,
    percentileFieldNames: fieldNames.percentileFieldNames,
    rawScoreFieldNames: fieldNames.rawScoreFieldNames,
    standardScoreFieldNames: fieldNames.standardScoreFieldNames,
  };

  if (config.classification.type === 'assessment-computed') {
    return {
      ...baseRules,
      assessmentSupportLevelField: config.classification.supportLevelField ?? 'supportLevel',
    };
  }
  if (config.classification.type === 'none') {
    return baseRules;
  }

  // percentile-then-rawscore
  const version = scoringVersion ?? 0;
  const pctEntry = config.classification.percentileCutoffs.find((e) => version >= e.minVersion);
  const rawEntry = config.classification.rawScoreThresholds.find((e) => version >= e.minVersion);
  return {
    ...baseRules,
    percentileCutoffs: pctEntry?.cutoffs ?? null,
    rawScoreThresholds: rawEntry?.thresholds ?? null,
    // percentileBelowGrade defaults to 6 (exclusive); null in the config means
    // "use percentile for all grades", which we represent as null in the rules.
    percentileBelowGrade: config.classification.percentileBelowGrade ?? 6,
  };
}

/**
 * Parse a `scores.<uuid>.<field>` string into its components.
 * Returns null if the string doesn't match the expected pattern.
 */
function parseScoreFieldString(field: string): { taskId: string; fieldType: StudentScoresFieldType } | null {
  if (!SCORE_TASK_FIELD_PATTERN.test(field)) return null;
  const parts = field.split('.');
  if (parts.length !== 3) return null;
  const taskId = parts[1]!;
  const fieldType = parts[2] as StudentScoresFieldType;
  return { taskId, fieldType };
}

/**
 * Validate that every dynamic `scores.<taskId>.<field>` reference in `sortBy`
 * and `filter` resolves to a known taskId. Throws 400 on any unknown taskId.
 *
 * Called before fetching scoring versions so input-validation errors fail fast
 * as 400 rather than getting wrapped as 500 by an unrelated downstream failure.
 */
function validateDynamicFieldTaskIds(
  sortBy: string,
  filter: ParsedFilter[],
  primaryVariantByTaskId: Map<string, ReportTaskMeta>,
  taskMetas: ReportTaskMeta[],
): void {
  const knownIds = () => taskMetas.map((t) => t.taskId);

  const sortParsed = parseScoreFieldString(sortBy);
  if (sortParsed && !primaryVariantByTaskId.has(sortParsed.taskId)) {
    throw new ApiError('Invalid task ID in sort field', {
      statusCode: StatusCodes.BAD_REQUEST,
      code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
      context: { sortBy, availableTaskIds: knownIds() },
    });
  }

  for (const f of filter) {
    if (f.field === 'taskId') continue;
    const parsed = parseScoreFieldString(f.field);
    if (parsed && !primaryVariantByTaskId.has(parsed.taskId)) {
      throw new ApiError('Invalid task ID in filter field', {
        statusCode: StatusCodes.BAD_REQUEST,
        code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
        context: { field: f.field, availableTaskIds: knownIds() },
      });
    }
  }
}

/**
 * Resolve a dynamic sort string into a `StudentScoresFieldRef` against the
 * primary variant of the referenced task. Returns null for static sort fields
 * (the caller falls back to the static-column path) and throws 400 for
 * unknown task IDs.
 */
function resolveDynamicSortField(
  sortBy: string,
  primaryVariantByTaskId: Map<string, ReportTaskMeta>,
  scoringVersionByVariant: Map<string, number>,
): StudentScoresFieldRef | null {
  const parsed = parseScoreFieldString(sortBy);
  if (!parsed) return null;

  const variant = primaryVariantByTaskId.get(parsed.taskId);

  // Guaranteed to exist with validation from validateDynamicFieldTaskIds (line 683)
  return {
    taskVariantId: variant!.taskVariantId,
    taskSlug: variant!.taskSlug,
    fieldType: parsed.fieldType,
    scoringVersion: scoringVersionByVariant.get(variant!.taskVariantId) ?? null,
  };
}

/**
 * Mapping between contract-side support level names and the SQL priority
 * integers the repository's CASE expressions return.
 */
const SUPPORT_LEVEL_NAME_TO_PRIORITY: Record<string, number> = {
  achievedSkill: 3,
  developingSkill: 2,
  needsExtraSupport: 1,
};

/**
 * Resolve a dynamic score-field filter into a `StudentScoresFieldFilter`. For
 * `supportLevel` filters the level names (`achievedSkill`, etc.) are translated
 * to priority integers so the repository can compare against its CASE output.
 *
 * Returns null when the filter targets an unsupported value (e.g.,
 * `supportLevel:eq:optional` — `optional` requires post-fetch logic and isn't
 * representable in the SQL CASE; the service silently drops the filter and
 * documents the limitation in the API contract).
 *
 * @throws {ApiError} BAD_REQUEST if the task ID is unknown
 */
function resolveDynamicFilter(
  filter: ParsedFilter,
  primaryVariantByTaskId: Map<string, ReportTaskMeta>,
  scoringVersionByVariant: Map<string, number>,
): StudentScoresFieldFilter | null {
  const parsed = parseScoreFieldString(filter.field);
  if (!parsed) return null;

  const variant = primaryVariantByTaskId.get(parsed.taskId);

  // Translate values: numeric fields use raw strings (cast in SQL); supportLevel
  // names map to priorities (3/2/1). 'optional' has no SQL representation — drop
  // those values from the filter list.
  let values: string[];
  if (parsed.fieldType === 'supportLevel') {
    const rawValues = filter.operator === 'in' ? filter.value.split(',').map((v) => v.trim()) : [filter.value];
    values = rawValues
      .map((v) => SUPPORT_LEVEL_NAME_TO_PRIORITY[v])
      .filter((p): p is number => p !== undefined)
      .map(String);
    if (values.length === 0) return null;
  } else {
    values = filter.operator === 'in' ? filter.value.split(',').map((v) => v.trim()) : [filter.value];
  }

  // Guaranteed to exist with validation from validateDynamicFieldTaskIds (line 683)
  return {
    taskVariantId: variant!.taskVariantId,
    taskSlug: variant!.taskSlug,
    fieldType: parsed.fieldType,
    scoringVersion: scoringVersionByVariant.get(variant!.taskVariantId) ?? null,
    operator: filter.operator as StudentScoresFilterOperator,
    values,
  };
}

/**
 * Round a numeric score to an integer for the API response. Returns null for
 * null/NaN inputs.
 */
function roundScoreOrNull(value: number | null): number | null {
  if (value === null || isNaN(value)) return null;
  return Math.round(value);
}

/**
 * Alias of `EligibilityEvaluator` for use in the student-scores helpers.
 * Kept as a re-export so the consuming code reads naturally; both names refer
 * to the same `TaskService.evaluateTaskVariantEligibility` shape.
 */
type StudentEligibilityEvaluator = EligibilityEvaluator;

/**
 * Convert a single repository row into a service-shaped student row with one
 * score entry per taskId. For each task:
 *
 * - If any variant has a completed run for this student, pick the
 *   lowest-orderIndex variant with scores and classify; that becomes the
 *   per-task entry.
 * - Otherwise, evaluate condition assignment/requirement across all variants.
 *   `assigned` if any variant assigns; `optional` only if every assigning
 *   variant marks the student optional.
 * - Tasks where every variant excludes the student via `conditionsAssignment`
 *   are omitted from the `scores` map (they're not visible to that student).
 */
function assembleStudentScoreRow(
  row: StudentScoreQueryRow,
  taskOrder: ReadonlyArray<string>,
  variantsByTaskId: ReadonlyMap<string, ReportTaskMeta[]>,
  scoringVersionByVariant: Map<string, number>,
  evaluateEligibility: StudentEligibilityEvaluator,
  scopeType: ScopeType,
  schoolNamesByUser: Map<string, string> | undefined,
): ServiceStudentScoreRow {
  const scores: Record<string, ServiceStudentScoreEntry> = {};

  for (const taskId of taskOrder) {
    const variants = variantsByTaskId.get(taskId)!;

    // Find the first variant with completed run + scores
    let scored: {
      variant: ReportTaskMeta;
      scoreMap: Map<string, string>;
      runMeta: { reliable: boolean | null; engagementFlags: string[] };
    } | null = null;
    for (const v of variants) {
      const variantScores = row.scores.get(v.taskVariantId);
      const runMeta = row.runs.get(v.taskVariantId);
      if (variantScores && variantScores.size > 0 && runMeta) {
        scored = {
          variant: v,
          scoreMap: variantScores,
          runMeta: { reliable: runMeta.reliable, engagementFlags: runMeta.engagementFlags },
        };
        break;
      }
    }

    if (scored) {
      const scoringVersion = scoringVersionByVariant.get(scored.variant.taskVariantId) ?? null;
      const gradeLevel = getGradeAsNumber(row.grade);
      // Match score-overview's resolution strategy: omit scoringVersion so all-version
      // field names are returned. This is best-effort — the version is still passed to
      // getSupportLevel below for correct cutoff selection.
      const fieldNames = resolveScoreFieldNames(scored.variant.taskSlug, gradeLevel);

      const percentile = resolveNumericScore(scored.scoreMap, fieldNames.percentileFieldNames);
      const rawScore = resolveNumericScore(scored.scoreMap, fieldNames.rawScoreFieldNames);
      const standardScore = resolveNumericScore(scored.scoreMap, fieldNames.standardScoreFieldNames);
      const assessmentSupportLevel = resolveStringScore(scored.scoreMap, ASSESSMENT_SUPPORT_LEVEL_FIELDS);

      const supportLevel = getSupportLevel({
        grade: row.grade,
        percentile,
        rawScore,
        taskSlug: scored.variant.taskSlug,
        scoringVersion,
        assessmentSupportLevel,
      }) as ServiceSupportLevelValue | null;

      // Eligibility for the optional flag (independent of completion)
      const eligibility = evaluateAcrossVariants(row, variants, evaluateEligibility);

      scores[taskId] = {
        rawScore: roundScoreOrNull(rawScore),
        percentile: roundScoreOrNull(percentile),
        standardScore: roundScoreOrNull(standardScore),
        supportLevel,
        reliable: scored.runMeta.reliable,
        engagementFlags: scored.runMeta.engagementFlags,
        optional: eligibility.isOptional,
        completed: true,
      };
    } else {
      // No completed run on any variant — evaluate condition across variants
      const eligibility = evaluateAcrossVariants(row, variants, evaluateEligibility);
      if (!eligibility.isAssigned) continue; // task not visible to this student

      scores[taskId] = {
        rawScore: null,
        percentile: null,
        standardScore: null,
        supportLevel: eligibility.isOptional ? 'optional' : null,
        reliable: null,
        engagementFlags: [],
        optional: eligibility.isOptional,
        completed: false,
      };
    }
  }

  return {
    user: {
      userId: row.userId,
      assessmentPid: row.assessmentPid,
      username: row.username,
      email: row.email,
      firstName: row.nameFirst,
      lastName: row.nameLast,
      grade: row.grade,
      schoolName: scopeType === EntityType.DISTRICT ? (schoolNamesByUser?.get(row.userId) ?? null) : null,
    },
    scores,
  };
}

/**
 * Group task metadata by taskId, preserving the orderIndex order of the input.
 * Returns the ordered taskId list and a map from taskId to its variants. Pure
 * function — depends only on `taskMetas`, so the result is hoisted out of the
 * per-student loop in `listStudentScores` to avoid recomputing it for every row.
 */
function groupTaskMetasByTaskId(taskMetas: ReportTaskMeta[]): {
  taskOrder: string[];
  variantsByTaskId: Map<string, ReportTaskMeta[]>;
} {
  const variantsByTaskId = new Map<string, ReportTaskMeta[]>();
  const taskOrder: string[] = [];
  for (const meta of taskMetas) {
    if (!variantsByTaskId.has(meta.taskId)) {
      variantsByTaskId.set(meta.taskId, []);
      taskOrder.push(meta.taskId);
    }
    variantsByTaskId.get(meta.taskId)!.push(meta);
  }
  return { taskOrder, variantsByTaskId };
}

/**
 * Evaluate task-variant eligibility across every variant of a task.
 * A student is "assigned" if any variant assigns them; "optional" only when
 * every assigning variant marks them optional. Mirrors the score-overview
 * helper of the same intent.
 */
function evaluateAcrossVariants(
  user: ConditionEvaluationUser,
  variants: ReportTaskMeta[],
  evaluateEligibility: StudentEligibilityEvaluator,
): { isAssigned: boolean; isOptional: boolean } {
  let anyAssigned = false;
  let anyRequired = false;
  for (const v of variants) {
    const { isAssigned, isOptional } = evaluateEligibility(user, v.conditionsAssignment, v.conditionsRequirements);
    if (isAssigned) {
      anyAssigned = true;
      if (!isOptional) anyRequired = true;
    }
  }
  return { isAssigned: anyAssigned, isOptional: anyAssigned && !anyRequired };
}

// --- Individual student report helpers ---

/** Index per-variant raw run_scores rows: variantId → scoreName → scoreValue. */
function buildVariantScoreLookup(rows: RunScoreRow[]): Map<string, Map<string, string>> {
  const out = new Map<string, Map<string, string>>();
  for (const r of rows) {
    if (!out.has(r.taskVariantId)) out.set(r.taskVariantId, new Map());
    out.get(r.taskVariantId)!.set(r.scoreName, r.scoreValue);
  }
  return out;
}

/** Index historical run_scores rows: runId → scoreName → scoreValue. */
function buildRunScoreLookup(
  rows: ReadonlyArray<{ runId: string; scoreName: string; scoreValue: string }>,
): Map<string, Map<string, string>> {
  const out = new Map<string, Map<string, string>>();
  for (const r of rows) {
    if (!out.has(r.runId)) out.set(r.runId, new Map());
    out.get(r.runId)!.set(r.scoreName, r.scoreValue);
  }
  return out;
}

/**
 * Build the per-task `tags` array from the optional/reliable/completed flags.
 *
 * Tags are presentation-layer triples `{ label, value, severity }`. The label
 * is a stable identifier the frontend can switch on; the value is the human
 * string. Reliability is omitted when there's no completed run (no run = no
 * reliability signal).
 */
function buildTaskTags(args: { optional: boolean; completed: boolean; reliable: boolean | null }): ServiceTaskTag[] {
  const tags: ServiceTaskTag[] = [];
  tags.push({
    label: 'Type',
    value: args.optional ? 'Optional' : 'Required',
    severity: 'info',
  });
  if (args.completed && args.reliable !== null) {
    tags.push({
      label: 'Reliability',
      value: args.reliable ? 'Reliable' : 'Unreliable',
      severity: args.reliable ? 'success' : 'warn',
    });
  }
  return tags;
}

/**
 * Extract the per-task subscores map from a run_scores score map, using the
 * task's `subscores` declaration in the scoring config.
 *
 * Returns `null` for tasks that don't declare subscores (most tasks). Each
 * declared key produces a `{ correct, attempted, percentCorrect }` triple where:
 *
 * - `correct` and `attempted` come from the run_scores rows named by the
 *   config's `correctName` / `attemptedName`.
 * - `percentCorrect` comes from the config's `percentCorrectName` row when
 *   present; otherwise it is computed as `100 * correct / attempted` rounded
 *   to one decimal place. Returns `null` for the entry when neither source is
 *   available (the response shape allows nullable fields per subscore).
 *
 * Reused by the task-subscores endpoint (#1685) — exporting so that endpoint
 * can call into the same extraction logic.
 */
export function extractSubscoresFromScoreMap(
  scoreMap: Map<string, string>,
  taskSlug: string,
): Record<string, ServiceSubscoreEntry> | null {
  const config = getSubscoresConfig(taskSlug);
  if (!config) return null;

  const out: Record<string, ServiceSubscoreEntry> = {};
  for (const [responseKey, fields] of Object.entries(config)) {
    const correctRaw = scoreMap.get(fields.correctName);
    const attemptedRaw = scoreMap.get(fields.attemptedName);
    const correct = parseScoreValue(correctRaw);
    const attempted = parseScoreValue(attemptedRaw);

    let percentCorrect: number | null = null;
    if (fields.percentCorrectName) {
      const pct = parseScoreValue(scoreMap.get(fields.percentCorrectName));
      if (pct !== null) percentCorrect = Math.round(pct * 10) / 10;
    }
    if (percentCorrect === null && correct !== null && attempted !== null && attempted > 0) {
      percentCorrect = Math.round((correct / attempted) * 1000) / 10;
    }

    out[responseKey] = {
      correct: correct === null ? null : Math.round(correct),
      attempted: attempted === null ? null : Math.round(attempted),
      percentCorrect,
    };
  }
  return out;
}

/**
 * Compute `skillsToWorkOn` for PA tasks — the subset of `PA_SUBTASK_KEYS` whose
 * `percentCorrect` is below `PA_SKILL_THRESHOLD`. When `percentCorrect` is
 * unavailable, falls back to the legacy `roarScore`-vs-`PA_SKILL_LEGACY_THRESHOLD`
 * comparison via the subscore's `correct` count, mirroring
 * `getPaSkillsToWorkOn` from the legacy frontend helper.
 *
 * Returns `null` for non-PA tasks (the caller omits the field from the response).
 *
 * Reused by #1685 alongside `extractSubscoresFromScoreMap`.
 */
export function computePaSkillsToWorkOn(
  taskSlug: string,
  subscores: Record<string, ServiceSubscoreEntry> | null,
): string[] | null {
  if (taskSlug !== 'pa' || !subscores) return null;

  const out: string[] = [];
  for (const key of PA_SUBTASK_KEYS) {
    const sub = subscores[key];
    if (!sub) continue;
    let needsWork = false;
    if (sub.percentCorrect !== null) {
      needsWork = sub.percentCorrect < PA_SKILL_THRESHOLD;
    } else if (sub.correct !== null) {
      needsWork = sub.correct < PA_SKILL_LEGACY_THRESHOLD;
    }
    if (needsWork) out.push(key);
  }
  return out;
}

/** Resolve numeric score fields from a score map — wraps the existing helpers. */
function resolveTaskScores(
  scoreMap: Map<string, string>,
  taskSlug: string,
  gradeLevel: number | null,
): ServiceTaskScores {
  const fieldNames = resolveScoreFieldNames(taskSlug, gradeLevel);
  return {
    rawScore: roundScoreOrNull(resolveNumericScore(scoreMap, fieldNames.rawScoreFieldNames)),
    percentile: roundScoreOrNull(resolveNumericScore(scoreMap, fieldNames.percentileFieldNames)),
    standardScore: roundScoreOrNull(resolveNumericScore(scoreMap, fieldNames.standardScoreFieldNames)),
  };
}

/**
 * Build the per-task historical scores array for one task, given all historical
 * runs for the user (already pre-fetched, across all tasks) and a score lookup
 * keyed by run ID.
 *
 * Filters to the runs whose `taskId` matches and resolves their score fields
 * via the same logic as the current administration. Sorted ascending by
 * `administrationDateStart` so the trend reads chronologically left-to-right.
 */
function buildHistoricalScoresForTask(
  taskId: string,
  taskSlug: string,
  gradeLevel: number | null,
  historicalRuns: HistoricalRunRow[],
  historicalScoresByRun: Map<string, Map<string, string>>,
): ServiceHistoricalScore[] {
  // `getHistoricalRunsForUser` returns one row per (administration, taskVariant)
  // for completed runs. When a task has multiple variants and the student
  // completed more than one in the same prior administration, we'd otherwise
  // emit duplicate `historicalScores` entries with the same administrationId —
  // a trend chart expects one point per administration per task.
  //
  // Sort by administrationDateStart, then by completedAt and taskVariantId as
  // deterministic tie-breakers within an administration. Dedup by
  // administrationId after sorting, keeping the earliest-completed run for
  // that administration (a stable, defensible "first attempt" choice).
  const matching = historicalRuns
    .filter((r) => r.taskId === taskId)
    .sort((a, b) => {
      const dateDiff = a.administrationDateStart.getTime() - b.administrationDateStart.getTime();
      if (dateDiff !== 0) return dateDiff;
      const completedDiff = a.completedAt.getTime() - b.completedAt.getTime();
      if (completedDiff !== 0) return completedDiff;
      return a.taskVariantId.localeCompare(b.taskVariantId);
    });

  const seenAdmins = new Set<string>();
  const deduped = matching.filter((run) => {
    if (seenAdmins.has(run.administrationId)) return false;
    seenAdmins.add(run.administrationId);
    return true;
  });

  return deduped.map((run) => {
    const scoreMap = historicalScoresByRun.get(run.runId) ?? new Map();
    return {
      administrationId: run.administrationId,
      administrationName: run.administrationName,
      date: run.completedAt.toISOString(),
      scores: resolveTaskScores(scoreMap, taskSlug, gradeLevel),
    };
  });
}

/**
 * Assemble a per-task entry for a task the student has a completed run for.
 *
 * Pulls together: classified scores, support level (via the scoring service
 * with cutoffs/version awareness), tags, optional subscores (when the task
 * config declares them) and skillsToWorkOn (PA only), and historical scores
 * across prior administrations (and the current one).
 */
function buildAssessedTaskEntry(
  taskMeta: ServiceTaskMetadata,
  scoredVariant: ReportTaskMeta,
  scoreMap: Map<string, string>,
  scoringVersion: number | null,
  grade: string | null,
  optional: boolean,
  historicalRuns: HistoricalRunRow[],
  historicalScoresByRun: Map<string, Map<string, string>>,
  runMeta: { reliable: boolean | null; engagementFlags: string[] } | null,
): ServiceIndividualStudentReportTask {
  const gradeLevel = getGradeAsNumber(grade);
  const scores = resolveTaskScores(scoreMap, scoredVariant.taskSlug, gradeLevel);

  // Re-derive the unrounded numeric scores for classification (rounding before
  // classification could swing borderline cases — pass the raw numerics into
  // getSupportLevel and let it apply cutoffs).
  const fieldNames = resolveScoreFieldNames(scoredVariant.taskSlug, gradeLevel);
  const percentile = resolveNumericScore(scoreMap, fieldNames.percentileFieldNames);
  const rawScore = resolveNumericScore(scoreMap, fieldNames.rawScoreFieldNames);
  const assessmentSupportLevel = resolveStringScore(scoreMap, ASSESSMENT_SUPPORT_LEVEL_FIELDS);
  const supportLevel = getSupportLevel({
    grade,
    percentile,
    rawScore,
    taskSlug: scoredVariant.taskSlug,
    scoringVersion,
    assessmentSupportLevel,
  }) as ServiceSupportLevelValue | null;

  // Run-level signals come from `getCompletedRunsForUser` (the score map only
  // carries score values, not run metadata). When the lookup turns up no run
  // for the variant — defensive against eventual-consistency edge cases between
  // run and score writes — we conservatively report `reliable: null` and an
  // empty engagement-flags list rather than fabricating a "reliable" reading.
  const reliable = runMeta?.reliable ?? null;
  const engagementFlags = runMeta?.engagementFlags ?? [];

  const subscores = extractSubscoresFromScoreMap(scoreMap, scoredVariant.taskSlug);
  const skillsToWorkOn = computePaSkillsToWorkOn(scoredVariant.taskSlug, subscores);

  // Historical entries are resolved with the current variant's slug. Runs for
  // the same task across administrations share a slug, so we don't need a
  // per-historical-run scoring-version lookup at this layer; if we ever need
  // per-run version resolution, the variant→version map can be threaded back
  // in alongside `historicalScoresByRun`.
  const historicalScores = buildHistoricalScoresForTask(
    taskMeta.taskId,
    scoredVariant.taskSlug,
    gradeLevel,
    historicalRuns,
    historicalScoresByRun,
  );

  const entry: ServiceIndividualStudentReportTask = {
    ...taskMeta,
    scores,
    supportLevel,
    reliable,
    optional,
    completed: true,
    engagementFlags,
    tags: buildTaskTags({ optional, completed: true, reliable }),
    historicalScores,
  };
  if (subscores) entry.subscores = subscores;
  if (skillsToWorkOn) entry.skillsToWorkOn = skillsToWorkOn;
  return entry;
}

/** Assemble a per-task entry for a task the student has not completed. */
function buildUnassessedTaskEntry(
  taskMeta: ServiceTaskMetadata,
  optional: boolean,
  historicalRuns: HistoricalRunRow[],
  historicalScoresByRun: Map<string, Map<string, string>>,
): ServiceIndividualStudentReportTask {
  // Historical scores are still meaningful for a not-completed task — earlier
  // administrations may have results. Use the representative variant's slug
  // for score-field resolution; we don't have a "scored" variant for this row.
  const historicalScores = buildHistoricalScoresForTask(
    taskMeta.taskId,
    taskMeta.taskSlug,
    null,
    historicalRuns,
    historicalScoresByRun,
  );

  return {
    ...taskMeta,
    scores: { rawScore: null, percentile: null, standardScore: null },
    supportLevel: optional ? 'optional' : null,
    reliable: null,
    optional,
    completed: false,
    engagementFlags: [],
    tags: buildTaskTags({ optional, completed: false, reliable: null }),
    historicalScores,
  };
}
