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
  ParsedFilter,
} from './report.types';
import { PROGRESS_TASK_STATUS_PATTERN } from '@roar-dashboard/api-contract';
import { Permissions } from '../../constants/permissions';
import { PROGRESS_STATUS_PRIORITY } from '../../constants/progress-status';
import { rolesForPermission } from '../../constants/role-permissions';
import { hasSupervisoryRole } from '../../utils/has-supervisory-role.util';
import { buildFilterConditions } from '../../utils/build-filter-conditions.util';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { ApiErrorMessage } from '../../enums/api-error-message.enum';
import { ApiError } from '../../errors/api-error';
import { logger } from '../../logger';
import { users } from '../../db/schema';
import { AdministrationRepository } from '../../repositories/administration.repository';
import { ReportRepository, REPORT_CONDITION_FIELD_MAP } from '../../repositories/report.repository';
import type {
  ReportTaskMeta,
  StudentProgressRow,
  ProgressStatusSortParam,
  ProgressStatusFilterParam,
} from '../../repositories/report.repository';
import { TaskService } from '../task/task.service';
import { conditionToSql } from '../../utils/condition-to-sql';
import type { Condition, ConditionEvaluationUser } from '../task/task.types';
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
 * ReportService
 *
 * Provides business logic for reporting endpoints.
 * Handles authorization, scope validation, and data assembly for reports.
 *
 * @param params - Configuration object with repository instances (optional)
 * @returns ReportService methods
 */
