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
  ParsedFilter,
} from './report.types';
import { PROGRESS_TASK_STATUS_PATTERN } from '@roar-dashboard/api-contract';
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
import { AuthorizationService } from '../authorization/authorization.service';
import { FgaType } from '../authorization/fga-constants';
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
  authorizationService = AuthorizationService(),
}: {
  administrationRepository?: AdministrationRepository;
  reportRepository?: ReportRepository;
  taskService?: ReturnType<typeof TaskService>;
  authorizationService?: ReturnType<typeof AuthorizationService>;
} = {}) {
  /** Map scope types to FGA object type prefixes. */
  const SCOPE_TO_FGA_TYPE: Record<ScopeType, FgaType> = {
    district: FgaType.DISTRICT,
    school: FgaType.SCHOOL,
    class: FgaType.CLASS,
    group: FgaType.GROUP,
  };

  /**
   * Check an FGA permission and throw FORBIDDEN if denied.
   *
   * Delegates to AuthorizationService.hasPermission() which handles `current_time`
   * context and `user:` prefix formatting. Maps denial to ApiError.
   *
   * @param userId - The user to check permission for
   * @param relation - The FGA relation to check (e.g., 'can_read_progress')
   * @param object - The FGA object (e.g., 'administration:uuid')
   * @throws {ApiError} FORBIDDEN if the FGA check returns allowed=false
   */
  async function checkFgaPermission(userId: string, relation: string, object: string): Promise<void> {
    const allowed = await authorizationService.hasPermission(userId, relation, object);

    if (!allowed) {
      logger.warn({ userId, relation, object }, 'FGA permission check denied');
      throw new ApiError(ApiErrorMessage.FORBIDDEN, {
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
        context: { userId, relation, object },
      });
    }
  }

  /**
   * Verify that an administration exists and the user has read-progress access.
   *
   * Follows the 404-before-403 pattern: checks existence via SQL first, then
   * delegates authorization to OpenFGA. The `can_read_progress` check subsumes
   * the general `can_read` check (supervisory-only is stricter than supervisory+student).
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

    // FGA can_read_progress covers both administration access and supervisory role requirement
    await checkFgaPermission(userId, 'can_read_progress', `${FgaType.ADMINISTRATION}:${administrationId}`);
  }

  /**
   * Validate scope and authorize the user to access data at the requested scope level.
   *
   * Checks:
   * 1. The scope entity is assigned to the administration (SQL validation)
   * 2. The user has can_read_progress on the scope entity (FGA authorization)
   *
   * @param authContext - User's auth context
   * @param administrationId - The administration ID
   * @param scopeType - The scope type (district, school, class, group)
   * @param scopeId - The scope entity ID
   * @throws {ApiError} BAD_REQUEST if scope is not assigned to the administration
   * @throws {ApiError} FORBIDDEN if user lacks permission at the scope level
   */
  async function authorizeScopeAccess(
    authContext: AuthContext,
    administrationId: string,
    scopeType: ScopeType,
    scopeId: string,
  ) {
    const { userId, isSuperAdmin } = authContext;

    // Validate scope is assigned to the administration (data validation, not auth)
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

    // FGA checks the user has supervisory-tier access at or above the scope level.
    // The FGA model's hierarchy traversal (via parent_org) replaces the SQL ltree queries.
    const fgaType = SCOPE_TO_FGA_TYPE[scopeType];
    await checkFgaPermission(userId, 'can_read_progress', `${fgaType}:${scopeId}`);
  }

  /**
   * List paginated student progress for an administration.
   *
   * Authorization flow (two FGA checks, in order):
   *
   * 1. **Administration access + report permission** (verifyAdministrationAccess):
   *    Checks existence via SQL, then delegates to FGA `can_read_progress` on the
   *    administration. This single FGA check covers both administration access and
   *    the supervisory role requirement (students and caregivers are excluded by
   *    the FGA model's `supervisory_tier_group` definition).
   *
   * 2. **Scope-level authorization** (authorizeScopeAccess):
   *    Validates the scope entity is part of the administration (SQL), then checks
   *    FGA `can_read_progress` on the scope entity. FGA's hierarchy traversal
   *    (via `parent_org`) replaces the SQL ltree ancestor queries.
   *
   * These are intentionally separate FGA checks. A user could pass the administration-level
   * check but fail the scope check if they don't have a role at that specific scope level.
   * This prevents e.g., a teacher at School A from viewing School B's report within a
   * shared district administration.
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
      // 1. Verify administration exists and user has can_read_progress permission
      await verifyAdministrationAccess(authContext, administrationId);

      // 2. Validate scope and authorize via FGA
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

  return { listProgressStudents };
}

/** Status priority for progress entries. Higher value = higher priority. */
const STATUS_PRIORITY: Record<string, number> = {
  optional: 0,
  assigned: 1,
  started: 2,
  completed: 3,
};

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
    if (!existing || (STATUS_PRIORITY[entry.status] ?? 0) > (STATUS_PRIORITY[existing.status] ?? 0)) {
      progress[task.taskId] = entry;
    }
  }

  return progress;
}
