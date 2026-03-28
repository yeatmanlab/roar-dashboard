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
import { Permissions } from '../../constants/permissions';
import { rolesForPermission } from '../../constants/role-permissions';
import { hasSupervisoryRole } from '../../utils/has-supervisory-role.util';
import { buildFilterConditions } from '../../utils/build-filter-conditions.util';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { ApiErrorMessage } from '../../enums/api-error-message.enum';
import { ApiError } from '../../errors/api-error';
import { logger } from '../../logger';
import { users } from '../../db/schema';
import { AdministrationRepository } from '../../repositories/administration.repository';
import { ReportRepository, type ReportTaskMeta, type StudentProgressRow } from '../../repositories/report.repository';
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
}: {
  administrationRepository?: AdministrationRepository;
  reportRepository?: ReportRepository;
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

      // 5. Resolve sort column and filter conditions.
      // sortBy is either a static user field or a dynamic progress.<taskId>.status field.
      // Static fields are mapped to columns; dynamic fields are validated and will be
      // wired to SQL CASE expressions in the progress-task-status-sort-filter branch.
      const sortColumn = PROGRESS_SORT_COLUMNS[sortBy as ProgressStudentsSortField];
      if (!sortColumn && PROGRESS_TASK_STATUS_PATTERN.test(sortBy)) {
        // Dynamic progress.<taskId>.status sort — validate the taskId exists.
        // The actual SQL-level sort is implemented in a downstream branch.
        const taskId = sortBy.split('.')[1]!;
        const validTaskIds = new Set(taskMetas.map((t) => t.taskId));
        if (!validTaskIds.has(taskId)) {
          throw new ApiError('Invalid task ID in sort field', {
            statusCode: StatusCodes.BAD_REQUEST,
            code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
            context: { sortBy, taskId, availableTaskIds: [...validTaskIds] },
          });
        }
        // TODO: Wire progress status sort to a SQL CASE expression via the repository.
        // For now, validated but falls through to default sort (users.nameLast).
      }

      // Separate user-level filters from progress.<taskId>.status filters.
      // User-level filters become SQL WHERE conditions.
      // Progress status filters are validated but not yet applied at the SQL level
      // (wired in the progress-task-status-sort-filter branch).
      // Only one progress status filter is supported per request.
      const userFilters: ParsedFilter[] = [];
      let progressFilterCount = 0;
      for (const f of filter) {
        if (PROGRESS_TASK_STATUS_PATTERN.test(f.field)) {
          progressFilterCount++;
          if (progressFilterCount > 1) {
            throw new ApiError('Only one progress status filter is supported per request', {
              statusCode: StatusCodes.BAD_REQUEST,
              code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
              context: { field: f.field },
            });
          }
          const taskId = f.field.split('.')[1]!;
          const validTaskIds = new Set(taskMetas.map((t) => t.taskId));
          if (!validTaskIds.has(taskId)) {
            throw new ApiError('Invalid task ID in filter field', {
              statusCode: StatusCodes.BAD_REQUEST,
              code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
              context: { field: f.field, taskId, availableTaskIds: [...validTaskIds] },
            });
          }
          // TODO: Wire progress status filter to SQL CASE expression via the repository.
          // For now, validated but not applied.
        } else {
          userFilters.push(f);
        }
      }
      const filterCondition =
        userFilters.length > 0
          ? buildFilterConditions(userFilters, PROGRESS_FILTER_FIELDS, { gradeAwareFields: GRADE_AWARE_FIELDS })
          : undefined;

      // 6. Get paginated students with run data
      const result = await reportRepository.getProgressStudents(
        administrationId,
        { scopeType, scopeId },
        taskVariantIds,
        { page, perPage, sortColumn, sortDirection: sortOrder },
        filterCondition,
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
        progress: buildProgressMap(student, taskMetas),
      }));

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

/**
 * Build a progress map for a student keyed by taskId.
 * Determines status from run data: completed > started > assigned.
 * Optional status requires condition evaluation (deferred — defaults to assigned).
 *
 * Exported for independent testing.
 */
export function buildProgressMap(
  student: StudentProgressRow,
  taskMetas: ReportTaskMeta[],
): Record<string, ServiceProgressEntry> {
  const progress: Record<string, ServiceProgressEntry> = {};

  for (const task of taskMetas) {
    const run = student.runs.get(task.taskVariantId);

    if (run?.completedAt) {
      progress[task.taskId] = {
        status: 'completed',
        startedAt: run.startedAt.toISOString(),
        completedAt: run.completedAt.toISOString(),
      };
    } else if (run) {
      // Run exists but not completed — a run's existence signals "started"
      progress[task.taskId] = {
        status: 'started',
        startedAt: run.startedAt.toISOString(),
        completedAt: null,
      };
    } else {
      // No run — default to assigned. Optional status requires condition evaluation
      // which is deferred for now (see plan: condition evaluation optimization).
      progress[task.taskId] = {
        status: 'assigned',
        startedAt: null,
        completedAt: null,
      };
    }
  }

  return progress;
}