export function ReportService({
  administrationRepository = new AdministrationRepository(),
  reportRepository = new ReportRepository(),
  taskService = TaskService(),
}: {
  administrationRepository?: AdministrationRepository;
  reportRepository?: ReportRepository;
  taskService?: ReturnType<typeof TaskService>;
} = {}) {
  /**
   * Verify that an administration exists and the user has access to it.
   * Follows the 404-before-403 pattern from AdministrationService.
   *
   * @param authContext - User's auth context
   * @param administrationId - The administration ID to verify
   * @throws {ApiError} NOT_FOUND if administration doesn't exist
   * @throws {ApiError} FORBIDDEN if user lacks access
   */
  async function verifyAdministrationAccess(authContext: AuthContext, administrationId: string) {
    const { userId, isSuperAdmin } = authContext;

    const administration = await administrationRepository.getById({ id: administrationId });
    if (!administration) {
      throw new ApiError('Administration not found', {
        statusCode: StatusCodes.NOT_FOUND,
        code: ApiErrorCode.RESOURCE_NOT_FOUND,
        context: { userId, administrationId },
      });
    }

    if (isSuperAdmin) return;

    const allowedRoles = rolesForPermission(Permissions.Administrations.READ);
    const authorized = await administrationRepository.getAuthorizedById({ userId, allowedRoles }, administrationId);
    if (!authorized) {
      logger.warn({ userId, administrationId }, 'User attempted to access administration without permission');
      throw new ApiError(ApiErrorMessage.FORBIDDEN, {
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
        context: { userId, administrationId },
      });
    }
  }

  /**
   * Validate scope and authorize the user to access data at the requested scope level.
   *
   * Checks:
   * 1. The scope entity is assigned to the administration
   * 2. The user holds a supervisory role at or above the scope level
   *
   * @param authContext - User's auth context
   * @param administrationId - The administration ID
   * @param scopeType - The scope type (district, school, class, group)
   * @param scopeId - The scope entity ID
   * @throws {ApiError} BAD_REQUEST if scope is not assigned to the administration
   * @throws {ApiError} FORBIDDEN if user lacks a supervisory role at the scope level
   */
  async function authorizeScopeAccess(
    authContext: AuthContext,
    administrationId: string,
    scopeType: ScopeType,
    scopeId: string,
  ) {
    const { userId, isSuperAdmin } = authContext;

    // Validate scope is assigned to the administration
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

    // Verify user has a supervisory role at or above the scope level
    const userRoles = await reportRepository.getUserRolesAtOrAboveScope(userId, { scopeType, scopeId });

    if (!hasSupervisoryRole(userRoles)) {
      logger.warn(
        { userId, administrationId, scopeType, scopeId, userRoles },
        'User lacks supervisory role at the requested scope level',
      );
      throw new ApiError(ApiErrorMessage.FORBIDDEN, {
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
        context: { userId, administrationId, scopeType, scopeId },
      });
    }
  }

  /**
   * List paginated student progress for an administration.
   *
   * Authorization flow (three layers, checked in order):
   *
   * 1. **Administration access** (verifyAdministrationAccess):
   *    Checks the user can see the administration via the standard access control
   *    UNION query (same 6-path pattern used by AdministrationService).
   *
   * 2. **Report permission + supervisory role** (admin-level):
   *    `getUserRolesForAdministration` returns the user's roles on the administration
   *    (via org/class/group membership). We check both `Reports.Progress.READ` permission
   *    and `hasSupervisoryRole`. This catches students (no permission) and caregivers
   *    (have permission but not supervisory).
   *
   * 3. **Scope-level authorization** (authorizeScopeAccess):
   *    `getUserRolesAtOrAboveScope` checks the user holds a supervisory role at or
   *    above the requested scope entity using ltree ancestor queries. A district admin
   *    accessing a school scope within their district passes because `school_path <@ district_path`
   *    is true — the ltree `<@` operator includes descendants.
   *
   * These are intentionally separate role lookups querying different paths. A user could
   * pass the admin-level check (they have a role on the administration) but fail the
   * scope check (they don't have a role at that specific scope level). This prevents
   * e.g., a teacher at School A from viewing School B's report within a shared district
   * administration.
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
    const { userId, isSuperAdmin } = authContext;
    const { scopeType, scopeId, page, perPage, sortBy, sortOrder, filter } = query;

    try {
      // 1. Verify administration exists and user has access
      await verifyAdministrationAccess(authContext, administrationId);

      // 2. Verify permission and supervisory role for non-super-admins
      if (!isSuperAdmin) {
        const adminRoles = await administrationRepository.getUserRolesForAdministration(userId, administrationId);
        const allowedReportRoles: string[] = rolesForPermission(Permissions.Reports.Progress.READ);
        const hasPermission = adminRoles.some((role) => allowedReportRoles.includes(role));
        if (!hasPermission) {
          logger.warn(
            { userId, administrationId, adminRoles },
            'User lacks Reports.Progress.READ permission on administration',
          );
          throw new ApiError(ApiErrorMessage.FORBIDDEN, {
            statusCode: StatusCodes.FORBIDDEN,
            code: ApiErrorCode.AUTH_FORBIDDEN,
            context: { userId, administrationId },
          });
        }

        if (!hasSupervisoryRole(adminRoles)) {
          logger.warn({ userId, administrationId, adminRoles }, 'Supervised user attempted to access progress report');
          throw new ApiError(ApiErrorMessage.FORBIDDEN, {
            statusCode: StatusCodes.FORBIDDEN,
            code: ApiErrorCode.AUTH_FORBIDDEN,
            context: { userId, administrationId },
          });
        }
      }

      // 3. Validate scope and authorize
      await authorizeScopeAccess(authContext, administrationId, scopeType, scopeId);

      // 4. Get task metadata
      const taskMetas = await reportRepository.getTaskMetadata(administrationId);
      const taskVariantIds = taskMetas.map((t) => t.taskVariantId);

      // 5. Resolve sort column, progress sort, user filters, and progress filters.
      const { sortColumn, progressStatusSort } = resolveProgressSort(sortBy, taskMetas);
      const { userFilters, progressStatusFilters } = resolveProgressFilters(filter, taskMetas);

      const filterCondition =
        userFilters.length > 0
          ? buildFilterConditions(userFilters, PROGRESS_FILTER_FIELDS, { gradeAwareFields: GRADE_AWARE_FIELDS })
          : undefined;

      // 6. Get paginated students with run data.
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

      // 7. Transform to response shape
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
          schoolName: scopeType === 'district' ? (student.schoolName ?? null) : null,
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
   * Authorization flow is identical to listProgressStudents (three layers):
   * 1. Administration access
   * 2. Report permission + supervisory role
   * 3. Scope-level authorization
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
    const { userId, isSuperAdmin } = authContext;
    const { scopeType, scopeId } = query;

    try {
      // 1. Verify administration exists and user has access
      await verifyAdministrationAccess(authContext, administrationId);

      // 2. Verify permission and supervisory role for non-super-admins
      if (!isSuperAdmin) {
        const adminRoles = await administrationRepository.getUserRolesForAdministration(userId, administrationId);
        const allowedReportRoles: string[] = rolesForPermission(Permissions.Reports.Progress.READ);
        const hasPermission = adminRoles.some((role) => allowedReportRoles.includes(role));
        if (!hasPermission) {
          logger.warn(
            { userId, administrationId, adminRoles },
            'User lacks Reports.Progress.READ permission on administration',
          );
          throw new ApiError(ApiErrorMessage.FORBIDDEN, {
            statusCode: StatusCodes.FORBIDDEN,
            code: ApiErrorCode.AUTH_FORBIDDEN,
            context: { userId, administrationId },
          });
        }

        if (!hasSupervisoryRole(adminRoles)) {
          logger.warn(
            { userId, administrationId, adminRoles },
            'Supervised user attempted to access progress overview',
          );
          throw new ApiError(ApiErrorMessage.FORBIDDEN, {
            statusCode: StatusCodes.FORBIDDEN,
            code: ApiErrorCode.AUTH_FORBIDDEN,
            context: { userId, administrationId },
          });
        }
      }

      // 3. Validate scope and authorize
      await authorizeScopeAccess(authContext, administrationId, scopeType, scopeId);

      // 4. Get task metadata and run SQL-level aggregation
      const taskMetas = await reportRepository.getTaskMetadata(administrationId);

      const { totalStudents, taskStatusCounts } = await reportRepository.getProgressOverviewCounts(
        administrationId,
        { scopeType, scopeId },
        taskMetas,
      );

      // 5. Build per-task counters from unique taskIds (preserving order from metadata)
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

      // Initialize counters for all tasks (ensures tasks with zero counts appear in response)
      const taskCounters = new Map<
        string,
        { assigned: number; started: number; completed: number; optional: number }
      >();
      for (const taskId of taskIdOrder) {
        taskCounters.set(taskId, { assigned: 0, started: 0, completed: 0, optional: 0 });
      }

      // 6. Populate counters from SQL aggregation results
      for (const { taskId, status, count } of taskStatusCounts) {
        const counters = taskCounters.get(taskId);
        if (counters) {
          counters[status] += count;
        }
      }

      // 7. Assemble response
      let totalAssigned = 0;
      let totalStarted = 0;
      let totalCompleted = 0;

      const byTask: ServiceTaskOverview[] = taskIdOrder.map((taskId) => {
        const meta = taskMetaByTaskId.get(taskId)!;
        const counts = taskCounters.get(taskId)!;
        totalAssigned += counts.assigned;
        totalStarted += counts.started;
        totalCompleted += counts.completed;
        return {
          taskId: meta.taskId,
          taskSlug: meta.taskSlug,
          taskName: meta.taskName,
          orderIndex: meta.orderIndex,
          assigned: counts.assigned,
          started: counts.started,
          completed: counts.completed,
          optional: counts.optional,
        };
      });

      return {
        totalStudents,
        assigned: totalAssigned,
        started: totalStarted,
        completed: totalCompleted,
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

  return { listProgressStudents, getProgressOverview };
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
  requirementsSql: ReturnType<typeof conditionToSql>;
} {
  return {
    assignmentSql: conditionToSql(task.conditionsAssignment, REPORT_CONDITION_FIELD_MAP),
    requirementsSql: conditionToSql(task.conditionsRequirements, REPORT_CONDITION_FIELD_MAP),
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
    const { assignmentSql, requirementsSql } = buildConditionSqlParams(task);
    return {
      sortColumn: undefined,
      progressStatusSort: {
        taskVariantId: task.taskVariantId,
        assignmentSql,
        requirementsSql,
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
      const { assignmentSql, requirementsSql } = buildConditionSqlParams(task);
      const statusValues = f.operator === 'in' ? f.value.split(',').map((v) => v.trim()) : [f.value];
      progressStatusFilters.push({
        taskVariantId: task.taskVariantId,
        statusValues,
        assignmentSql,
        requirementsSql,
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

    if (run?.completedAt) {
      entry = {
        status: 'completed',
        startedAt: run.startedAt.toISOString(),
        completedAt: run.completedAt.toISOString(),
      };
    } else if (run) {
      // Run exists but not completed — a run's existence signals "started"
      entry = {
        status: 'started',
        startedAt: run.startedAt.toISOString(),
        completedAt: null,
      };
    } else {
      // No run — evaluate conditions to determine assigned vs optional.
      // StudentProgressRow satisfies ConditionEvaluationUser (the narrow interface),
      // so no cast is needed.
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
        status: isOptional ? 'optional' : 'assigned',
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
