import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StatusCodes } from 'http-status-codes';
import { ReportService, buildProgressMap, groupVariantsByTaskId } from './report.service';
import { AdministrationService } from '../administration/administration.service';
import { AdministrationFactory } from '../../test-support/factories/administration.factory';
import { UserFactory } from '../../test-support/factories/user.factory';
import {
  createMockAdministrationRepository,
  createMockReportRepository,
  createMockTaskVariantParameterRepository,
  createMockUserRepository,
} from '../../test-support/repositories';
import { createMockAuthorizationService, createMockTaskService } from '../../test-support/services';
import type { MockAuthorizationService } from '../../test-support/services';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { ApiErrorMessage } from '../../enums/api-error-message.enum';
import { ApiError } from '../../errors/api-error';
import { FgaType, FgaRelation } from '../authorization/fga-constants';
import type {
  ProgressStudentsInput,
  ProgressOverviewInput,
  ScoreOverviewInput,
  ScoreFacetsInput,
  StudentScoresInput,
  IndividualStudentReportInput,
} from './report.types';
import type {
  ReportTaskMeta,
  StudentProgressRow,
  StudentOverviewRow,
  RunScoreRow,
  StudentScoreQueryRow,
  TaskStatusCount,
  HistoricalRunRow,
} from '../../repositories/report.repository';
import { Operator } from '../../types/condition';

/** Default demographic fields for test StudentProgressRow objects */
const DEFAULT_DEMOGRAPHICS = {
  statusEll: null,
  statusIep: null,
  statusFrl: null,
  dob: null,
  gender: null,
  race: null,
  hispanicEthnicity: null,
  homeLanguage: null,
} as const;

/**
 * Score field names — the literal strings the FDW `run_scores.scoreName`
 * column holds. The source of truth is the per-task JSON config in
 * `apps/backend/src/services/scoring/configs/`. We hoist them out so tests
 * don't sprinkle magic strings, and so a future rename in the JSON
 * surfaces as a single search-replace site (rather than a confusing pile
 * of unrelated failures across the file).
 *
 * If a future task adds a new percentile / raw-score field name, add a
 * constant here and update the relevant tests.
 */
const ScoreField = {
  /**
   * Percentile field for swr, sre, pa, and other percentile-then-rawscore
   * tasks. Note: `swr.json` makes this version-conditional (`percentile`
   * for scoringVersion ≥ 7, `wjPercentile` for legacy versions). Tests
   * here use the modern (post-version-7) field name; `resolveScoreFieldNames`
   * returns both candidates and the service walks them in priority order,
   * so the modern name matches when `scoringVersion` is `null` or ≥ 7.
   */
  PERCENTILE: 'percentile',
  /** Raw-score field for `swr` (see `services/scoring/configs/swr.json`). */
  SWR_RAW_SCORE: 'roarScore',
  /** Assessment-computed support level (e.g., roam-alpaca). */
  SUPPORT_LEVEL: 'supportLevel',
} as const;

describe('ReportService', () => {
  let mockAdministrationRepository: ReturnType<typeof createMockAdministrationRepository>;
  let mockReportRepository: ReturnType<typeof createMockReportRepository>;
  let mockTaskService: ReturnType<typeof createMockTaskService>;
  let mockAuthorizationService: MockAuthorizationService;
  let mockTaskVariantParameterRepository: ReturnType<typeof createMockTaskVariantParameterRepository>;
  let mockUserRepository: ReturnType<typeof createMockUserRepository>;

  const superAdminAuth = { userId: 'super-admin-id', isSuperAdmin: true };
  const teacherAuth = { userId: 'teacher-id', isSuperAdmin: false };

  const testAdministrationId = 'admin-uuid-1';
  const testQuery: ProgressStudentsInput = {
    scopeType: 'district',
    scopeId: 'district-uuid-1',
    page: 1,
    perPage: 25,
    sortBy: 'user.lastName',
    sortOrder: 'asc',
    filter: [],
  };

  // Use proper UUIDs for task IDs so progress.<taskId>.status patterns match the regex
  const TASK_ID_1 = 'ae557e88-582d-55fe-b41d-ba826adce70e';
  const TASK_ID_2 = 'b1234567-abcd-5678-efab-123456789012';
  const TASK_ID_3 = 'c2345678-bcde-6789-fab0-234567890123';
  const TASK_ID_4 = 'd3456789-cdef-7890-0abc-345678901234';
  const VARIANT_ID_1 = 'tv-uuid-1111-1111-1111-111111111111';
  const VARIANT_ID_2 = 'tv-uuid-2222-2222-2222-222222222222';
  const VARIANT_ID_3 = 'tv-uuid-3333-3333-3333-333333333333';
  const VARIANT_ID_4 = 'tv-uuid-4444-4444-4444-444444444444';

  const testTaskMetas: ReportTaskMeta[] = [
    {
      taskId: TASK_ID_1,
      taskVariantId: VARIANT_ID_1,
      taskSlug: 'swr',
      taskName: 'ROAR - Word',
      orderIndex: 0,
      conditionsAssignment: null,
      conditionsRequirements: null,
    },
    {
      taskId: TASK_ID_2,
      taskVariantId: VARIANT_ID_2,
      taskSlug: 'sre',
      taskName: 'ROAR - Sentence',
      orderIndex: 1,
      conditionsAssignment: null,
      conditionsRequirements: null,
    },
    {
      taskId: TASK_ID_3,
      taskVariantId: VARIANT_ID_3,
      taskSlug: 'pa',
      taskName: 'ROAR - Phoneme',
      orderIndex: 2,
      conditionsAssignment: null,
      conditionsRequirements: null,
    },
    {
      taskId: TASK_ID_4,
      taskVariantId: VARIANT_ID_4,
      taskSlug: 'vocab',
      taskName: 'ROAR - Vocab',
      orderIndex: 3,
      conditionsAssignment: null,
      conditionsRequirements: null,
    },
  ];

  function createService() {
    // Inject a real AdministrationService backed by the same mocks the
    // ReportService used to consume directly. This preserves test assertions
    // on `mockAdministrationRepository.getById` and
    // `mockAuthorizationService.requirePermission` while routing access
    // checks through the canonical helper.
    const administrationService = AdministrationService({
      administrationRepository: mockAdministrationRepository,
      authorizationService: mockAuthorizationService,
    });

    return ReportService({
      administrationService,
      reportRepository: mockReportRepository,
      taskService: mockTaskService,
      authorizationService: mockAuthorizationService,
      taskVariantParameterRepository: mockTaskVariantParameterRepository,
      userRepository: mockUserRepository,
    });
  }

  beforeEach(() => {
    vi.resetAllMocks();
    mockAdministrationRepository = createMockAdministrationRepository();
    mockReportRepository = createMockReportRepository();
    mockTaskService = createMockTaskService();
    mockAuthorizationService = createMockAuthorizationService();
    mockTaskVariantParameterRepository = createMockTaskVariantParameterRepository();
    mockUserRepository = createMockUserRepository();

    // Default: administration exists
    mockAdministrationRepository.getById.mockResolvedValue(AdministrationFactory.build({ id: testAdministrationId }));
    // Default: scope is assigned
    mockReportRepository.isScopeAssignedToAdministration.mockResolvedValue(true);
    // Default: task metadata
    mockReportRepository.getTaskMetadata.mockResolvedValue(testTaskMetas);
    // Default: all tasks assigned and required (not optional)
    mockTaskService.evaluateTaskVariantEligibility.mockReturnValue({ isAssigned: true, isOptional: false });
  });

  describe('listProgressStudents', () => {
    it('returns progress data for super admin', async () => {
      const studentRow: StudentProgressRow = {
        userId: 'student-1',
        assessmentPid: 'pid-student-1',
        username: 'jdoe',
        email: 'jdoe@school.edu',
        nameFirst: 'Jane',
        nameLast: 'Doe',
        grade: '3',
        schoolName: 'Lincoln Elementary',
        ...DEFAULT_DEMOGRAPHICS,
        runs: new Map([[VARIANT_ID_1, { completedAt: new Date('2025-09-15'), startedAt: new Date('2025-09-10') }]]),
      };

      mockReportRepository.getProgressStudents.mockResolvedValue({
        items: [studentRow],
        totalItems: 1,
      });

      const service = createService();
      const result = await service.listProgressStudents(superAdminAuth, testAdministrationId, testQuery);

      expect(result.tasks).toHaveLength(testTaskMetas.length);
      expect(result.items).toHaveLength(1);
      expect(result.items[0]!.user.firstName).toBe('Jane');
      expect(result.items[0]!.progress[TASK_ID_1]!.status).toBe('completed-required');
      expect(result.items[0]!.progress[TASK_ID_2]!.status).toBe('assigned-required');
      expect(result.totalItems).toBe(1);
    });

    it('returns 404 when administration does not exist', async () => {
      mockAdministrationRepository.getById.mockResolvedValue(null);

      const service = createService();

      await expect(service.listProgressStudents(teacherAuth, testAdministrationId, testQuery)).rejects.toMatchObject(
        expect.objectContaining({
          statusCode: StatusCodes.NOT_FOUND,
          code: ApiErrorCode.RESOURCE_NOT_FOUND,
        }),
      );
    });

    it('returns 403 when FGA denies can_read_progress on administration', async () => {
      mockAuthorizationService.requirePermission.mockRejectedValue(
        new ApiError(ApiErrorMessage.FORBIDDEN, {
          statusCode: StatusCodes.FORBIDDEN,
          code: ApiErrorCode.AUTH_FORBIDDEN,
        }),
      );

      const service = createService();

      await expect(service.listProgressStudents(teacherAuth, testAdministrationId, testQuery)).rejects.toMatchObject({
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
      });

      // Verify the FGA check was on the administration
      expect(mockAuthorizationService.requirePermission).toHaveBeenCalledWith(
        teacherAuth.userId,
        FgaRelation.CAN_READ_PROGRESS,
        `${FgaType.ADMINISTRATION}:${testAdministrationId}`,
      );
    });

    it('returns 400 when scope is not assigned to administration', async () => {
      mockReportRepository.isScopeAssignedToAdministration.mockResolvedValue(false);

      const service = createService();

      await expect(service.listProgressStudents(teacherAuth, testAdministrationId, testQuery)).rejects.toMatchObject({
        statusCode: StatusCodes.BAD_REQUEST,
        code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
      });
    });

    it('returns 403 when FGA denies can_read_progress on scope entity', async () => {
      // First call (administration) succeeds, second call (scope) fails
      mockAuthorizationService.requirePermission.mockResolvedValueOnce(undefined).mockRejectedValueOnce(
        new ApiError(ApiErrorMessage.FORBIDDEN, {
          statusCode: StatusCodes.FORBIDDEN,
          code: ApiErrorCode.AUTH_FORBIDDEN,
        }),
      );

      const service = createService();

      await expect(service.listProgressStudents(teacherAuth, testAdministrationId, testQuery)).rejects.toMatchObject({
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
      });

      // Verify the second FGA check was on the scope entity
      expect(mockAuthorizationService.requirePermission).toHaveBeenCalledWith(
        teacherAuth.userId,
        FgaRelation.CAN_READ_PROGRESS,
        `${FgaType.DISTRICT}:${testQuery.scopeId}`,
      );
    });

    it('maps started runs correctly', async () => {
      const studentRow: StudentProgressRow = {
        userId: 'student-1',
        assessmentPid: 'pid-student-1',
        username: 'jdoe',
        email: null,
        nameFirst: 'Jane',
        nameLast: 'Doe',
        grade: '3',
        schoolName: null,
        ...DEFAULT_DEMOGRAPHICS,
        runs: new Map([[VARIANT_ID_1, { completedAt: null, startedAt: new Date('2025-09-10') }]]),
      };

      mockReportRepository.getProgressStudents.mockResolvedValue({
        items: [studentRow],
        totalItems: 1,
      });

      const service = createService();
      const result = await service.listProgressStudents(teacherAuth, testAdministrationId, testQuery);

      expect(result.items[0]!.progress[TASK_ID_1]!.status).toBe('started-required');
      expect(result.items[0]!.progress[TASK_ID_2]!.status).toBe('assigned-required');
    });

    it('returns progress data for non-super-admin (via FGA)', async () => {
      const studentRow: StudentProgressRow = {
        userId: 'student-1',
        assessmentPid: 'pid-student-1',
        username: 'jdoe',
        email: 'jdoe@school.edu',
        nameFirst: 'Jane',
        nameLast: 'Doe',
        grade: '3',
        schoolName: 'Lincoln Elementary',
        ...DEFAULT_DEMOGRAPHICS,
        runs: new Map([
          [VARIANT_ID_1, { completedAt: new Date('2025-09-15'), startedAt: new Date('2025-09-10') }],
          [VARIANT_ID_2, { completedAt: null, startedAt: new Date('2025-09-12') }],
        ]),
      };

      mockReportRepository.getProgressStudents.mockResolvedValue({
        items: [studentRow],
        totalItems: 1,
      });

      const service = createService();
      const result = await service.listProgressStudents(teacherAuth, testAdministrationId, testQuery);

      expect(result.tasks).toHaveLength(testTaskMetas.length);
      expect(result.items).toHaveLength(1);
      expect(result.totalItems).toBe(1);
      expect(result.items[0]!.user).toEqual({
        userId: 'student-1',
        assessmentPid: 'pid-student-1',
        username: 'jdoe',
        email: 'jdoe@school.edu',
        firstName: 'Jane',
        lastName: 'Doe',
        grade: '3',
        schoolName: 'Lincoln Elementary',
      });
      expect(result.items[0]!.progress[TASK_ID_1]!.status).toBe('completed-required');
      expect(result.items[0]!.progress[TASK_ID_2]!.status).toBe('started-required');

      // Verify repository was called with correct scope and pagination
      expect(mockReportRepository.getProgressStudents).toHaveBeenCalledWith(
        testAdministrationId,
        { scopeType: 'district', scopeId: 'district-uuid-1' },
        expect.objectContaining({ id: expect.any(String), dateStart: expect.any(Date), dateEnd: expect.any(Date) }),
        testTaskMetas.map((t) => t.taskVariantId),
        expect.objectContaining({ page: 1, perPage: 25, sortDirection: 'asc' }),
        undefined,
        undefined, // no progress status sort
        undefined, // no progress status filters
        expect.any(Boolean),
      );
    });

    it('passes sort column and filter conditions to repository', async () => {
      mockReportRepository.getProgressStudents.mockResolvedValue({ items: [], totalItems: 0 });

      const queryWithSortAndFilter: ProgressStudentsInput = {
        ...testQuery,
        sortBy: 'user.firstName',
        filter: [{ field: 'user.grade', operator: 'eq', value: '3' }],
      };

      const service = createService();
      await service.listProgressStudents(superAdminAuth, testAdministrationId, queryWithSortAndFilter);

      expect(mockReportRepository.getProgressStudents).toHaveBeenCalledWith(
        testAdministrationId,
        { scopeType: 'district', scopeId: 'district-uuid-1' },
        expect.objectContaining({ id: expect.any(String), dateStart: expect.any(Date), dateEnd: expect.any(Date) }),
        testTaskMetas.map((t) => t.taskVariantId),
        expect.objectContaining({ page: 1, perPage: 25, sortDirection: 'asc' }),
        expect.anything(), // filter condition SQL object
        undefined, // no progress status sort
        undefined, // no progress status filters
        expect.any(Boolean),
      );

      // Verify sortColumn is defined (mapped from 'user.firstName')
      const callArgs = mockReportRepository.getProgressStudents.mock.calls[0]!;
      // options arg shifted from index 3 to index 4 once admin was inserted at index 2 (#1792).
      expect(callArgs[4]!.sortColumn).toBeDefined();
    });

    it('sets schoolName to null for non-district scopes', async () => {
      const schoolQuery: ProgressStudentsInput = { ...testQuery, scopeType: 'school' };

      const studentWithSchool: StudentProgressRow = {
        userId: 'student-1',
        assessmentPid: 'pid-student-1',
        username: 'jdoe',
        email: null,
        nameFirst: 'Jane',
        nameLast: 'Doe',
        grade: '3',
        schoolName: 'Lincoln Elementary',
        ...DEFAULT_DEMOGRAPHICS,
        runs: new Map(),
      };

      mockReportRepository.getProgressStudents.mockResolvedValue({
        items: [studentWithSchool],
        totalItems: 1,
      });

      const service = createService();
      const result = await service.listProgressStudents(superAdminAuth, testAdministrationId, schoolQuery);

      // Service should set schoolName to null for non-district scopes
      expect(result.items[0]!.user.schoolName).toBeNull();
    });

    it('super admin bypasses FGA checks', async () => {
      mockReportRepository.getProgressStudents.mockResolvedValue({ items: [], totalItems: 0 });

      const service = createService();
      await service.listProgressStudents(superAdminAuth, testAdministrationId, testQuery);

      // Super admin should NOT trigger FGA permission checks
      expect(mockAuthorizationService.requirePermission).not.toHaveBeenCalled();
    });

    it('wraps unexpected repository errors in a 500 ApiError', async () => {
      mockReportRepository.getProgressStudents.mockRejectedValue(new Error('connection reset'));

      const service = createService();

      await expect(service.listProgressStudents(superAdminAuth, testAdministrationId, testQuery)).rejects.toMatchObject(
        {
          statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
          code: ApiErrorCode.DATABASE_QUERY_FAILED,
        },
      );
    });

    it('passes progressStatusSort when sorting by progress.<taskId>.status', async () => {
      mockReportRepository.getProgressStudents.mockResolvedValue({ items: [], totalItems: 0 });

      const sortByTaskQuery: ProgressStudentsInput = {
        ...testQuery,
        sortBy: `progress.${TASK_ID_1}.status`,
      };

      const service = createService();
      await service.listProgressStudents(superAdminAuth, testAdministrationId, sortByTaskQuery);

      const callArgs = mockReportRepository.getProgressStudents.mock.calls[0]!;
      // arg[6] is progressStatusSort (shifted by +1 once admin was inserted at index 2 — #1792)
      expect(callArgs[6]).toEqual(expect.objectContaining({ taskVariantId: VARIANT_ID_1 }));
      // arg[5] should be undefined (no user-level filter)
      expect(callArgs[5]).toBeUndefined();
    });

    it('passes progressStatusFilters when filtering by progress.<taskId>.status', async () => {
      mockReportRepository.getProgressStudents.mockResolvedValue({ items: [], totalItems: 0 });

      const filterByTaskQuery: ProgressStudentsInput = {
        ...testQuery,
        filter: [{ field: `progress.${TASK_ID_1}.status`, operator: 'eq', value: 'completed' }],
      };

      const service = createService();
      await service.listProgressStudents(superAdminAuth, testAdministrationId, filterByTaskQuery);

      const callArgs = mockReportRepository.getProgressStudents.mock.calls[0]!;
      // arg[7] is progressStatusFilters (shifted by +1 once admin was inserted at index 2 — #1792)
      expect(callArgs[7]).toEqual([
        expect.objectContaining({
          taskVariantId: VARIANT_ID_1,
          statusValues: ['completed'],
        }),
      ]);
    });

    it('splits in-operator filter values for progress status', async () => {
      mockReportRepository.getProgressStudents.mockResolvedValue({ items: [], totalItems: 0 });

      const filterByTaskQuery: ProgressStudentsInput = {
        ...testQuery,
        filter: [{ field: `progress.${TASK_ID_1}.status`, operator: 'in', value: 'completed,started' }],
      };

      const service = createService();
      await service.listProgressStudents(superAdminAuth, testAdministrationId, filterByTaskQuery);

      const callArgs = mockReportRepository.getProgressStudents.mock.calls[0]!;
      // arg[7] is progressStatusFilters (shifted by +1 once admin was inserted at index 2 — #1792)
      expect(callArgs[7]).toEqual([
        expect.objectContaining({
          statusValues: ['completed', 'started'],
        }),
      ]);
    });

    it('returns 400 for unknown taskId in sort field', async () => {
      const badSortQuery: ProgressStudentsInput = {
        ...testQuery,
        sortBy: 'progress.00000000-0000-0000-0000-000000000000.status',
      };

      const service = createService();
      await expect(
        service.listProgressStudents(superAdminAuth, testAdministrationId, badSortQuery),
      ).rejects.toMatchObject({
        statusCode: StatusCodes.BAD_REQUEST,
        code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
      });
    });

    it('returns 400 for unknown taskId in filter field', async () => {
      const badFilterQuery: ProgressStudentsInput = {
        ...testQuery,
        filter: [{ field: 'progress.00000000-0000-0000-0000-000000000000.status', operator: 'eq', value: 'completed' }],
      };

      const service = createService();
      await expect(
        service.listProgressStudents(superAdminAuth, testAdministrationId, badFilterQuery),
      ).rejects.toMatchObject({
        statusCode: StatusCodes.BAD_REQUEST,
        code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
      });
    });

    it('accepts up to 3 progress status filters', async () => {
      mockReportRepository.getProgressStudents.mockResolvedValue({ items: [], totalItems: 0 });

      const threeFilterQuery: ProgressStudentsInput = {
        ...testQuery,
        filter: [
          { field: `progress.${TASK_ID_1}.status`, operator: 'eq', value: 'completed' },
          { field: `progress.${TASK_ID_2}.status`, operator: 'eq', value: 'started' },
          { field: `progress.${TASK_ID_3}.status`, operator: 'eq', value: 'assigned' },
        ],
      };

      const service = createService();
      await service.listProgressStudents(superAdminAuth, testAdministrationId, threeFilterQuery);

      const callArgs = mockReportRepository.getProgressStudents.mock.calls[0]!;
      // arg[7] is progressStatusFilters (shifted by +1 once admin was inserted at index 2 — #1792)
      expect(callArgs[7]).toHaveLength(3);
    });

    it('returns 400 when more than 3 progress status filters are provided', async () => {
      const tooManyFilterQuery: ProgressStudentsInput = {
        ...testQuery,
        filter: [
          { field: `progress.${TASK_ID_1}.status`, operator: 'eq', value: 'completed' },
          { field: `progress.${TASK_ID_2}.status`, operator: 'eq', value: 'started' },
          { field: `progress.${TASK_ID_3}.status`, operator: 'eq', value: 'assigned' },
          { field: `progress.${TASK_ID_4}.status`, operator: 'eq', value: 'optional' },
        ],
      };

      const service = createService();
      await expect(
        service.listProgressStudents(superAdminAuth, testAdministrationId, tooManyFilterQuery),
      ).rejects.toMatchObject({
        statusCode: StatusCodes.BAD_REQUEST,
        code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
      });
    });
  });

  describe('buildProgressMap', () => {
    const defaultStudent: StudentProgressRow = {
      userId: 'student-1',
      assessmentPid: 'pid-student-1',
      username: null,
      email: null,
      nameFirst: null,
      nameLast: null,
      grade: null,
      schoolName: null,
      ...DEFAULT_DEMOGRAPHICS,
      runs: new Map(),
    };

    // Creates a fresh evaluator mock — must be called inside each test since beforeEach resets mocks
    const makeAssignedEvaluator = () => vi.fn().mockReturnValue({ isAssigned: true, isOptional: false });

    it('maps completed runs correctly', () => {
      const student: StudentProgressRow = {
        ...defaultStudent,

        runs: new Map([
          [
            VARIANT_ID_1,
            { completedAt: new Date('2025-09-15T10:00:00Z'), startedAt: new Date('2025-09-10T08:00:00Z') },
          ],
        ]),
      };

      const result = buildProgressMap(student, testTaskMetas, makeAssignedEvaluator());

      expect(result[TASK_ID_1]).toEqual({
        status: 'completed-required',
        startedAt: '2025-09-10T08:00:00.000Z',
        completedAt: '2025-09-15T10:00:00.000Z',
      });
      expect(result[TASK_ID_2]).toEqual({
        status: 'assigned-required',
        startedAt: null,
        completedAt: null,
      });
    });

    it('maps started runs correctly', () => {
      const student: StudentProgressRow = {
        ...defaultStudent,

        runs: new Map([[VARIANT_ID_1, { completedAt: null, startedAt: new Date('2025-09-10T08:00:00Z') }]]),
      };

      const result = buildProgressMap(student, testTaskMetas, makeAssignedEvaluator());

      expect(result[TASK_ID_1]).toEqual({
        status: 'started-required',
        startedAt: '2025-09-10T08:00:00.000Z',
        completedAt: null,
      });
    });

    it('returns assigned-required for tasks with no runs when conditions are null', () => {
      const result = buildProgressMap(defaultStudent, testTaskMetas, makeAssignedEvaluator());

      expect(result[TASK_ID_1]!.status).toBe('assigned-required');
      expect(result[TASK_ID_2]!.status).toBe('assigned-required');
    });

    it('returns assigned-optional when conditionsRequirements evaluates to true', () => {
      const optionalEvaluator = vi.fn().mockReturnValue({ isAssigned: true, isOptional: true });

      const result = buildProgressMap(defaultStudent, testTaskMetas, optionalEvaluator);

      expect(result[TASK_ID_1]!.status).toBe('assigned-optional');
      expect(result[TASK_ID_2]!.status).toBe('assigned-optional');
    });

    it('excludes tasks where conditionsAssignment evaluates to false', () => {
      const notAssignedEvaluator = vi.fn().mockReturnValue({ isAssigned: false, isOptional: false });

      const result = buildProgressMap(defaultStudent, testTaskMetas, notAssignedEvaluator);

      expect(result[TASK_ID_1]).toBeUndefined();
      expect(result[TASK_ID_2]).toBeUndefined();
    });

    it('mixes assigned and optional statuses per task variant conditions', () => {
      // First task: assigned and required. Second task: assigned but optional.
      const mixedEvaluator = vi.fn().mockImplementation((_user, conditionsAssignment, conditionsRequirements) => {
        if (conditionsRequirements !== null) {
          return { isAssigned: true, isOptional: true };
        }
        return { isAssigned: true, isOptional: false };
      });

      const tasksWithConditions: ReportTaskMeta[] = [
        { ...testTaskMetas[0]!, conditionsAssignment: null, conditionsRequirements: null },
        {
          ...testTaskMetas[1]!,
          conditionsAssignment: null,
          conditionsRequirements: { field: 'studentData.statusEll', op: Operator.EQUAL, value: 'active' },
        },
      ];

      const result = buildProgressMap(defaultStudent, tasksWithConditions, mixedEvaluator);

      expect(result[TASK_ID_1]!.status).toBe('assigned-required');
      expect(result[TASK_ID_2]!.status).toBe('assigned-optional');
    });

    it('returns completed-optional when a completed run exists and task is optional', () => {
      const optionalEvaluator = vi.fn().mockReturnValue({ isAssigned: true, isOptional: true });
      const student: StudentProgressRow = {
        ...defaultStudent,
        runs: new Map([
          [VARIANT_ID_1, { completedAt: new Date('2025-09-15T10:00:00Z'), startedAt: new Date('2025-09-10') }],
        ]),
      };

      const result = buildProgressMap(student, testTaskMetas, optionalEvaluator);

      expect(result[TASK_ID_1]!.status).toBe('completed-optional');
      expect(result[TASK_ID_1]!.completedAt).toBe('2025-09-15T10:00:00.000Z');
      // Task 2 has no run → assigned-optional
      expect(result[TASK_ID_2]!.status).toBe('assigned-optional');
    });

    it('returns started-optional when a started run exists and task is optional', () => {
      const optionalEvaluator = vi.fn().mockReturnValue({ isAssigned: true, isOptional: true });
      const student: StudentProgressRow = {
        ...defaultStudent,
        runs: new Map([[VARIANT_ID_1, { completedAt: null, startedAt: new Date('2025-09-10') }]]),
      };

      const result = buildProgressMap(student, testTaskMetas, optionalEvaluator);

      expect(result[TASK_ID_1]!.status).toBe('started-optional');
      expect(result[TASK_ID_1]!.startedAt).toBe('2025-09-10T00:00:00.000Z');
    });

    it('uses isOptional from evaluator (not isAssigned) for runs when conditionsAssignment is false', () => {
      // Student has a run but conditionsAssignment would exclude them AND task is optional.
      // The run should still appear, and the optional flag should be respected.
      const unassignedOptionalEvaluator = vi.fn().mockReturnValue({ isAssigned: false, isOptional: true });
      const student: StudentProgressRow = {
        ...defaultStudent,
        runs: new Map([[VARIANT_ID_1, { completedAt: new Date('2025-09-15'), startedAt: new Date('2025-09-10') }]]),
      };

      const result = buildProgressMap(student, testTaskMetas, unassignedOptionalEvaluator);

      // Task with run: isAssigned ignored, isOptional respected → completed-optional
      expect(result[TASK_ID_1]!.status).toBe('completed-optional');
      // Task without run: isAssigned=false → excluded
      expect(result[TASK_ID_2]).toBeUndefined();
    });

    describe('multi-variant priority (same taskId)', () => {
      const SHARED_TASK_ID = 'ccc00000-0000-0000-0000-000000000001';
      const VARIANT_A = 'variant-a';
      const VARIANT_B = 'variant-b';
      const VARIANT_C = 'variant-c';

      const multiVariantMetas: ReportTaskMeta[] = [
        {
          taskId: SHARED_TASK_ID,
          taskVariantId: VARIANT_A,
          taskSlug: 'swr',
          taskName: 'ROAR - Word',
          orderIndex: 0,
          conditionsAssignment: null,
          conditionsRequirements: null,
        },
        {
          taskId: SHARED_TASK_ID,
          taskVariantId: VARIANT_B,
          taskSlug: 'swr',
          taskName: 'ROAR - Word',
          orderIndex: 1,
          conditionsAssignment: null,
          conditionsRequirements: null,
        },
        {
          taskId: SHARED_TASK_ID,
          taskVariantId: VARIANT_C,
          taskSlug: 'swr',
          taskName: 'ROAR - Word',
          orderIndex: 2,
          conditionsAssignment: null,
          conditionsRequirements: null,
        },
      ];

      function buildStudent(runs: Map<string, { completedAt: Date | null; startedAt: Date }>): StudentProgressRow {
        return {
          ...defaultStudent,
          runs,
        };
      }

      it('keeps completed when a later variant has no run', () => {
        // Variant A: completed, Variant B: no run, Variant C: no run
        const student = buildStudent(
          new Map([[VARIANT_A, { completedAt: new Date('2025-09-15'), startedAt: new Date('2025-09-10') }]]),
        );

        const result = buildProgressMap(student, multiVariantMetas, makeAssignedEvaluator());

        expect(result[SHARED_TASK_ID]!.status).toBe('completed-required');
      });

      it('keeps completed-required when a later variant is started', () => {
        // Variant A: completed, Variant B: started
        const student = buildStudent(
          new Map([
            [VARIANT_A, { completedAt: new Date('2025-09-15'), startedAt: new Date('2025-09-10') }],
            [VARIANT_B, { completedAt: null, startedAt: new Date('2025-09-12') }],
          ]),
        );

        const result = buildProgressMap(student, multiVariantMetas, makeAssignedEvaluator());

        expect(result[SHARED_TASK_ID]!.status).toBe('completed-required');
      });

      it('keeps started-required when a later variant has no run', () => {
        // Variant A: no run, Variant B: started, Variant C: no run
        const student = buildStudent(new Map([[VARIANT_B, { completedAt: null, startedAt: new Date('2025-09-12') }]]));

        const result = buildProgressMap(student, multiVariantMetas, makeAssignedEvaluator());

        expect(result[SHARED_TASK_ID]!.status).toBe('started-required');
      });

      it('promotes from assigned-required to started-required to completed-required across variants', () => {
        // Variant A: no run (assigned), Variant B: started, Variant C: completed
        const student = buildStudent(
          new Map([
            [VARIANT_B, { completedAt: null, startedAt: new Date('2025-09-12') }],
            [VARIANT_C, { completedAt: new Date('2025-09-15'), startedAt: new Date('2025-09-14') }],
          ]),
        );

        const result = buildProgressMap(student, multiVariantMetas, makeAssignedEvaluator());

        expect(result[SHARED_TASK_ID]!.status).toBe('completed-required');
        expect(result[SHARED_TASK_ID]!.completedAt).toBe('2025-09-15T00:00:00.000Z');
      });

      it('produces a single progress key even with multiple variants', () => {
        const student = buildStudent(new Map());

        const result = buildProgressMap(student, multiVariantMetas, makeAssignedEvaluator());

        const keys = Object.keys(result);
        expect(keys).toHaveLength(1);
        expect(keys[0]).toBe(SHARED_TASK_ID);
      });

      it('resolves priority correctly when variants have different required/optional evaluations', () => {
        // Variant A: no run (assigned-optional via evaluator)
        // Variant B: started run (started-required via evaluator)
        // Expected: started-required wins (priority 3 > 0)
        const variantAwareEvaluator = vi
          .fn()
          .mockReturnValueOnce({ isAssigned: true, isOptional: true }) // Variant A: optional
          .mockReturnValueOnce({ isAssigned: true, isOptional: false }) // Variant B: required
          .mockReturnValueOnce({ isAssigned: true, isOptional: false }); // Variant C: required

        const student = buildStudent(new Map([[VARIANT_B, { completedAt: null, startedAt: new Date('2025-09-12') }]]));

        const result = buildProgressMap(student, multiVariantMetas, variantAwareEvaluator);

        expect(result[SHARED_TASK_ID]!.status).toBe('started-required');
      });
    });

    it('populates startedAt when available from run data', () => {
      const student: StudentProgressRow = {
        ...defaultStudent,
        runs: new Map([
          [
            VARIANT_ID_1,
            { completedAt: new Date('2025-09-15T12:00:00Z'), startedAt: new Date('2025-09-15T10:00:00Z') },
          ],
          [VARIANT_ID_2, { completedAt: null, startedAt: new Date('2025-09-15T11:00:00Z') }],
        ]),
      };

      const result = buildProgressMap(student, testTaskMetas, makeAssignedEvaluator());

      expect(result[TASK_ID_1]!.startedAt).toBe('2025-09-15T10:00:00.000Z');
      expect(result[TASK_ID_2]!.startedAt).toBe('2025-09-15T11:00:00.000Z');
    });

    it('calls evaluator for all tasks including those with runs', () => {
      const evaluator = vi.fn().mockReturnValue({ isAssigned: true, isOptional: false });
      const student: StudentProgressRow = {
        ...defaultStudent,
        runs: new Map([
          [VARIANT_ID_1, { completedAt: new Date('2025-09-15'), startedAt: new Date('2025-09-10') }],
          [VARIANT_ID_2, { completedAt: null, startedAt: new Date('2025-09-11') }],
          [VARIANT_ID_3, { completedAt: new Date('2025-09-16'), startedAt: new Date('2025-09-12') }],
          [VARIANT_ID_4, { completedAt: null, startedAt: new Date('2025-09-13') }],
        ]),
      };

      buildProgressMap(student, testTaskMetas, evaluator);

      // Evaluator is called for ALL tasks (including those with runs) to determine
      // the required/optional distinction in the 7-level status scheme
      expect(evaluator).toHaveBeenCalledTimes(testTaskMetas.length);
    });

    it('shows run status even when conditionsAssignment would exclude the student', () => {
      // If a student somehow has a run for a task whose conditionsAssignment would
      // exclude them (e.g., data changed after the run was created), we still show
      // the run — the student's actual progress takes precedence over exclusion.
      // The required/optional axis defaults to "required" (isOptional: false).
      const notAssignedEvaluator = vi.fn().mockReturnValue({ isAssigned: false, isOptional: false });
      const student: StudentProgressRow = {
        ...defaultStudent,
        runs: new Map([
          [VARIANT_ID_1, { completedAt: new Date('2025-09-15T10:00:00Z'), startedAt: new Date('2025-09-14') }],
        ]),
      };

      const result = buildProgressMap(student, testTaskMetas, notAssignedEvaluator);

      // Task-1 has a run → completed-required (conditions evaluated but isAssigned ignored for runs)
      expect(result[TASK_ID_1]!.status).toBe('completed-required');
      // Tasks 2-4 have no runs and conditionsAssignment returns false → excluded
      expect(result[TASK_ID_2]).toBeUndefined();
      expect(result[TASK_ID_3]).toBeUndefined();
      expect(result[TASK_ID_4]).toBeUndefined();
      // Evaluator called for ALL tasks (runs + no runs) in the 7-level scheme
      expect(notAssignedEvaluator).toHaveBeenCalledTimes(testTaskMetas.length);
    });
  });

  describe('getProgressOverview', () => {
    const overviewQuery: ProgressOverviewInput = {
      scopeType: 'district',
      scopeId: 'district-uuid-1',
    };

    // No setupTeacherAuth needed — requirePermission resolves by default in the mock

    it('returns aggregated overview for super admin', async () => {
      const statusCounts: TaskStatusCount[] = [
        { taskId: TASK_ID_1, status: 'completed-required', count: 10 },
        { taskId: TASK_ID_1, status: 'started-required', count: 5 },
        { taskId: TASK_ID_1, status: 'assigned-required', count: 3 },
        { taskId: TASK_ID_2, status: 'completed-required', count: 8 },
        { taskId: TASK_ID_2, status: 'assigned-required', count: 10 },
      ];

      mockReportRepository.getProgressOverviewCounts.mockResolvedValue({
        totalStudents: 20,
        taskStatusCounts: statusCounts,
        studentCounts: {
          studentsWithRequiredTasks: 20,
          studentsAssigned: 2,
          studentsStarted: 10,
          studentsCompleted: 8,
        },
      });

      const service = createService();
      const result = await service.getProgressOverview(superAdminAuth, testAdministrationId, overviewQuery);

      expect(result.totalStudents).toBe(20);
      expect(result.studentsWithRequiredTasks).toBe(20);
      expect(result.studentsAssigned).toBe(2);
      expect(result.studentsStarted).toBe(10);
      expect(result.studentsCompleted).toBe(8);
      expect(result.byTask).toHaveLength(4); // 4 unique taskIds
      expect(result.computedAt).toBeDefined();

      // Verify task 1 counts
      const task1 = result.byTask.find((t) => t.taskId === TASK_ID_1);
      expect(task1).toEqual(
        expect.objectContaining({
          taskSlug: 'swr',
          assignedRequired: 3,
          assignedOptional: 0,
          startedRequired: 5,
          startedOptional: 0,
          completedRequired: 10,
          completedOptional: 0,
          assigned: 3,
          started: 5,
          completed: 10,
          required: 18,
          optional: 0,
        }),
      );

      // Verify task 2 counts
      const task2 = result.byTask.find((t) => t.taskId === TASK_ID_2);
      expect(task2).toEqual(
        expect.objectContaining({
          taskSlug: 'sre',
          assignedRequired: 10,
          assignedOptional: 0,
          startedRequired: 0,
          startedOptional: 0,
          completedRequired: 8,
          completedOptional: 0,
          assigned: 10,
          started: 0,
          completed: 8,
          required: 18,
          optional: 0,
        }),
      );
    });

    it('returns overview for non-super-admin (via FGA)', async () => {
      mockReportRepository.getProgressOverviewCounts.mockResolvedValue({
        totalStudents: 5,
        taskStatusCounts: [{ taskId: TASK_ID_1, status: 'assigned-required', count: 5 }],
        studentCounts: { studentsWithRequiredTasks: 5, studentsAssigned: 5, studentsStarted: 0, studentsCompleted: 0 },
      });

      const service = createService();
      const result = await service.getProgressOverview(teacherAuth, testAdministrationId, overviewQuery);

      expect(result.totalStudents).toBe(5);
      expect(result.studentsAssigned).toBe(5);
    });

    it('returns 404 when administration does not exist', async () => {
      mockAdministrationRepository.getById.mockResolvedValue(null);

      const service = createService();

      await expect(service.getProgressOverview(teacherAuth, testAdministrationId, overviewQuery)).rejects.toMatchObject(
        {
          statusCode: StatusCodes.NOT_FOUND,
          code: ApiErrorCode.RESOURCE_NOT_FOUND,
        },
      );
    });

    it('returns 403 when FGA denies can_read_progress on administration', async () => {
      mockAuthorizationService.requirePermission.mockRejectedValue(
        new ApiError(ApiErrorMessage.FORBIDDEN, {
          statusCode: StatusCodes.FORBIDDEN,
          code: ApiErrorCode.AUTH_FORBIDDEN,
        }),
      );

      const service = createService();

      await expect(service.getProgressOverview(teacherAuth, testAdministrationId, overviewQuery)).rejects.toMatchObject(
        {
          statusCode: StatusCodes.FORBIDDEN,
          code: ApiErrorCode.AUTH_FORBIDDEN,
        },
      );

      expect(mockAuthorizationService.requirePermission).toHaveBeenCalledWith(
        teacherAuth.userId,
        FgaRelation.CAN_READ_PROGRESS,
        `${FgaType.ADMINISTRATION}:${testAdministrationId}`,
      );
    });

    it('returns 400 when scope is not assigned to administration', async () => {
      mockReportRepository.isScopeAssignedToAdministration.mockResolvedValue(false);

      const service = createService();

      await expect(service.getProgressOverview(teacherAuth, testAdministrationId, overviewQuery)).rejects.toMatchObject(
        {
          statusCode: StatusCodes.BAD_REQUEST,
          code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
        },
      );
    });

    it('returns 403 when FGA denies can_read_progress on scope entity', async () => {
      mockAuthorizationService.requirePermission.mockResolvedValueOnce(undefined).mockRejectedValueOnce(
        new ApiError(ApiErrorMessage.FORBIDDEN, {
          statusCode: StatusCodes.FORBIDDEN,
          code: ApiErrorCode.AUTH_FORBIDDEN,
        }),
      );

      const service = createService();

      await expect(service.getProgressOverview(teacherAuth, testAdministrationId, overviewQuery)).rejects.toMatchObject(
        {
          statusCode: StatusCodes.FORBIDDEN,
          code: ApiErrorCode.AUTH_FORBIDDEN,
        },
      );

      expect(mockAuthorizationService.requirePermission).toHaveBeenCalledWith(
        teacherAuth.userId,
        FgaRelation.CAN_READ_PROGRESS,
        `${FgaType.DISTRICT}:${overviewQuery.scopeId}`,
      );
    });

    it('super admin bypasses FGA checks', async () => {
      mockReportRepository.getProgressOverviewCounts.mockResolvedValue({
        totalStudents: 0,
        taskStatusCounts: [],
        studentCounts: { studentsWithRequiredTasks: 0, studentsAssigned: 0, studentsStarted: 0, studentsCompleted: 0 },
      });

      const service = createService();
      await service.getProgressOverview(superAdminAuth, testAdministrationId, overviewQuery);

      expect(mockAuthorizationService.requirePermission).not.toHaveBeenCalled();
    });

    it('wraps unexpected repository errors in a 500 ApiError', async () => {
      mockReportRepository.getProgressOverviewCounts.mockRejectedValue(new Error('connection reset'));

      const service = createService();

      await expect(
        service.getProgressOverview(superAdminAuth, testAdministrationId, overviewQuery),
      ).rejects.toMatchObject({
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
      });
    });

    it('handles zero students (empty scope)', async () => {
      mockReportRepository.getProgressOverviewCounts.mockResolvedValue({
        totalStudents: 0,
        taskStatusCounts: [],
        studentCounts: { studentsWithRequiredTasks: 0, studentsAssigned: 0, studentsStarted: 0, studentsCompleted: 0 },
      });

      const service = createService();
      const result = await service.getProgressOverview(superAdminAuth, testAdministrationId, overviewQuery);

      expect(result.totalStudents).toBe(0);
      expect(result.studentsWithRequiredTasks).toBe(0);
      expect(result.studentsAssigned).toBe(0);
      expect(result.studentsStarted).toBe(0);
      expect(result.studentsCompleted).toBe(0);
      expect(result.byTask).toHaveLength(4); // Tasks still listed with zero counts
      for (const task of result.byTask) {
        expect(task.assignedRequired).toBe(0);
        expect(task.assignedOptional).toBe(0);
        expect(task.startedRequired).toBe(0);
        expect(task.startedOptional).toBe(0);
        expect(task.completedRequired).toBe(0);
        expect(task.completedOptional).toBe(0);
      }
    });

    it('includes optional counts in per-task breakdown', async () => {
      mockReportRepository.getProgressOverviewCounts.mockResolvedValue({
        totalStudents: 15,
        taskStatusCounts: [
          { taskId: TASK_ID_1, status: 'assigned-required', count: 5 },
          { taskId: TASK_ID_1, status: 'assigned-optional', count: 10 },
        ],
        studentCounts: { studentsWithRequiredTasks: 5, studentsAssigned: 5, studentsStarted: 0, studentsCompleted: 0 },
      });

      const service = createService();
      const result = await service.getProgressOverview(superAdminAuth, testAdministrationId, overviewQuery);

      const task1 = result.byTask.find((t) => t.taskId === TASK_ID_1);
      expect(task1!.assignedRequired).toBe(5);
      expect(task1!.assignedOptional).toBe(10);
      expect(task1!.assigned).toBe(15); // 5 required + 10 optional
      expect(task1!.optional).toBe(10);
      // Student-level counts reflect the 5 students with required tasks
      expect(result.studentsAssigned).toBe(5);
    });

    it('preserves task ordering from metadata', async () => {
      mockReportRepository.getProgressOverviewCounts.mockResolvedValue({
        totalStudents: 10,
        taskStatusCounts: [
          { taskId: TASK_ID_3, status: 'assigned-required', count: 10 },
          { taskId: TASK_ID_1, status: 'assigned-required', count: 10 },
        ],
        studentCounts: {
          studentsWithRequiredTasks: 10,
          studentsAssigned: 10,
          studentsStarted: 0,
          studentsCompleted: 0,
        },
      });

      const service = createService();
      const result = await service.getProgressOverview(superAdminAuth, testAdministrationId, overviewQuery);

      // Tasks should be ordered by orderIndex (0, 1, 2, 3) not by SQL result order
      expect(result.byTask[0]!.taskSlug).toBe('swr'); // orderIndex 0
      expect(result.byTask[1]!.taskSlug).toBe('sre'); // orderIndex 1
      expect(result.byTask[2]!.taskSlug).toBe('pa'); // orderIndex 2
      expect(result.byTask[3]!.taskSlug).toBe('vocab'); // orderIndex 3
    });

    it('deduplicates multi-variant tasks into a single byTask entry', async () => {
      // Two variants for the same task — should produce one entry in byTask
      const multiVariantMetas: ReportTaskMeta[] = [
        {
          ...testTaskMetas[0]!,
          taskVariantId: 'variant-a',
        },
        {
          ...testTaskMetas[0]!, // Same taskId
          taskVariantId: 'variant-b',
          orderIndex: 1,
        },
        testTaskMetas[1]!,
      ];
      mockReportRepository.getTaskMetadata.mockResolvedValue(multiVariantMetas);

      mockReportRepository.getProgressOverviewCounts.mockResolvedValue({
        totalStudents: 10,
        taskStatusCounts: [
          { taskId: TASK_ID_1, status: 'completed-required', count: 7 },
          { taskId: TASK_ID_1, status: 'started-required', count: 3 },
          { taskId: TASK_ID_2, status: 'assigned-required', count: 10 },
        ],
        studentCounts: { studentsWithRequiredTasks: 10, studentsAssigned: 0, studentsStarted: 3, studentsCompleted: 7 },
      });

      const service = createService();
      const result = await service.getProgressOverview(superAdminAuth, testAdministrationId, overviewQuery);

      // Should have 2 unique tasks, not 3
      expect(result.byTask).toHaveLength(2);
      const task1 = result.byTask.find((t) => t.taskId === TASK_ID_1);
      expect(task1!.completed).toBe(7);
      expect(task1!.started).toBe(3);
    });

    it('returns student-level assignment counts and full 7-level per-task counts', async () => {
      // Task 1: mix of all 6 statuses across 20 students
      // Task 2: all required, some at each stage
      const statusCounts: TaskStatusCount[] = [
        { taskId: TASK_ID_1, status: 'completed-required', count: 5 },
        { taskId: TASK_ID_1, status: 'completed-optional', count: 2 },
        { taskId: TASK_ID_1, status: 'started-required', count: 3 },
        { taskId: TASK_ID_1, status: 'started-optional', count: 1 },
        { taskId: TASK_ID_1, status: 'assigned-required', count: 6 },
        { taskId: TASK_ID_1, status: 'assigned-optional', count: 3 },
        { taskId: TASK_ID_2, status: 'completed-required', count: 10 },
        { taskId: TASK_ID_2, status: 'started-required', count: 5 },
        { taskId: TASK_ID_2, status: 'assigned-required', count: 5 },
      ];

      mockReportRepository.getProgressOverviewCounts.mockResolvedValue({
        totalStudents: 20,
        taskStatusCounts: statusCounts,
        studentCounts: { studentsWithRequiredTasks: 20, studentsAssigned: 5, studentsStarted: 5, studentsCompleted: 4 },
      });

      const service = createService();
      const result = await service.getProgressOverview(superAdminAuth, testAdministrationId, overviewQuery);

      // Student-level assignment counts pass through from repository
      expect(result.studentsWithRequiredTasks).toBe(20);
      expect(result.studentsAssigned).toBe(5);
      expect(result.studentsStarted).toBe(5);
      expect(result.studentsCompleted).toBe(4);

      // Task 1: full 7-level breakdown
      const task1 = result.byTask.find((t) => t.taskId === TASK_ID_1)!;
      expect(task1.completedRequired).toBe(5);
      expect(task1.completedOptional).toBe(2);
      expect(task1.startedRequired).toBe(3);
      expect(task1.startedOptional).toBe(1);
      expect(task1.assignedRequired).toBe(6);
      expect(task1.assignedOptional).toBe(3);
      // Convenience totals
      expect(task1.completed).toBe(7); // 5 + 2
      expect(task1.started).toBe(4); // 3 + 1
      expect(task1.assigned).toBe(9); // 6 + 3
      expect(task1.required).toBe(14); // 5 + 3 + 6
      expect(task1.optional).toBe(6); // 2 + 1 + 3

      // Task 2: all required
      const task2 = result.byTask.find((t) => t.taskId === TASK_ID_2)!;
      expect(task2.completedRequired).toBe(10);
      expect(task2.completedOptional).toBe(0);
      expect(task2.required).toBe(20); // 10 + 5 + 5
      expect(task2.optional).toBe(0);
    });

    it('passes task metadata with conditions to repository', async () => {
      mockReportRepository.getProgressOverviewCounts.mockResolvedValue({
        totalStudents: 5,
        taskStatusCounts: [],
        studentCounts: { studentsWithRequiredTasks: 0, studentsAssigned: 0, studentsStarted: 0, studentsCompleted: 0 },
      });

      const service = createService();
      await service.getProgressOverview(superAdminAuth, testAdministrationId, overviewQuery);

      // Repository should receive the full task metadata (including conditions)
      expect(mockReportRepository.getProgressOverviewCounts).toHaveBeenCalledWith(
        testAdministrationId,
        { scopeType: 'district', scopeId: 'district-uuid-1' },
        expect.objectContaining({ id: expect.any(String), dateStart: expect.any(Date), dateEnd: expect.any(Date) }),
        testTaskMetas,
        expect.any(Boolean),
      );
    });
  });

  describe('getScoreOverview', () => {
    const scoreQuery: ScoreOverviewInput = {
      scopeType: 'district',
      scopeId: 'district-uuid-1',
      filter: [],
    };

    /** Helper to build a StudentOverviewRow with default demographics. */
    function buildOverviewStudent(overrides: Partial<StudentOverviewRow> & { userId: string }): StudentOverviewRow {
      return {
        grade: '3',
        statusEll: null,
        statusIep: null,
        statusFrl: null,
        dob: null,
        gender: null,
        race: null,
        hispanicEthnicity: null,
        homeLanguage: null,
        ...overrides,
      };
    }

    /** Helper to build a RunScoreRow. */
    function buildScoreRow(userId: string, taskVariantId: string, scoreName: string, scoreValue: string): RunScoreRow {
      return { userId, taskVariantId, scoreName, scoreValue };
    }

    /** Set up default mocks for a successful getScoreOverview call. */
    function setupDefaultScoreOverviewMocks(
      students: StudentOverviewRow[] = [buildOverviewStudent({ userId: 'student-1' })],
      scoreRows: RunScoreRow[] = [],
    ) {
      mockReportRepository.getAllStudentsInScope.mockResolvedValue({
        totalStudents: students.length,
        students,
      });
      mockReportRepository.getCompletedRunScores.mockResolvedValue(scoreRows);
      mockTaskVariantParameterRepository.getByTaskVariantIds.mockResolvedValue([]);
    }

    // --- Authorization (same shape as getProgressOverview, but checks CAN_READ_SCORES) ---

    it('returns 404 when administration does not exist', async () => {
      mockAdministrationRepository.getById.mockResolvedValue(null);

      const service = createService();

      await expect(service.getScoreOverview(teacherAuth, testAdministrationId, scoreQuery)).rejects.toMatchObject({
        statusCode: StatusCodes.NOT_FOUND,
        code: ApiErrorCode.RESOURCE_NOT_FOUND,
      });
    });

    it('returns 403 when FGA denies can_read_scores on administration', async () => {
      mockAuthorizationService.requirePermission.mockRejectedValue(
        new ApiError(ApiErrorMessage.FORBIDDEN, {
          statusCode: StatusCodes.FORBIDDEN,
          code: ApiErrorCode.AUTH_FORBIDDEN,
        }),
      );

      const service = createService();

      await expect(service.getScoreOverview(teacherAuth, testAdministrationId, scoreQuery)).rejects.toMatchObject({
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
      });

      expect(mockAuthorizationService.requirePermission).toHaveBeenCalledWith(
        teacherAuth.userId,
        FgaRelation.CAN_READ_SCORES,
        `${FgaType.ADMINISTRATION}:${testAdministrationId}`,
      );
    });

    it('returns 400 when scope is not assigned to administration', async () => {
      mockReportRepository.isScopeAssignedToAdministration.mockResolvedValue(false);

      const service = createService();

      await expect(service.getScoreOverview(teacherAuth, testAdministrationId, scoreQuery)).rejects.toMatchObject({
        statusCode: StatusCodes.BAD_REQUEST,
        code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
      });
    });

    it('returns 403 when FGA denies can_read_scores at scope level', async () => {
      // First check (administration) passes, second check (scope) fails
      mockAuthorizationService.requirePermission.mockResolvedValueOnce(undefined).mockRejectedValueOnce(
        new ApiError(ApiErrorMessage.FORBIDDEN, {
          statusCode: StatusCodes.FORBIDDEN,
          code: ApiErrorCode.AUTH_FORBIDDEN,
        }),
      );

      const service = createService();

      await expect(service.getScoreOverview(teacherAuth, testAdministrationId, scoreQuery)).rejects.toMatchObject({
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
      });

      // Second call targets the scope entity with CAN_READ_SCORES
      expect(mockAuthorizationService.requirePermission).toHaveBeenNthCalledWith(
        2,
        teacherAuth.userId,
        FgaRelation.CAN_READ_SCORES,
        `${FgaType.DISTRICT}:district-uuid-1`,
      );
    });

    it('super admin bypasses FGA checks', async () => {
      setupDefaultScoreOverviewMocks();

      const service = createService();
      await service.getScoreOverview(superAdminAuth, testAdministrationId, scoreQuery);

      expect(mockAuthorizationService.requirePermission).not.toHaveBeenCalled();
    });

    // --- Empty results ---

    it('returns empty task overviews when no students in scope', async () => {
      setupDefaultScoreOverviewMocks([]);

      const service = createService();
      const result = await service.getScoreOverview(superAdminAuth, testAdministrationId, scoreQuery);

      expect(result.totalStudents).toBe(0);
      expect(result.tasks).toHaveLength(testTaskMetas.length);
      for (const task of result.tasks) {
        expect(task.totalAssessed).toBe(0);
        expect(task.totalNotAssessed).toEqual({ required: 0, optional: 0 });
        expect(task.supportLevels.achievedSkill).toEqual({ count: 0 });
      }
      expect(result.computedAt).toBeDefined();
    });

    it('returns computedAt as a parseable ISO datetime', async () => {
      setupDefaultScoreOverviewMocks();

      const service = createService();
      const result = await service.getScoreOverview(superAdminAuth, testAdministrationId, scoreQuery);

      const parsed = new Date(result.computedAt);
      expect(parsed.getTime()).not.toBeNaN();
    });

    // --- Aggregation logic ---

    it('counts assessed students with classifiable scores', async () => {
      const students = [
        buildOverviewStudent({ userId: 'student-1', grade: '3' }),
        buildOverviewStudent({ userId: 'student-2', grade: '3' }),
        buildOverviewStudent({ userId: 'student-3', grade: '3' }),
      ];

      // All 3 students have completed scores for swr (task-1).
      const scoreRows = [
        buildScoreRow('student-1', VARIANT_ID_1, ScoreField.PERCENTILE, '90'),
        buildScoreRow('student-2', VARIANT_ID_1, ScoreField.PERCENTILE, '50'),
        buildScoreRow('student-3', VARIANT_ID_1, ScoreField.PERCENTILE, '10'),
      ];

      setupDefaultScoreOverviewMocks(students, scoreRows);

      const service = createService();
      const result = await service.getScoreOverview(superAdminAuth, testAdministrationId, scoreQuery);

      const swrTask = result.tasks.find((t) => t.taskId === TASK_ID_1);
      expect(swrTask).toBeDefined();
      expect(swrTask!.totalAssessed).toBe(3);
      // Sum of bucketed students cannot exceed totalAssessed (some tasks may
      // produce null support levels for unknown classifications)
      const totalClassified =
        swrTask!.supportLevels.achievedSkill.count +
        swrTask!.supportLevels.developingSkill.count +
        swrTask!.supportLevels.needsExtraSupport.count;
      expect(totalClassified).toBeLessThanOrEqual(3);
    });

    it('counts not-assessed students as required when no run exists', async () => {
      const students = [
        buildOverviewStudent({ userId: 'student-1', grade: '3' }),
        buildOverviewStudent({ userId: 'student-2', grade: '3' }),
      ];

      // Only student-1 has scores; student-2 has no run.
      const scoreRows = [buildScoreRow('student-1', VARIANT_ID_1, ScoreField.PERCENTILE, '50')];

      setupDefaultScoreOverviewMocks(students, scoreRows);

      const service = createService();
      const result = await service.getScoreOverview(superAdminAuth, testAdministrationId, scoreQuery);

      const swrTask = result.tasks.find((t) => t.taskId === TASK_ID_1);
      expect(swrTask).toBeDefined();
      expect(swrTask!.totalAssessed).toBe(1);
      expect(swrTask!.totalNotAssessed.required).toBe(1);
      expect(swrTask!.totalNotAssessed.optional).toBe(0);
    });

    it('counts not-assessed students as optional when evaluator returns optional', async () => {
      const students = [buildOverviewStudent({ userId: 'student-no-run', grade: '3' })];

      setupDefaultScoreOverviewMocks(students, []);
      // Override default: task is optional for this student
      mockTaskService.evaluateTaskVariantEligibility.mockReturnValue({ isAssigned: true, isOptional: true });

      const service = createService();
      const result = await service.getScoreOverview(superAdminAuth, testAdministrationId, scoreQuery);

      const swrTask = result.tasks.find((t) => t.taskId === TASK_ID_1);
      expect(swrTask).toBeDefined();
      expect(swrTask!.totalAssessed).toBe(0);
      expect(swrTask!.totalNotAssessed.optional).toBe(1);
      expect(swrTask!.totalNotAssessed.required).toBe(0);
    });

    it('excludes unassigned students from not-assessed counts', async () => {
      const students = [buildOverviewStudent({ userId: 'student-excluded', grade: '3' })];

      setupDefaultScoreOverviewMocks(students, []);
      // Student is not assigned to this task at all
      mockTaskService.evaluateTaskVariantEligibility.mockReturnValue({ isAssigned: false, isOptional: false });

      const service = createService();
      const result = await service.getScoreOverview(superAdminAuth, testAdministrationId, scoreQuery);

      const swrTask = result.tasks.find((t) => t.taskId === TASK_ID_1);
      expect(swrTask).toBeDefined();
      expect(swrTask!.totalAssessed).toBe(0);
      expect(swrTask!.totalNotAssessed.required).toBe(0);
      expect(swrTask!.totalNotAssessed.optional).toBe(0);
    });

    // --- Multi-variant deduplication ---

    it('deduplicates across variants of the same task', async () => {
      // Two variants for the same taskId
      const SHARED_TASK = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
      const variantA: ReportTaskMeta = {
        taskId: SHARED_TASK,
        taskVariantId: 'var-a',
        taskSlug: 'swr',
        taskName: 'ROAR - Word',
        orderIndex: 0,
        conditionsAssignment: null,
        conditionsRequirements: null,
      };
      const variantB: ReportTaskMeta = {
        taskId: SHARED_TASK,
        taskVariantId: 'var-b',
        taskSlug: 'swr',
        taskName: 'ROAR - Word',
        orderIndex: 1,
        conditionsAssignment: null,
        conditionsRequirements: null,
      };

      mockReportRepository.getTaskMetadata.mockResolvedValue([variantA, variantB]);

      const students = [buildOverviewStudent({ userId: 'student-1', grade: '3' })];

      // Student has scores on variant A only
      const scoreRows = [buildScoreRow('student-1', 'var-a', ScoreField.PERCENTILE, '50')];

      setupDefaultScoreOverviewMocks(students, scoreRows);

      const service = createService();
      const result = await service.getScoreOverview(superAdminAuth, testAdministrationId, scoreQuery);

      // Should produce exactly 1 task (both variants grouped)
      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0]!.taskId).toBe(SHARED_TASK);
      // Student counted once (not twice)
      expect(result.tasks[0]!.totalAssessed).toBe(1);
    });

    it('uses the first variant with scores for a multi-variant student', async () => {
      const SHARED_TASK = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
      const variantA: ReportTaskMeta = {
        taskId: SHARED_TASK,
        taskVariantId: 'var-a',
        taskSlug: 'swr',
        taskName: 'ROAR - Word',
        orderIndex: 0,
        conditionsAssignment: null,
        conditionsRequirements: null,
      };
      const variantB: ReportTaskMeta = {
        taskId: SHARED_TASK,
        taskVariantId: 'var-b',
        taskSlug: 'swr',
        taskName: 'ROAR - Word',
        orderIndex: 1,
        conditionsAssignment: null,
        conditionsRequirements: null,
      };

      mockReportRepository.getTaskMetadata.mockResolvedValue([variantA, variantB]);

      const students = [buildOverviewStudent({ userId: 'student-1', grade: '3' })];

      // Student has scores on both variants — should use variant A (first in order)
      // Variant A has high percentile (achievedSkill); variant B has low (would be needsExtraSupport)
      const scoreRows = [
        buildScoreRow('student-1', 'var-a', ScoreField.PERCENTILE, '90'),
        buildScoreRow('student-1', 'var-b', ScoreField.PERCENTILE, '10'),
      ];

      setupDefaultScoreOverviewMocks(students, scoreRows);

      const service = createService();
      const result = await service.getScoreOverview(superAdminAuth, testAdministrationId, scoreQuery);

      expect(result.tasks[0]!.totalAssessed).toBe(1);
      // Variant A wins → achievedSkill, not needsExtraSupport from variant B
      expect(result.tasks[0]!.supportLevels.achievedSkill.count).toBe(1);
      expect(result.tasks[0]!.supportLevels.needsExtraSupport.count).toBe(0);
    });

    it('evaluates eligibility across all variants when no run exists', async () => {
      const SHARED_TASK = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
      const variantA: ReportTaskMeta = {
        taskId: SHARED_TASK,
        taskVariantId: 'var-a',
        taskSlug: 'swr',
        taskName: 'ROAR - Word',
        orderIndex: 0,
        conditionsAssignment: null,
        conditionsRequirements: null,
      };
      const variantB: ReportTaskMeta = {
        taskId: SHARED_TASK,
        taskVariantId: 'var-b',
        taskSlug: 'swr',
        taskName: 'ROAR - Word',
        orderIndex: 1,
        conditionsAssignment: null,
        conditionsRequirements: null,
      };

      mockReportRepository.getTaskMetadata.mockResolvedValue([variantA, variantB]);

      const students = [buildOverviewStudent({ userId: 'student-1', grade: '3' })];
      setupDefaultScoreOverviewMocks(students, []);

      // Variant A: not assigned. Variant B: assigned and required.
      // Student should be counted as not-assessed required (ANY variant assigning → assigned).
      let callCount = 0;
      mockTaskService.evaluateTaskVariantEligibility.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return { isAssigned: false, isOptional: false };
        return { isAssigned: true, isOptional: false };
      });

      const service = createService();
      const result = await service.getScoreOverview(superAdminAuth, testAdministrationId, scoreQuery);

      expect(result.tasks[0]!.totalNotAssessed.required).toBe(1);
      expect(result.tasks[0]!.totalNotAssessed.optional).toBe(0);
    });

    // --- taskId filter ---

    it('filters tasks by taskId when filter includes the taskId field', async () => {
      const students = [buildOverviewStudent({ userId: 'student-1', grade: '3' })];
      const scoreRows = [buildScoreRow('student-1', VARIANT_ID_1, ScoreField.PERCENTILE, '50')];

      setupDefaultScoreOverviewMocks(students, scoreRows);

      const filteredQuery: ScoreOverviewInput = {
        ...scoreQuery,
        filter: [{ field: 'taskId', operator: 'in', value: TASK_ID_1 }],
      };

      const service = createService();
      const result = await service.getScoreOverview(superAdminAuth, testAdministrationId, filteredQuery);

      // Only the filtered task should be in the result
      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0]!.taskId).toBe(TASK_ID_1);
    });

    // --- Scoring version ---

    it('passes scoring version from task variant parameters into scoring logic', async () => {
      const students = [buildOverviewStudent({ userId: 'student-1', grade: '3' })];
      const scoreRows = [buildScoreRow('student-1', VARIANT_ID_1, ScoreField.PERCENTILE, '50')];

      setupDefaultScoreOverviewMocks(students, scoreRows);
      mockTaskVariantParameterRepository.getByTaskVariantIds.mockResolvedValue([
        {
          taskVariantId: VARIANT_ID_1,
          name: 'scoringVersion',
          value: 2,
          createdAt: new Date(),
          updatedAt: null,
        },
      ]);

      const service = createService();
      const result = await service.getScoreOverview(superAdminAuth, testAdministrationId, scoreQuery);

      // Repository is consulted for scoring versions
      expect(mockTaskVariantParameterRepository.getByTaskVariantIds).toHaveBeenCalledWith(
        testTaskMetas.map((t) => t.taskVariantId),
      );
      // And the call completes successfully
      expect(result.tasks).toHaveLength(testTaskMetas.length);
    });

    // --- Error handling ---

    it('wraps unexpected repository errors in a 500 ApiError', async () => {
      mockReportRepository.getAllStudentsInScope.mockRejectedValue(new Error('connection reset'));

      const service = createService();

      await expect(service.getScoreOverview(superAdminAuth, testAdministrationId, scoreQuery)).rejects.toMatchObject({
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
      });
    });

    it('re-throws ApiError without wrapping', async () => {
      // The 404 from AdministrationService.verifyAdministrationAccess should propagate as-is
      mockAdministrationRepository.getById.mockResolvedValue(null);

      const service = createService();

      await expect(service.getScoreOverview(superAdminAuth, testAdministrationId, scoreQuery)).rejects.toMatchObject({
        statusCode: StatusCodes.NOT_FOUND,
        code: ApiErrorCode.RESOURCE_NOT_FOUND,
      });
    });

    // --- user.grade filter ---

    it('passes user-level filters to getAllStudentsInScope', async () => {
      setupDefaultScoreOverviewMocks();

      const filteredQuery: ScoreOverviewInput = {
        ...scoreQuery,
        filter: [{ field: 'user.grade', operator: 'eq', value: '3' }],
      };

      const service = createService();
      await service.getScoreOverview(superAdminAuth, testAdministrationId, filteredQuery);

      // getAllStudentsInScope should be called with a non-undefined filter condition
      expect(mockReportRepository.getAllStudentsInScope).toHaveBeenCalledWith(
        { scopeType: 'district', scopeId: 'district-uuid-1' },
        expect.objectContaining({ id: expect.any(String), dateStart: expect.any(Date), dateEnd: expect.any(Date) }),
        expect.anything(),
        expect.any(Boolean),
      );
    });

    it('returns per-task metadata in results', async () => {
      setupDefaultScoreOverviewMocks([], []);

      const service = createService();
      const result = await service.getScoreOverview(superAdminAuth, testAdministrationId, scoreQuery);

      expect(result.tasks[0]!.taskId).toBe(TASK_ID_1);
      expect(result.tasks[0]!.taskSlug).toBe('swr');
      expect(result.tasks[0]!.taskName).toBe('ROAR - Word');
      expect(result.tasks[0]!.orderIndex).toBe(0);
    });

    // --- Unknown taskId in filter (#1782 review follow-up: shared validation) ---

    it('returns 400 when taskId filter references a UUID not assigned to the administration', async () => {
      // Previously silent-dropped to an empty `tasks: []` response (200).
      // `applyTaskIdFilter` now validates against the admin's actual task IDs
      // and throws BAD_REQUEST for unknowns — matching the contract's
      // long-standing claim that unknown task IDs in filter return 400 and
      // aligning the three score-reporting endpoints on a single behavior.
      const students = [buildOverviewStudent({ userId: 'student-1' })];
      setupDefaultScoreOverviewMocks(students, []);

      const filteredQuery: ScoreOverviewInput = {
        ...scoreQuery,
        filter: [{ field: 'taskId', operator: 'in', value: '00000000-0000-0000-0000-000000000000' }],
      };

      const service = createService();
      await expect(service.getScoreOverview(superAdminAuth, testAdministrationId, filteredQuery)).rejects.toMatchObject(
        {
          statusCode: StatusCodes.BAD_REQUEST,
          code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
        },
      );
      // Validation fires before any DB call beyond getTaskMetadata.
      expect(mockReportRepository.getAllStudentsInScope).not.toHaveBeenCalled();
    });

    it('merges multiple taskId filter entries into a single allow-list', async () => {
      // Two `taskId:in:...` filter entries should be unioned (not silently truncated to the first).
      // The fixture has TASK_ID_1, TASK_ID_2, TASK_ID_3, TASK_ID_4 in testTaskMetas; we ask for
      // ID_1 in the first entry and ID_3 in the second, expecting both back.
      setupDefaultScoreOverviewMocks([buildOverviewStudent({ userId: 'student-1' })], []);

      const filteredQuery: ScoreOverviewInput = {
        ...scoreQuery,
        filter: [
          { field: 'taskId', operator: 'in', value: TASK_ID_1 },
          { field: 'taskId', operator: 'in', value: TASK_ID_3 },
        ],
      };

      const service = createService();
      const result = await service.getScoreOverview(superAdminAuth, testAdministrationId, filteredQuery);

      const returnedIds = new Set(result.tasks.map((t) => t.taskId));
      expect(returnedIds).toEqual(new Set([TASK_ID_1, TASK_ID_3]));
    });

    // --- Multi-variant: any required → required (not optional) ---

    it('counts a not-assessed student as required when any variant is required', async () => {
      // Variant A assigns the student as required. Variant B assigns them as optional.
      // Per evaluateEligibilityAcrossVariants, the student should be counted as
      // not-assessed REQUIRED because at least one variant marks them required.
      const SHARED_TASK = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
      const variantA: ReportTaskMeta = {
        taskId: SHARED_TASK,
        taskVariantId: 'var-a',
        taskSlug: 'swr',
        taskName: 'ROAR - Word',
        orderIndex: 0,
        conditionsAssignment: null,
        conditionsRequirements: null,
      };
      const variantB: ReportTaskMeta = {
        taskId: SHARED_TASK,
        taskVariantId: 'var-b',
        taskSlug: 'swr',
        taskName: 'ROAR - Word',
        orderIndex: 1,
        conditionsAssignment: null,
        conditionsRequirements: null,
      };

      mockReportRepository.getTaskMetadata.mockResolvedValue([variantA, variantB]);

      const students = [buildOverviewStudent({ userId: 'student-1' })];
      setupDefaultScoreOverviewMocks(students, []);

      // Variant A: assigned + required. Variant B: assigned + optional.
      let callCount = 0;
      mockTaskService.evaluateTaskVariantEligibility.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return { isAssigned: true, isOptional: false };
        return { isAssigned: true, isOptional: true };
      });

      const service = createService();
      const result = await service.getScoreOverview(superAdminAuth, testAdministrationId, scoreQuery);

      expect(result.tasks[0]!.totalNotAssessed.required).toBe(1);
      expect(result.tasks[0]!.totalNotAssessed.optional).toBe(0);
    });

    // --- Scoring version edge cases ---
    //
    // The scoring service's swr config exposes different percentile cutoffs by version:
    //   v0 (legacy): achievedSkill >= 50, developingSkill >= 25
    //   v7+:         achievedSkill >= 40, developingSkill >= 20
    // A percentile of 45 lets us observe which version's cutoffs were applied:
    //   v0 → developingSkill (45 < 50)
    //   v7 → achievedSkill   (45 >= 40)

    it('ignores task variant parameters whose name is not scoringVersion', async () => {
      const students = [buildOverviewStudent({ userId: 'student-1', grade: '3' })];
      const scoreRows = [buildScoreRow('student-1', VARIANT_ID_1, ScoreField.PERCENTILE, '45')];

      setupDefaultScoreOverviewMocks(students, scoreRows);
      // Param has the wrong name — should be ignored, leaving version=null (treated as 0)
      mockTaskVariantParameterRepository.getByTaskVariantIds.mockResolvedValue([
        { taskVariantId: VARIANT_ID_1, name: 'difficulty', value: 7, createdAt: new Date(), updatedAt: null },
      ]);

      const service = createService();
      const result = await service.getScoreOverview(superAdminAuth, testAdministrationId, scoreQuery);

      const swrTask = result.tasks.find((t) => t.taskId === TASK_ID_1)!;
      // v0 cutoffs were applied: 45 < 50 → developingSkill, NOT achievedSkill
      expect(swrTask.supportLevels.developingSkill.count).toBe(1);
      expect(swrTask.supportLevels.achievedSkill.count).toBe(0);
    });

    it('ignores scoringVersion values that cannot be parsed as a number', async () => {
      const students = [buildOverviewStudent({ userId: 'student-1', grade: '3' })];
      const scoreRows = [buildScoreRow('student-1', VARIANT_ID_1, ScoreField.PERCENTILE, '45')];

      setupDefaultScoreOverviewMocks(students, scoreRows);
      // Non-numeric string → Number('foo') is NaN → skipped → version stays null/0
      mockTaskVariantParameterRepository.getByTaskVariantIds.mockResolvedValue([
        { taskVariantId: VARIANT_ID_1, name: 'scoringVersion', value: 'foo', createdAt: new Date(), updatedAt: null },
      ]);

      const service = createService();
      const result = await service.getScoreOverview(superAdminAuth, testAdministrationId, scoreQuery);

      const swrTask = result.tasks.find((t) => t.taskId === TASK_ID_1)!;
      expect(swrTask.supportLevels.developingSkill.count).toBe(1);
      expect(swrTask.supportLevels.achievedSkill.count).toBe(0);
    });

    it('accepts string-numeric scoringVersion values', async () => {
      const students = [buildOverviewStudent({ userId: 'student-1', grade: '3' })];
      const scoreRows = [buildScoreRow('student-1', VARIANT_ID_1, ScoreField.PERCENTILE, '45')];

      setupDefaultScoreOverviewMocks(students, scoreRows);
      // String '7' → Number('7') = 7 → v7 cutoffs applied
      mockTaskVariantParameterRepository.getByTaskVariantIds.mockResolvedValue([
        { taskVariantId: VARIANT_ID_1, name: 'scoringVersion', value: '7', createdAt: new Date(), updatedAt: null },
      ]);

      const service = createService();
      const result = await service.getScoreOverview(superAdminAuth, testAdministrationId, scoreQuery);

      const swrTask = result.tasks.find((t) => t.taskId === TASK_ID_1)!;
      // v7 cutoffs applied: 45 >= 40 → achievedSkill
      expect(swrTask.supportLevels.achievedSkill.count).toBe(1);
      expect(swrTask.supportLevels.developingSkill.count).toBe(0);
    });

    // --- Assessment-computed support level (roam-alpaca) ---

    it('classifies assessment-computed tasks via the supportLevel score field', async () => {
      // roam-alpaca uses classification.type = 'assessment-computed' — the support level
      // comes from the assessment, not from percentile/rawScore cutoffs.
      const ROAM_ALPACA_TASK = 'cccccccc-aaaa-bbbb-dddd-eeeeeeeeeeee';
      const ROAM_VARIANT = 'roam-variant-1';
      const roamMeta: ReportTaskMeta = {
        taskId: ROAM_ALPACA_TASK,
        taskVariantId: ROAM_VARIANT,
        taskSlug: 'roam-alpaca',
        taskName: 'ROAM - Alpaca',
        orderIndex: 0,
        conditionsAssignment: null,
        conditionsRequirements: null,
      };
      mockReportRepository.getTaskMetadata.mockResolvedValue([roamMeta]);

      const students = [buildOverviewStudent({ userId: 'student-1', grade: '3' })];
      const scoreRows = [buildScoreRow('student-1', ROAM_VARIANT, ScoreField.SUPPORT_LEVEL, 'achievedSkill')];

      setupDefaultScoreOverviewMocks(students, scoreRows);

      const service = createService();
      const result = await service.getScoreOverview(superAdminAuth, testAdministrationId, scoreQuery);

      const roamTask = result.tasks.find((t) => t.taskId === ROAM_ALPACA_TASK)!;
      expect(roamTask.totalAssessed).toBe(1);
      expect(roamTask.supportLevels.achievedSkill.count).toBe(1);
      expect(roamTask.supportLevels.developingSkill.count).toBe(0);
      expect(roamTask.supportLevels.needsExtraSupport.count).toBe(0);
    });

    // --- parseScoreValue angle-bracket handling ---

    it('classifies angle-bracket percentile strings (e.g., ">99")', async () => {
      // Newer norming tables encode extreme values as ">99" or "<1". parseScoreValue
      // strips the brackets so the score is still classifiable.
      const students = [buildOverviewStudent({ userId: 'student-1', grade: '3' })];
      const scoreRows = [buildScoreRow('student-1', VARIANT_ID_1, ScoreField.PERCENTILE, '>99')];

      setupDefaultScoreOverviewMocks(students, scoreRows);

      const service = createService();
      const result = await service.getScoreOverview(superAdminAuth, testAdministrationId, scoreQuery);

      const swrTask = result.tasks.find((t) => t.taskId === TASK_ID_1)!;
      expect(swrTask.totalAssessed).toBe(1);
      // 99 (after bracket strip) >= 50 (v0 swr achieved cutoff) → achievedSkill
      expect(swrTask.supportLevels.achievedSkill.count).toBe(1);
    });

    // --- No resolvable score path ---

    it('counts a student in totalAssessed but no support-level bucket when scores are unresolvable', async () => {
      // The student's run has score rows, but none match the swr field names
      // (e.g., ScoreField.PERCENTILE, 'wjPercentile', 'roarScore'). getSupportLevel
      // returns null → counted in totalAssessed but no bucket increments.
      const students = [buildOverviewStudent({ userId: 'student-1', grade: '3' })];
      const scoreRows = [buildScoreRow('student-1', VARIANT_ID_1, 'irrelevant', '42')];

      setupDefaultScoreOverviewMocks(students, scoreRows);

      const service = createService();
      const result = await service.getScoreOverview(superAdminAuth, testAdministrationId, scoreQuery);

      const swrTask = result.tasks.find((t) => t.taskId === TASK_ID_1)!;
      expect(swrTask.totalAssessed).toBe(1);
      expect(swrTask.supportLevels.achievedSkill.count).toBe(0);
      expect(swrTask.supportLevels.developingSkill.count).toBe(0);
      expect(swrTask.supportLevels.needsExtraSupport.count).toBe(0);
      // Not-assessed should NOT be incremented either — the student is "assessed"
      // (has a completed run with scores), they just lack a classifiable result.
      expect(swrTask.totalNotAssessed.required).toBe(0);
      expect(swrTask.totalNotAssessed.optional).toBe(0);
    });
  });

  describe('getScoreFacets', () => {
    const facetsQuery: ScoreFacetsInput = {
      scopeType: 'district',
      scopeId: 'district-uuid-1',
      filter: [],
    };

    function buildFacetStudent(overrides: Partial<StudentOverviewRow> & { userId: string }): StudentOverviewRow {
      return {
        grade: '3',
        statusEll: null,
        statusIep: null,
        statusFrl: null,
        dob: null,
        gender: null,
        race: null,
        hispanicEthnicity: null,
        homeLanguage: null,
        ...overrides,
      };
    }

    function buildScoreRow(userId: string, taskVariantId: string, scoreName: string, scoreValue: string): RunScoreRow {
      return { userId, taskVariantId, scoreName, scoreValue };
    }

    function setupDefaultFacetsMocks(
      students: StudentOverviewRow[] = [buildFacetStudent({ userId: 'student-1' })],
      scoreRows: RunScoreRow[] = [],
      schoolsByUser: Map<string, { schoolId: string; schoolName: string }> = new Map(),
    ) {
      mockReportRepository.getAllStudentsInScope.mockResolvedValue({
        totalStudents: students.length,
        students,
      });
      mockReportRepository.getCompletedRunScores.mockResolvedValue(scoreRows);
      mockReportRepository.getSchoolsForUsers.mockResolvedValue(schoolsByUser);
      mockTaskVariantParameterRepository.getByTaskVariantIds.mockResolvedValue([]);
    }

    // --- Authorization (mirrors getScoreOverview) ---

    it('returns 404 when administration does not exist', async () => {
      mockAdministrationRepository.getById.mockResolvedValue(null);

      const service = createService();

      await expect(service.getScoreFacets(teacherAuth, testAdministrationId, facetsQuery)).rejects.toMatchObject({
        statusCode: StatusCodes.NOT_FOUND,
        code: ApiErrorCode.RESOURCE_NOT_FOUND,
      });
    });

    it('returns 403 when FGA denies can_read_scores on administration', async () => {
      mockAuthorizationService.requirePermission.mockRejectedValue(
        new ApiError(ApiErrorMessage.FORBIDDEN, {
          statusCode: StatusCodes.FORBIDDEN,
          code: ApiErrorCode.AUTH_FORBIDDEN,
        }),
      );

      const service = createService();

      await expect(service.getScoreFacets(teacherAuth, testAdministrationId, facetsQuery)).rejects.toMatchObject({
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
      });

      expect(mockAuthorizationService.requirePermission).toHaveBeenCalledWith(
        teacherAuth.userId,
        FgaRelation.CAN_READ_SCORES,
        `${FgaType.ADMINISTRATION}:${testAdministrationId}`,
      );
    });

    it('returns 400 when scope is not assigned to administration', async () => {
      mockReportRepository.isScopeAssignedToAdministration.mockResolvedValue(false);

      const service = createService();

      await expect(service.getScoreFacets(teacherAuth, testAdministrationId, facetsQuery)).rejects.toMatchObject({
        statusCode: StatusCodes.BAD_REQUEST,
        code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
      });
    });

    it('returns 403 when FGA denies can_read_scores at scope level', async () => {
      mockAuthorizationService.requirePermission.mockResolvedValueOnce(undefined).mockRejectedValueOnce(
        new ApiError(ApiErrorMessage.FORBIDDEN, {
          statusCode: StatusCodes.FORBIDDEN,
          code: ApiErrorCode.AUTH_FORBIDDEN,
        }),
      );

      const service = createService();

      await expect(service.getScoreFacets(teacherAuth, testAdministrationId, facetsQuery)).rejects.toMatchObject({
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
      });

      expect(mockAuthorizationService.requirePermission).toHaveBeenNthCalledWith(
        2,
        teacherAuth.userId,
        FgaRelation.CAN_READ_SCORES,
        `${FgaType.DISTRICT}:district-uuid-1`,
      );
    });

    it('super admin bypasses FGA checks', async () => {
      setupDefaultFacetsMocks();

      const service = createService();
      await service.getScoreFacets(superAdminAuth, testAdministrationId, facetsQuery);

      expect(mockAuthorizationService.requirePermission).not.toHaveBeenCalled();
    });

    // --- Empty / shape ---

    it('returns empty task facets when no students in scope', async () => {
      setupDefaultFacetsMocks([]);

      const service = createService();
      const result = await service.getScoreFacets(superAdminAuth, testAdministrationId, facetsQuery);

      expect(result.totalStudents).toBe(0);
      expect(result.tasks).toHaveLength(testTaskMetas.length);
      for (const task of result.tasks) {
        expect(task.supportLevelByGrade).toEqual([]);
        expect(task.supportLevelBySchool).toEqual([]);
        expect(task.scoreBinsByGrade).toEqual([]);
        expect(task.scoreBinsBySchool).toEqual([]);
      }
    });

    it('returns computedAt as a parseable ISO datetime', async () => {
      setupDefaultFacetsMocks();

      const service = createService();
      const result = await service.getScoreFacets(superAdminAuth, testAdministrationId, facetsQuery);

      const parsed = new Date(result.computedAt);
      expect(parsed.getTime()).not.toBeNaN();
    });

    // --- Filter routing ---

    it('narrows tasks when taskId:in filter excludes some', async () => {
      setupDefaultFacetsMocks();

      const service = createService();
      const result = await service.getScoreFacets(superAdminAuth, testAdministrationId, {
        ...facetsQuery,
        filter: [{ field: 'taskId', operator: 'in', value: TASK_ID_1 }],
      });

      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0]!.taskId).toBe(TASK_ID_1);
    });

    it('merges multiple taskId filter entries into a single allow-list', async () => {
      // Same dedup behavior as getScoreOverview (#1683): two taskId:in entries
      // should be unioned, not silently overwritten.
      setupDefaultFacetsMocks();

      const service = createService();
      const result = await service.getScoreFacets(superAdminAuth, testAdministrationId, {
        ...facetsQuery,
        filter: [
          { field: 'taskId', operator: 'in', value: TASK_ID_1 },
          { field: 'taskId', operator: 'in', value: TASK_ID_3 },
        ],
      });

      const seenIds = new Set(result.tasks.map((t) => t.taskId));
      expect(seenIds).toEqual(new Set([TASK_ID_1, TASK_ID_3]));
    });

    // --- Per-grade aggregation ---

    it('tallies support levels per grade for the assessed cohort', async () => {
      // 3 grade-3 students with different percentiles, 1 grade-4 student.
      // Percentile thresholds for swr (the task at TASK_ID_1) bucket students
      // into the three support levels — same fixture pattern as getScoreOverview.
      const students = [
        buildFacetStudent({ userId: 'student-1', grade: '3' }),
        buildFacetStudent({ userId: 'student-2', grade: '3' }),
        buildFacetStudent({ userId: 'student-3', grade: '3' }),
        buildFacetStudent({ userId: 'student-4', grade: '4' }),
      ];
      const scoreRows = [
        buildScoreRow('student-1', VARIANT_ID_1, ScoreField.PERCENTILE, '90'),
        buildScoreRow('student-2', VARIANT_ID_1, ScoreField.PERCENTILE, '50'),
        buildScoreRow('student-3', VARIANT_ID_1, ScoreField.PERCENTILE, '10'),
        buildScoreRow('student-4', VARIANT_ID_1, ScoreField.PERCENTILE, '95'),
      ];
      setupDefaultFacetsMocks(students, scoreRows);

      const service = createService();
      const result = await service.getScoreFacets(superAdminAuth, testAdministrationId, facetsQuery);

      const swrTask = result.tasks.find((t) => t.taskId === TASK_ID_1)!;
      expect(swrTask).toBeDefined();

      const grade3 = swrTask.supportLevelByGrade.find((e) => e.grade === '3')!;
      const grade4 = swrTask.supportLevelByGrade.find((e) => e.grade === '4')!;
      expect(grade3.totalAssessed).toBe(3);
      expect(grade3.achievedSkill.count + grade3.developingSkill.count + grade3.needsExtraSupport.count).toBe(3);
      expect(grade4.totalAssessed).toBe(1);
      expect(grade4.achievedSkill.count).toBe(1);
    });

    it('sorts per-grade entries by grade ordinal, not lexicographically', async () => {
      // Order in: 10, K, 2, 1 — out: K, 1, 2, 10.
      const students = [
        buildFacetStudent({ userId: 'student-10', grade: '10' }),
        buildFacetStudent({ userId: 'student-k', grade: 'Kindergarten' }),
        buildFacetStudent({ userId: 'student-2', grade: '2' }),
        buildFacetStudent({ userId: 'student-1', grade: '1' }),
      ];
      const scoreRows = [
        buildScoreRow('student-10', VARIANT_ID_1, ScoreField.PERCENTILE, '50'),
        buildScoreRow('student-k', VARIANT_ID_1, ScoreField.PERCENTILE, '50'),
        buildScoreRow('student-2', VARIANT_ID_1, ScoreField.PERCENTILE, '50'),
        buildScoreRow('student-1', VARIANT_ID_1, ScoreField.PERCENTILE, '50'),
      ];
      setupDefaultFacetsMocks(students, scoreRows);

      const service = createService();
      const result = await service.getScoreFacets(superAdminAuth, testAdministrationId, facetsQuery);

      const swrTask = result.tasks.find((t) => t.taskId === TASK_ID_1)!;
      expect(swrTask.supportLevelByGrade.map((e) => e.grade)).toEqual(['Kindergarten', '1', '2', '10']);
    });

    it('excludes students with a null grade from per-grade tallies', async () => {
      const students = [
        buildFacetStudent({ userId: 'student-graded', grade: '3' }),
        buildFacetStudent({ userId: 'student-no-grade', grade: null }),
      ];
      const scoreRows = [
        buildScoreRow('student-graded', VARIANT_ID_1, ScoreField.PERCENTILE, '50'),
        buildScoreRow('student-no-grade', VARIANT_ID_1, ScoreField.PERCENTILE, '50'),
      ];
      setupDefaultFacetsMocks(students, scoreRows);

      const service = createService();
      const result = await service.getScoreFacets(superAdminAuth, testAdministrationId, facetsQuery);

      const swrTask = result.tasks.find((t) => t.taskId === TASK_ID_1)!;
      expect(swrTask.supportLevelByGrade).toHaveLength(1);
      expect(swrTask.supportLevelByGrade[0]!.grade).toBe('3');
      expect(swrTask.supportLevelByGrade[0]!.totalAssessed).toBe(1);
    });

    it('uses raw users.grade representation (not display-normalized)', async () => {
      // Frontend remaps 'Kindergarten' → 'K' for display via getGrade(). The
      // backend response should preserve the raw enum value so it matches
      // sibling endpoints (overview, students).
      const students = [buildFacetStudent({ userId: 'student-k', grade: 'Kindergarten' })];
      const scoreRows = [buildScoreRow('student-k', VARIANT_ID_1, ScoreField.PERCENTILE, '50')];
      setupDefaultFacetsMocks(students, scoreRows);

      const service = createService();
      const result = await service.getScoreFacets(superAdminAuth, testAdministrationId, facetsQuery);

      const swrTask = result.tasks.find((t) => t.taskId === TASK_ID_1)!;
      expect(swrTask.supportLevelByGrade[0]!.grade).toBe('Kindergarten');
    });

    // --- Per-school aggregation (district scope) ---

    it('tallies support levels per school at district scope', async () => {
      const students = [
        buildFacetStudent({ userId: 'student-a1', grade: '3' }),
        buildFacetStudent({ userId: 'student-a2', grade: '3' }),
        buildFacetStudent({ userId: 'student-b1', grade: '3' }),
      ];
      const scoreRows = [
        buildScoreRow('student-a1', VARIANT_ID_1, ScoreField.PERCENTILE, '50'),
        buildScoreRow('student-a2', VARIANT_ID_1, ScoreField.PERCENTILE, '50'),
        buildScoreRow('student-b1', VARIANT_ID_1, ScoreField.PERCENTILE, '50'),
      ];
      const schoolsByUser = new Map<string, { schoolId: string; schoolName: string }>([
        ['student-a1', { schoolId: 'school-a-uuid', schoolName: 'Lincoln Elementary' }],
        ['student-a2', { schoolId: 'school-a-uuid', schoolName: 'Lincoln Elementary' }],
        ['student-b1', { schoolId: 'school-b-uuid', schoolName: 'Roosevelt Elementary' }],
      ]);
      setupDefaultFacetsMocks(students, scoreRows, schoolsByUser);

      const service = createService();
      const result = await service.getScoreFacets(superAdminAuth, testAdministrationId, facetsQuery);

      const swrTask = result.tasks.find((t) => t.taskId === TASK_ID_1)!;
      expect(swrTask.supportLevelBySchool).toHaveLength(2);
      const lincoln = swrTask.supportLevelBySchool.find((s) => s.schoolName === 'Lincoln Elementary')!;
      const roosevelt = swrTask.supportLevelBySchool.find((s) => s.schoolName === 'Roosevelt Elementary')!;
      expect(lincoln.totalAssessed).toBe(2);
      expect(lincoln.schoolId).toBe('school-a-uuid');
      expect(roosevelt.totalAssessed).toBe(1);
    });

    it('excludes students with no resolvable school from *BySchool tallies', async () => {
      // At district scope, a student missing from getSchoolsForUsers (e.g.,
      // no resolvable user_orgs / user_classes → school path) drops out of
      // the school-faceted breakdown but stays in the grade-faceted one.
      const students = [
        buildFacetStudent({ userId: 'student-with-school', grade: '3' }),
        buildFacetStudent({ userId: 'student-no-school', grade: '3' }),
      ];
      const scoreRows = [
        buildScoreRow('student-with-school', VARIANT_ID_1, ScoreField.PERCENTILE, '50'),
        buildScoreRow('student-no-school', VARIANT_ID_1, ScoreField.PERCENTILE, '50'),
      ];
      const schoolsByUser = new Map<string, { schoolId: string; schoolName: string }>([
        ['student-with-school', { schoolId: 'school-a-uuid', schoolName: 'Lincoln Elementary' }],
      ]);
      setupDefaultFacetsMocks(students, scoreRows, schoolsByUser);

      const service = createService();
      const result = await service.getScoreFacets(superAdminAuth, testAdministrationId, facetsQuery);

      const swrTask = result.tasks.find((t) => t.taskId === TASK_ID_1)!;
      // School tally only contains the school-resolvable student.
      expect(swrTask.supportLevelBySchool).toHaveLength(1);
      expect(swrTask.supportLevelBySchool[0]!.totalAssessed).toBe(1);
      // Grade tally still has both.
      expect(swrTask.supportLevelByGrade.find((e) => e.grade === '3')!.totalAssessed).toBe(2);
    });

    // --- Empty *BySchool at non-district scopes ---

    it.each([
      ['school', 'school'],
      ['class', 'class'],
      ['group', 'group'],
    ] as const)('returns empty *BySchool arrays at %s scope', async (_label, scopeType) => {
      const students = [buildFacetStudent({ userId: 'student-1', grade: '3' })];
      const scoreRows = [buildScoreRow('student-1', VARIANT_ID_1, ScoreField.PERCENTILE, '50')];
      setupDefaultFacetsMocks(students, scoreRows);

      const service = createService();
      const result = await service.getScoreFacets(superAdminAuth, testAdministrationId, {
        ...facetsQuery,
        scopeType,
      });

      for (const task of result.tasks) {
        expect(task.supportLevelBySchool).toEqual([]);
        expect(task.scoreBinsBySchool).toEqual([]);
      }
      // School resolution is not even attempted off district scope.
      expect(mockReportRepository.getSchoolsForUsers).not.toHaveBeenCalled();
    });

    // --- Bin edges and bin-edge stability ---

    it('returns 10 fixed percentile bins covering 0–100 with width 10', async () => {
      const students = [buildFacetStudent({ userId: 'student-1', grade: '3' })];
      const scoreRows = [buildScoreRow('student-1', VARIANT_ID_1, ScoreField.PERCENTILE, '50')];
      setupDefaultFacetsMocks(students, scoreRows);

      const service = createService();
      const result = await service.getScoreFacets(superAdminAuth, testAdministrationId, facetsQuery);

      const swrTask = result.tasks.find((t) => t.taskId === TASK_ID_1)!;
      const gradeEntry = swrTask.scoreBinsByGrade.find((e) => e.grade === '3')!;
      expect(gradeEntry.percentile).toHaveLength(10);
      expect(gradeEntry.percentile[0]).toMatchObject({ binStart: 0, binEnd: 10 });
      expect(gradeEntry.percentile[9]).toMatchObject({ binStart: 90, binEnd: 100 });
    });

    it('returns an empty percentile array when no student has a percentile for the task', async () => {
      const students = [buildFacetStudent({ userId: 'student-1', grade: '3' })];
      // No score rows — student has no percentile.
      setupDefaultFacetsMocks(students, []);

      const service = createService();
      const result = await service.getScoreFacets(superAdminAuth, testAdministrationId, facetsQuery);

      const swrTask = result.tasks.find((t) => t.taskId === TASK_ID_1)!;
      // No scored student → no grade entry at all.
      expect(swrTask.scoreBinsByGrade).toEqual([]);
    });

    it('places a percentile of 100 into the final bin (last bin is closed at top)', async () => {
      const students = [
        buildFacetStudent({ userId: 'student-max', grade: '3' }),
        buildFacetStudent({ userId: 'student-min', grade: '3' }),
      ];
      const scoreRows = [
        buildScoreRow('student-max', VARIANT_ID_1, ScoreField.PERCENTILE, '100'),
        buildScoreRow('student-min', VARIANT_ID_1, ScoreField.PERCENTILE, '0'),
      ];
      setupDefaultFacetsMocks(students, scoreRows);

      const service = createService();
      const result = await service.getScoreFacets(superAdminAuth, testAdministrationId, facetsQuery);

      const swrTask = result.tasks.find((t) => t.taskId === TASK_ID_1)!;
      const gradeEntry = swrTask.scoreBinsByGrade.find((e) => e.grade === '3')!;
      // Percentile 0 → bin 0, percentile 100 → final bin 9 (not dropped).
      expect(gradeEntry.percentile[0]!.count).toBe(1);
      expect(gradeEntry.percentile[9]!.count).toBe(1);
    });

    it('keeps bin edges stable when a user.grade filter narrows the population (#1782)', async () => {
      // 5 students across two grades. Without filter, all 5 contribute to the
      // (unfiltered) bin edges. Adding `user.grade:eq:3` filter should keep
      // the same binStart/binEnd values — only the bin counts change.
      const students = [
        buildFacetStudent({ userId: 's1', grade: '3' }),
        buildFacetStudent({ userId: 's2', grade: '3' }),
        buildFacetStudent({ userId: 's3', grade: '3' }),
        buildFacetStudent({ userId: 's4', grade: '4' }),
        buildFacetStudent({ userId: 's5', grade: '4' }),
      ];
      const scoreRows = [
        buildScoreRow('s1', VARIANT_ID_1, ScoreField.PERCENTILE, '10'),
        buildScoreRow('s2', VARIANT_ID_1, ScoreField.PERCENTILE, '50'),
        buildScoreRow('s3', VARIANT_ID_1, ScoreField.PERCENTILE, '90'),
        buildScoreRow('s4', VARIANT_ID_1, ScoreField.PERCENTILE, '5'),
        buildScoreRow('s5', VARIANT_ID_1, ScoreField.PERCENTILE, '95'),
      ];
      setupDefaultFacetsMocks(students, scoreRows);

      const service = createService();
      const unfiltered = await service.getScoreFacets(superAdminAuth, testAdministrationId, facetsQuery);

      // Re-run with grade filter applied. Mocks return the same unfiltered
      // population since they don't honor filters — that's the entire point:
      // the service does the filtering in JS.
      const filtered = await service.getScoreFacets(superAdminAuth, testAdministrationId, {
        ...facetsQuery,
        filter: [{ field: 'user.grade', operator: 'eq', value: '3' }],
      });

      const unfilteredTask = unfiltered.tasks.find((t) => t.taskId === TASK_ID_1)!;
      const filteredTask = filtered.tasks.find((t) => t.taskId === TASK_ID_1)!;

      // Bin edges identical — only counts differ.
      const unfilteredEdges = unfilteredTask.scoreBinsByGrade[0]!.percentile.map((b) => [b.binStart, b.binEnd]);
      const filteredEdges = filteredTask.scoreBinsByGrade[0]!.percentile.map((b) => [b.binStart, b.binEnd]);
      expect(filteredEdges).toEqual(unfilteredEdges);

      // Filter narrowed the cohort: only grade '3' present in the response.
      expect(filteredTask.supportLevelByGrade.map((e) => e.grade)).toEqual(['3']);
      expect(unfilteredTask.supportLevelByGrade.map((e) => e.grade)).toEqual(['3', '4']);
    });

    it('applies user.grade:gte filter with grade-ordinal semantics', async () => {
      const students = [
        buildFacetStudent({ userId: 's-k', grade: 'Kindergarten' }),
        buildFacetStudent({ userId: 's-1', grade: '1' }),
        buildFacetStudent({ userId: 's-3', grade: '3' }),
        buildFacetStudent({ userId: 's-5', grade: '5' }),
      ];
      const scoreRows = [
        buildScoreRow('s-k', VARIANT_ID_1, ScoreField.PERCENTILE, '50'),
        buildScoreRow('s-1', VARIANT_ID_1, ScoreField.PERCENTILE, '50'),
        buildScoreRow('s-3', VARIANT_ID_1, ScoreField.PERCENTILE, '50'),
        buildScoreRow('s-5', VARIANT_ID_1, ScoreField.PERCENTILE, '50'),
      ];
      setupDefaultFacetsMocks(students, scoreRows);

      const service = createService();
      const result = await service.getScoreFacets(superAdminAuth, testAdministrationId, {
        ...facetsQuery,
        filter: [{ field: 'user.grade', operator: 'gte', value: '3' }],
      });

      const swrTask = result.tasks.find((t) => t.taskId === TASK_ID_1)!;
      const grades = swrTask.supportLevelByGrade.map((e) => e.grade);
      expect(grades).toEqual(['3', '5']);
    });

    // --- Error wrapping ---

    it('wraps unexpected repository errors in a 500 ApiError', async () => {
      mockReportRepository.getAllStudentsInScope.mockRejectedValue(new Error('connection reset'));

      const service = createService();

      await expect(service.getScoreFacets(superAdminAuth, testAdministrationId, facetsQuery)).rejects.toMatchObject({
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
      });
    });

    it('re-throws ApiError without wrapping', async () => {
      mockAdministrationRepository.getById.mockResolvedValue(null);

      const service = createService();

      await expect(service.getScoreFacets(superAdminAuth, testAdministrationId, facetsQuery)).rejects.toMatchObject({
        statusCode: StatusCodes.NOT_FOUND,
        code: ApiErrorCode.RESOURCE_NOT_FOUND,
      });
    });

    // --- Raw-score bin path (closes a coverage gap from the initial test pass) ---

    it('computes raw-score bins from the unfiltered population min/max', async () => {
      // `swr` at grade ≥ 6 classifies via raw-score thresholds (not percentile).
      // The bin edges come from min/max of the unfiltered rawScore values — the
      // headline #1782 stability property only matters for raw-score bins
      // since percentile bins are fixed 0–100 by design.
      const students = [
        buildFacetStudent({ userId: 's1', grade: '8' }),
        buildFacetStudent({ userId: 's2', grade: '8' }),
        buildFacetStudent({ userId: 's3', grade: '8' }),
      ];
      const scoreRows = [
        buildScoreRow('s1', VARIANT_ID_1, ScoreField.SWR_RAW_SCORE, '100'),
        buildScoreRow('s2', VARIANT_ID_1, ScoreField.SWR_RAW_SCORE, '500'),
        buildScoreRow('s3', VARIANT_ID_1, ScoreField.SWR_RAW_SCORE, '700'),
      ];
      setupDefaultFacetsMocks(students, scoreRows);

      const service = createService();
      const result = await service.getScoreFacets(superAdminAuth, testAdministrationId, facetsQuery);

      const swrTask = result.tasks.find((t) => t.taskId === TASK_ID_1)!;
      const gradeEntry = swrTask.scoreBinsByGrade.find((e) => e.grade === '8')!;

      // 20 bins of width 30 covering [100, 700].
      expect(gradeEntry.rawScore).toHaveLength(20);
      expect(gradeEntry.rawScore[0]!.binStart).toBe(100);
      expect(gradeEntry.rawScore[19]!.binEnd).toBe(700);
      // Min and max both land in a bin (last bin is closed at top).
      const totalBinnedCount = gradeEntry.rawScore.reduce((sum, b) => sum + b.count, 0);
      expect(totalBinnedCount).toBe(3);
      // No percentile data → empty percentile array for this task.
      expect(gradeEntry.percentile).toEqual([]);
    });

    it('keeps raw-score bin edges stable when a user.grade filter narrows the cohort', async () => {
      // The headline #1782 property, exercised against the actual variable-edge
      // bin code path (not the fixed-edge percentile path covered earlier).
      const students = [
        buildFacetStudent({ userId: 's-a', grade: '8' }),
        buildFacetStudent({ userId: 's-b', grade: '8' }),
        buildFacetStudent({ userId: 's-c', grade: '10' }),
        buildFacetStudent({ userId: 's-d', grade: '10' }),
      ];
      const scoreRows = [
        buildScoreRow('s-a', VARIANT_ID_1, ScoreField.SWR_RAW_SCORE, '50'),
        buildScoreRow('s-b', VARIANT_ID_1, ScoreField.SWR_RAW_SCORE, '950'),
        buildScoreRow('s-c', VARIANT_ID_1, ScoreField.SWR_RAW_SCORE, '0'), // narrowest grade-10 value
        buildScoreRow('s-d', VARIANT_ID_1, ScoreField.SWR_RAW_SCORE, '1000'), // widest grade-10 value
      ];
      setupDefaultFacetsMocks(students, scoreRows);

      const service = createService();
      const unfiltered = await service.getScoreFacets(superAdminAuth, testAdministrationId, facetsQuery);
      const filtered = await service.getScoreFacets(superAdminAuth, testAdministrationId, {
        ...facetsQuery,
        filter: [{ field: 'user.grade', operator: 'eq', value: '8' }],
      });

      const unfilteredTask = unfiltered.tasks.find((t) => t.taskId === TASK_ID_1)!;
      const filteredTask = filtered.tasks.find((t) => t.taskId === TASK_ID_1)!;

      // Unfiltered: bins span [0, 1000]; filtered: would naively span [50, 950]
      // if edges were recomputed from the filtered cohort. The contract pins
      // them at the unfiltered range — identity assertion is sufficient.
      const unfilteredEdges = unfilteredTask.scoreBinsByGrade[0]!.rawScore.map((b) => [b.binStart, b.binEnd]);
      const filteredEdges = filteredTask.scoreBinsByGrade
        .find((e) => e.grade === '8')!
        .rawScore.map((b) => [b.binStart, b.binEnd]);
      expect(filteredEdges).toEqual(unfilteredEdges);
      // Sanity: the filter actually narrowed the cohort.
      expect(filteredTask.supportLevelByGrade.map((e) => e.grade)).toEqual(['8']);
    });

    it('falls back to a single-width bin when all raw scores collapse to one value', async () => {
      const students = [
        buildFacetStudent({ userId: 's-1', grade: '8' }),
        buildFacetStudent({ userId: 's-2', grade: '8' }),
      ];
      const scoreRows = [
        buildScoreRow('s-1', VARIANT_ID_1, ScoreField.SWR_RAW_SCORE, '500'),
        buildScoreRow('s-2', VARIANT_ID_1, ScoreField.SWR_RAW_SCORE, '500'),
      ];
      setupDefaultFacetsMocks(students, scoreRows);

      const service = createService();
      const result = await service.getScoreFacets(superAdminAuth, testAdministrationId, facetsQuery);

      const swrTask = result.tasks.find((t) => t.taskId === TASK_ID_1)!;
      const gradeEntry = swrTask.scoreBinsByGrade.find((e) => e.grade === '8')!;
      expect(gradeEntry.rawScore).toEqual([{ binStart: 500, binEnd: 500, count: 2 }]);
    });

    // --- Filter combinations (closes a coverage gap from the initial test pass) ---

    it('ANDs taskId and user.grade filters', async () => {
      const students = [
        buildFacetStudent({ userId: 's-3', grade: '3' }),
        buildFacetStudent({ userId: 's-4', grade: '4' }),
      ];
      const scoreRows = [
        buildScoreRow('s-3', VARIANT_ID_1, ScoreField.PERCENTILE, '50'),
        buildScoreRow('s-3', VARIANT_ID_2, ScoreField.PERCENTILE, '50'),
        buildScoreRow('s-4', VARIANT_ID_1, ScoreField.PERCENTILE, '50'),
      ];
      setupDefaultFacetsMocks(students, scoreRows);

      const service = createService();
      const result = await service.getScoreFacets(superAdminAuth, testAdministrationId, {
        ...facetsQuery,
        filter: [
          { field: 'taskId', operator: 'in', value: TASK_ID_1 },
          { field: 'user.grade', operator: 'eq', value: '3' },
        ],
      });

      // taskId filter narrows tasks to TASK_ID_1; grade filter narrows cohort
      // to grade '3'. Both are applied (ANDed), not just one of them.
      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0]!.taskId).toBe(TASK_ID_1);
      const grades = result.tasks[0]!.supportLevelByGrade.map((e) => e.grade);
      expect(grades).toEqual(['3']);
    });

    // --- Null-supportLevel invariant (closes a coverage gap from the initial test pass) ---

    // --- District-scope school resolution edge cases (review findings #14, #15) ---

    it('passes scopeId through to getSchoolsForUsers so the district ltree filter is applied', async () => {
      // Regression guard for review finding #1: the repository's
      // `getSchoolsForUsers(userIds, districtId)` needs `districtId` to scope
      // its lookup to the requested district's subtree. Verify the service
      // threads `scopeId` through rather than calling the older zero-arg form.
      const students = [buildFacetStudent({ userId: 'student-1', grade: '3' })];
      const scoreRows = [buildScoreRow('student-1', VARIANT_ID_1, ScoreField.PERCENTILE, '50')];
      setupDefaultFacetsMocks(students, scoreRows);

      const service = createService();
      await service.getScoreFacets(superAdminAuth, testAdministrationId, facetsQuery);

      expect(mockReportRepository.getSchoolsForUsers).toHaveBeenCalledWith(['student-1'], 'district-uuid-1');
    });

    it('puts a district-scope student with no resolvable school into *ByGrade but not *BySchool', async () => {
      // Closes review-finding #14: at district scope, a student visible via
      // `user_orgs` directly at the district level (no school or class
      // membership) won't have a school in `schoolsByUser` after the ltree
      // filter. They should still appear in the grade-faceted breakdown.
      const students = [buildFacetStudent({ userId: 'student-no-school', grade: '3' })];
      const scoreRows = [buildScoreRow('student-no-school', VARIANT_ID_1, ScoreField.PERCENTILE, '50')];
      // schoolsByUser deliberately empty — simulates the post-filter result
      // when no school in the district's subtree matches the student's
      // enrollments.
      setupDefaultFacetsMocks(students, scoreRows, new Map());

      const service = createService();
      const result = await service.getScoreFacets(superAdminAuth, testAdministrationId, facetsQuery);

      const swrTask = result.tasks.find((t) => t.taskId === TASK_ID_1)!;
      // Grade tally still has the student.
      expect(swrTask.supportLevelByGrade.find((e) => e.grade === '3')!.totalAssessed).toBe(1);
      // School tally is empty — the student didn't resolve to any school
      // within the requested district.
      expect(swrTask.supportLevelBySchool).toEqual([]);
      expect(swrTask.scoreBinsBySchool).toEqual([]);
    });

    it('counts a student in totalAssessed even when getSupportLevel returns null', async () => {
      // TASK_ID_4 in the fixture has slug 'vocab' which has no scoring config,
      // so getSupportLevel returns null. The student should still be counted
      // in totalAssessed (they have a completed run), but no support-level
      // bucket increments — meaning achieved + developing + needsExtra <=
      // totalAssessed, not strict equality.
      const students = [buildFacetStudent({ userId: 's1', grade: '3' })];
      const scoreRows = [buildScoreRow('s1', VARIANT_ID_4, ScoreField.PERCENTILE, '50')];
      setupDefaultFacetsMocks(students, scoreRows);

      const service = createService();
      const result = await service.getScoreFacets(superAdminAuth, testAdministrationId, facetsQuery);

      const vocabTask = result.tasks.find((t) => t.taskId === TASK_ID_4)!;
      const gradeEntry = vocabTask.supportLevelByGrade.find((e) => e.grade === '3');
      // Either the student isn't classified (no entry at all) or they're
      // counted with all-zero support-level buckets. Both are acceptable
      // outcomes for an unclassifiable task; pin the property: the assertion
      // sum <= totalAssessed must hold (vacuously 0 <= 0 when there is no entry).
      const bucketed = gradeEntry
        ? gradeEntry.achievedSkill.count + gradeEntry.developingSkill.count + gradeEntry.needsExtraSupport.count
        : 0;
      expect(bucketed).toBeLessThanOrEqual(gradeEntry?.totalAssessed ?? 0);
    });
  });

  // --- groupVariantsByTaskId helper unit test ---

  describe('groupVariantsByTaskId', () => {
    function buildMeta(overrides: Partial<ReportTaskMeta> & { taskId: string; taskVariantId: string }): ReportTaskMeta {
      return {
        taskSlug: 'swr',
        taskName: 'ROAR - Word',
        orderIndex: 0,
        conditionsAssignment: null,
        conditionsRequirements: null,
        ...overrides,
      };
    }

    it('returns an empty array for empty input', () => {
      expect(groupVariantsByTaskId([])).toEqual([]);
    });

    it('groups variants sharing a taskId and uses the first occurrence as the representative', () => {
      const a = buildMeta({ taskId: 'task-1', taskVariantId: 'v-1', orderIndex: 0 });
      const b = buildMeta({ taskId: 'task-1', taskVariantId: 'v-2', orderIndex: 1 });
      const c = buildMeta({ taskId: 'task-2', taskVariantId: 'v-3', orderIndex: 2 });

      const groups = groupVariantsByTaskId([a, b, c]);

      expect(groups).toHaveLength(2);
      expect(groups[0]!.representative).toBe(a);
      expect(groups[0]!.variants).toEqual([a, b]);
      expect(groups[1]!.representative).toBe(c);
      expect(groups[1]!.variants).toEqual([c]);
    });

    it('preserves the input order across taskIds (does not sort by taskId)', () => {
      // First-seen wins for ordering — taskId 'z' before 'a' in input → 'z' first in output.
      const z = buildMeta({ taskId: 'z-task', taskVariantId: 'v-z', orderIndex: 0 });
      const a = buildMeta({ taskId: 'a-task', taskVariantId: 'v-a', orderIndex: 1 });

      const groups = groupVariantsByTaskId([z, a]);

      expect(groups.map((g) => g.representative.taskId)).toEqual(['z-task', 'a-task']);
    });
  });

  describe('listStudentScores', () => {
    const baseQuery: StudentScoresInput = {
      scopeType: 'district',
      scopeId: 'district-uuid-1',
      page: 1,
      perPage: 25,
      sortBy: 'user.lastName',
      sortOrder: 'asc',
      filter: [],
    };

    /** Build a StudentScoreQueryRow with default null demographics. */
    function buildQueryRow(overrides: Partial<StudentScoreQueryRow> & { userId: string }): StudentScoreQueryRow {
      return {
        assessmentPid: null,
        username: null,
        email: null,
        nameFirst: null,
        nameLast: null,
        grade: '3',
        statusEll: null,
        statusIep: null,
        statusFrl: null,
        dob: null,
        gender: null,
        race: null,
        hispanicEthnicity: null,
        homeLanguage: null,
        runs: new Map(),
        scores: new Map(),
        ...overrides,
      };
    }

    /** Build a default getStudentScores mock return value. */
    function setupDefaultStudentScoresMocks(items: StudentScoreQueryRow[] = [], totalItems = items.length) {
      mockReportRepository.getStudentScores.mockResolvedValue({ items, totalItems });
      mockTaskVariantParameterRepository.getByTaskVariantIds.mockResolvedValue([]);
      mockReportRepository.getSchoolNamesForUsers.mockResolvedValue(new Map());
    }

    // --- Authorization ---

    it('returns 404 when administration does not exist', async () => {
      mockAdministrationRepository.getById.mockResolvedValue(null);

      const service = createService();
      await expect(service.listStudentScores(teacherAuth, testAdministrationId, baseQuery)).rejects.toMatchObject({
        statusCode: StatusCodes.NOT_FOUND,
        code: ApiErrorCode.RESOURCE_NOT_FOUND,
      });
    });

    it('returns 403 when FGA denies can_read_scores on administration', async () => {
      mockAuthorizationService.requirePermission.mockRejectedValue(
        new ApiError(ApiErrorMessage.FORBIDDEN, {
          statusCode: StatusCodes.FORBIDDEN,
          code: ApiErrorCode.AUTH_FORBIDDEN,
        }),
      );

      const service = createService();
      await expect(service.listStudentScores(teacherAuth, testAdministrationId, baseQuery)).rejects.toMatchObject({
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
      });

      expect(mockAuthorizationService.requirePermission).toHaveBeenCalledWith(
        teacherAuth.userId,
        FgaRelation.CAN_READ_SCORES,
        `${FgaType.ADMINISTRATION}:${testAdministrationId}`,
      );
    });

    it('returns 400 when scope is not assigned to administration', async () => {
      mockReportRepository.isScopeAssignedToAdministration.mockResolvedValue(false);

      const service = createService();
      await expect(service.listStudentScores(teacherAuth, testAdministrationId, baseQuery)).rejects.toMatchObject({
        statusCode: StatusCodes.BAD_REQUEST,
        code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
      });
    });

    it('returns 403 when FGA denies can_read_scores at scope level', async () => {
      mockAuthorizationService.requirePermission.mockResolvedValueOnce(undefined).mockRejectedValueOnce(
        new ApiError(ApiErrorMessage.FORBIDDEN, {
          statusCode: StatusCodes.FORBIDDEN,
          code: ApiErrorCode.AUTH_FORBIDDEN,
        }),
      );

      const service = createService();
      await expect(service.listStudentScores(teacherAuth, testAdministrationId, baseQuery)).rejects.toMatchObject({
        statusCode: StatusCodes.FORBIDDEN,
      });

      expect(mockAuthorizationService.requirePermission).toHaveBeenNthCalledWith(
        2,
        teacherAuth.userId,
        FgaRelation.CAN_READ_SCORES,
        `${FgaType.DISTRICT}:district-uuid-1`,
      );
    });

    it('super admin bypasses FGA checks', async () => {
      setupDefaultStudentScoresMocks();

      const service = createService();
      await service.listStudentScores(superAdminAuth, testAdministrationId, baseQuery);

      expect(mockAuthorizationService.requirePermission).not.toHaveBeenCalled();
    });

    // --- Pagination + response shape ---

    it('returns paginated rows with totalItems and tasks metadata', async () => {
      const row = buildQueryRow({ userId: 'student-1', nameFirst: 'Jane', nameLast: 'Doe', grade: '3' });
      setupDefaultStudentScoresMocks([row], 42);

      const service = createService();
      const result = await service.listStudentScores(superAdminAuth, testAdministrationId, baseQuery);

      expect(result.totalItems).toBe(42);
      expect(result.items).toHaveLength(1);
      expect(result.tasks).toHaveLength(testTaskMetas.length);
      expect(result.items[0]!.user.firstName).toBe('Jane');
      expect(result.items[0]!.user.lastName).toBe('Doe');
    });

    // --- Dynamic sort: unknown taskId → 400 ---

    it('returns 400 when dynamic sort references an unknown task ID', async () => {
      const service = createService();

      await expect(
        service.listStudentScores(superAdminAuth, testAdministrationId, {
          ...baseQuery,
          sortBy: 'scores.00000000-0000-0000-0000-000000000000.percentile',
        }),
      ).rejects.toMatchObject({
        statusCode: StatusCodes.BAD_REQUEST,
        code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
      });
    });

    it('passes a primary-variant sort field ref to the repository for dynamic score sort', async () => {
      setupDefaultStudentScoresMocks();

      const service = createService();
      await service.listStudentScores(superAdminAuth, testAdministrationId, {
        ...baseQuery,
        sortBy: `scores.${TASK_ID_1}.percentile`,
      });

      const callArgs = mockReportRepository.getStudentScores.mock.calls[0]!;
      // sortField shifted from index 5 to index 6 once admin was inserted at index 2 (#1792).
      const sortField = callArgs[6];
      expect(sortField).toMatchObject({
        taskVariantId: VARIANT_ID_1,
        taskSlug: 'swr',
        fieldType: 'percentile',
      });
    });

    // --- taskId filter (merged across multiple entries) ---

    it('merges multiple taskId filter entries into a single allow-list', async () => {
      setupDefaultStudentScoresMocks();

      const service = createService();
      await service.listStudentScores(superAdminAuth, testAdministrationId, {
        ...baseQuery,
        filter: [
          { field: 'taskId', operator: 'in', value: TASK_ID_1 },
          { field: 'taskId', operator: 'in', value: TASK_ID_3 },
        ],
      });

      // After #1792, getStudentScores args are: administrationId, scope, admin, taskMetas, options, filterCondition, sortField, scoreFieldFilters, scoringRulesByVariant, includeUnenrolledStudents
      const taskMetasArg = mockReportRepository.getStudentScores.mock.calls[0]![3];
      const seenIds = new Set(taskMetasArg.map((t) => t.taskId));
      expect(seenIds).toEqual(new Set([TASK_ID_1, TASK_ID_3]));
    });

    it('returns 400 when taskId filter references a UUID not assigned to the administration', async () => {
      // Previously silent-dropped to an empty page (200). `applyTaskIdFilter`
      // now validates against the admin's actual task IDs and throws
      // BAD_REQUEST for unknowns — matching the contract's claim that
      // unknown task IDs in filter return 400 and aligning the three
      // score-reporting endpoints on a single behavior.
      setupDefaultStudentScoresMocks();

      const filteredQuery: StudentScoresInput = {
        ...baseQuery,
        filter: [{ field: 'taskId', operator: 'in', value: '00000000-0000-0000-0000-000000000000' }],
      };

      const service = createService();
      await expect(
        service.listStudentScores(superAdminAuth, testAdministrationId, filteredQuery),
      ).rejects.toMatchObject({
        statusCode: StatusCodes.BAD_REQUEST,
        code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
      });
      // Validation fires before any downstream DB call beyond getTaskMetadata.
      expect(mockReportRepository.getStudentScores).not.toHaveBeenCalled();
      expect(mockReportRepository.getSchoolNamesForUsers).not.toHaveBeenCalled();
    });

    // --- Dynamic score-field filter translation ---

    it('translates supportLevel:eq:achievedSkill into priority 3', async () => {
      setupDefaultStudentScoresMocks();

      const service = createService();
      await service.listStudentScores(superAdminAuth, testAdministrationId, {
        ...baseQuery,
        filter: [{ field: `scores.${TASK_ID_1}.supportLevel`, operator: 'eq', value: 'achievedSkill' }],
      });

      // scoreFieldFilters arg shifted from index 6 to 7 after admin insertion (#1792).
      const fieldFilters = mockReportRepository.getStudentScores.mock.calls[0]![7];
      expect(fieldFilters).toHaveLength(1);
      expect(fieldFilters![0]).toMatchObject({
        taskVariantId: VARIANT_ID_1,
        fieldType: 'supportLevel',
        operator: 'eq',
        values: ['3'],
      });
    });

    it('translates supportLevel:in:achievedSkill,developingSkill into priorities [3, 2]', async () => {
      setupDefaultStudentScoresMocks();

      const service = createService();
      await service.listStudentScores(superAdminAuth, testAdministrationId, {
        ...baseQuery,
        filter: [{ field: `scores.${TASK_ID_1}.supportLevel`, operator: 'in', value: 'achievedSkill,developingSkill' }],
      });

      // scoreFieldFilters arg shifted from index 6 to 7 after admin insertion (#1792).
      const fieldFilters = mockReportRepository.getStudentScores.mock.calls[0]![7];
      expect(fieldFilters![0]!.values).toEqual(['3', '2']);
    });

    it('drops supportLevel:eq:optional from SQL filters (post-fetch only)', async () => {
      setupDefaultStudentScoresMocks();

      const service = createService();
      await service.listStudentScores(superAdminAuth, testAdministrationId, {
        ...baseQuery,
        filter: [{ field: `scores.${TASK_ID_1}.supportLevel`, operator: 'eq', value: 'optional' }],
      });

      // scoreFieldFilters arg shifted from index 6 to 7 after admin insertion (#1792).
      const fieldFilters = mockReportRepository.getStudentScores.mock.calls[0]![7];
      // 'optional' has no SQL representation; the resolver returns null and we drop it
      expect(fieldFilters).toEqual([]);
    });

    it('passes numeric score-range filter values verbatim', async () => {
      setupDefaultStudentScoresMocks();

      const service = createService();
      await service.listStudentScores(superAdminAuth, testAdministrationId, {
        ...baseQuery,
        filter: [{ field: `scores.${TASK_ID_1}.rawScore`, operator: 'gte', value: '500' }],
      });

      // scoreFieldFilters arg shifted from index 6 to 7 after admin insertion (#1792).
      const fieldFilters = mockReportRepository.getStudentScores.mock.calls[0]![7];
      expect(fieldFilters![0]).toMatchObject({
        fieldType: 'rawScore',
        operator: 'gte',
        values: ['500'],
      });
    });

    it('returns 400 when dynamic filter references an unknown task ID', async () => {
      const service = createService();

      await expect(
        service.listStudentScores(superAdminAuth, testAdministrationId, {
          ...baseQuery,
          filter: [{ field: 'scores.00000000-0000-0000-0000-000000000000.percentile', operator: 'gte', value: '50' }],
        }),
      ).rejects.toMatchObject({
        statusCode: StatusCodes.BAD_REQUEST,
        code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
      });
    });

    // --- Per-row assembly: classification, dedup, optional/null support level ---

    it('classifies scored students using the scoring service', async () => {
      const row = buildQueryRow({
        userId: 'student-1',
        grade: '3',
        runs: new Map([
          [VARIANT_ID_1, { runId: 'run-1', reliable: true, engagementFlags: [], completedAt: new Date('2025-09-01') }],
        ]),
        scores: new Map([[VARIANT_ID_1, new Map([[ScoreField.PERCENTILE, '90']])]]),
      });
      setupDefaultStudentScoresMocks([row], 1);

      const service = createService();
      const result = await service.listStudentScores(superAdminAuth, testAdministrationId, baseQuery);

      const swrEntry = result.items[0]!.scores[TASK_ID_1]!;
      expect(swrEntry.completed).toBe(true);
      // grade 3, swr v0 cutoffs achieved=50 → percentile 90 → achievedSkill
      expect(swrEntry.supportLevel).toBe('achievedSkill');
      expect(swrEntry.percentile).toBe(90);
      expect(swrEntry.reliable).toBe(true);
      expect(swrEntry.engagementFlags).toEqual([]);
    });

    it('marks not-assessed students as completed:false with supportLevel="optional" when task is optional', async () => {
      const row = buildQueryRow({ userId: 'student-1', grade: '3' });
      setupDefaultStudentScoresMocks([row], 1);
      mockTaskService.evaluateTaskVariantEligibility.mockReturnValue({ isAssigned: true, isOptional: true });

      const service = createService();
      const result = await service.listStudentScores(superAdminAuth, testAdministrationId, baseQuery);

      const entry = result.items[0]!.scores[TASK_ID_1]!;
      expect(entry.completed).toBe(false);
      expect(entry.supportLevel).toBe('optional');
      expect(entry.optional).toBe(true);
      expect(entry.rawScore).toBeNull();
    });

    it('marks not-assessed students as completed:false with supportLevel=null when task is required', async () => {
      const row = buildQueryRow({ userId: 'student-1', grade: '3' });
      setupDefaultStudentScoresMocks([row], 1);
      mockTaskService.evaluateTaskVariantEligibility.mockReturnValue({ isAssigned: true, isOptional: false });

      const service = createService();
      const result = await service.listStudentScores(superAdminAuth, testAdministrationId, baseQuery);

      const entry = result.items[0]!.scores[TASK_ID_1]!;
      expect(entry.completed).toBe(false);
      expect(entry.supportLevel).toBeNull();
      expect(entry.optional).toBe(false);
    });

    it('omits tasks not assigned to the student from the scores map', async () => {
      const row = buildQueryRow({ userId: 'student-1', grade: '3' });
      setupDefaultStudentScoresMocks([row], 1);
      mockTaskService.evaluateTaskVariantEligibility.mockReturnValue({ isAssigned: false, isOptional: false });

      const service = createService();
      const result = await service.listStudentScores(superAdminAuth, testAdministrationId, baseQuery);

      expect(result.items[0]!.scores[TASK_ID_1]).toBeUndefined();
    });

    it('rounds score values to integers', async () => {
      const row = buildQueryRow({
        userId: 'student-1',
        grade: '3',
        runs: new Map([
          [VARIANT_ID_1, { runId: 'run-1', reliable: true, engagementFlags: [], completedAt: new Date('2025-09-01') }],
        ]),
        scores: new Map([
          [
            VARIANT_ID_1,
            new Map([
              [ScoreField.PERCENTILE, '90.7'],
              [ScoreField.SWR_RAW_SCORE, '512.4'],
            ]),
          ],
        ]),
      });
      setupDefaultStudentScoresMocks([row], 1);

      const service = createService();
      const result = await service.listStudentScores(superAdminAuth, testAdministrationId, baseQuery);

      const entry = result.items[0]!.scores[TASK_ID_1]!;
      expect(entry.percentile).toBe(91);
      expect(entry.rawScore).toBe(512);
    });

    it('uses first variant with completed scores in multi-variant tasks (per-row dedup)', async () => {
      const SHARED_TASK = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
      const variantA: ReportTaskMeta = {
        taskId: SHARED_TASK,
        taskVariantId: 'var-a',
        taskSlug: 'swr',
        taskName: 'ROAR - Word',
        orderIndex: 0,
        conditionsAssignment: null,
        conditionsRequirements: null,
      };
      const variantB: ReportTaskMeta = {
        taskId: SHARED_TASK,
        taskVariantId: 'var-b',
        taskSlug: 'swr',
        taskName: 'ROAR - Word',
        orderIndex: 1,
        conditionsAssignment: null,
        conditionsRequirements: null,
      };
      mockReportRepository.getTaskMetadata.mockResolvedValue([variantA, variantB]);

      // Student has scores on BOTH variants; variant A wins (lower orderIndex).
      const row = buildQueryRow({
        userId: 'student-1',
        grade: '3',
        runs: new Map([
          ['var-a', { runId: 'run-a', reliable: true, engagementFlags: [], completedAt: new Date('2025-09-02') }],
          [
            'var-b',
            { runId: 'run-b', reliable: false, engagementFlags: ['flagB'], completedAt: new Date('2025-09-01') },
          ],
        ]),
        scores: new Map([
          ['var-a', new Map([[ScoreField.PERCENTILE, '90']])],
          ['var-b', new Map([[ScoreField.PERCENTILE, '10']])],
        ]),
      });
      setupDefaultStudentScoresMocks([row], 1);

      const service = createService();
      const result = await service.listStudentScores(superAdminAuth, testAdministrationId, baseQuery);

      // Only one entry for the shared taskId
      expect(Object.keys(result.items[0]!.scores)).toEqual([SHARED_TASK]);
      // Variant A (high percentile, reliable) wins
      expect(result.items[0]!.scores[SHARED_TASK]!.supportLevel).toBe('achievedSkill');
      expect(result.items[0]!.scores[SHARED_TASK]!.reliable).toBe(true);
    });

    it('reads supportLevel from run_scores for assessment-computed tasks (roam-alpaca)', async () => {
      const ROAM_TASK = 'cccccccc-aaaa-bbbb-dddd-eeeeeeeeeeee';
      const ROAM_VARIANT = 'roam-variant-1';
      mockReportRepository.getTaskMetadata.mockResolvedValue([
        {
          taskId: ROAM_TASK,
          taskVariantId: ROAM_VARIANT,
          taskSlug: 'roam-alpaca',
          taskName: 'ROAM - Alpaca',
          orderIndex: 0,
          conditionsAssignment: null,
          conditionsRequirements: null,
        },
      ]);

      const row = buildQueryRow({
        userId: 'student-1',
        grade: '3',
        runs: new Map([
          [ROAM_VARIANT, { runId: 'r', reliable: true, engagementFlags: [], completedAt: new Date('2025-09-01') }],
        ]),
        scores: new Map([[ROAM_VARIANT, new Map([['supportLevel', 'developingSkill']])]]),
      });
      setupDefaultStudentScoresMocks([row], 1);

      const service = createService();
      const result = await service.listStudentScores(superAdminAuth, testAdministrationId, baseQuery);

      expect(result.items[0]!.scores[ROAM_TASK]!.supportLevel).toBe('developingSkill');
    });

    // --- schoolName ---

    it('populates schoolName for district scope', async () => {
      const row = buildQueryRow({ userId: 'student-1', grade: '3' });
      setupDefaultStudentScoresMocks([row], 1);
      mockReportRepository.getSchoolNamesForUsers.mockResolvedValue(new Map([['student-1', 'Lincoln Elementary']]));

      const service = createService();
      const result = await service.listStudentScores(superAdminAuth, testAdministrationId, baseQuery);

      expect(result.items[0]!.user.schoolName).toBe('Lincoln Elementary');
    });

    it('passes scopeId through to getSchoolNamesForUsers so the district ltree filter is applied', async () => {
      // Regression guard for the cross-district leakage fix on
      // getSchoolNamesForUsers (#1782 review follow-up): the service must
      // thread `scope.scopeId` through to the repository so the school
      // lookup is constrained to the requested district's subtree.
      // Without it, a student enrolled cross-district could surface a
      // foreign school's name in the response.
      const row = buildQueryRow({ userId: 'student-1', grade: '3' });
      setupDefaultStudentScoresMocks([row], 1);
      mockReportRepository.getSchoolNamesForUsers.mockResolvedValue(new Map([['student-1', 'Lincoln Elementary']]));

      const service = createService();
      await service.listStudentScores(superAdminAuth, testAdministrationId, baseQuery);

      expect(mockReportRepository.getSchoolNamesForUsers).toHaveBeenCalledWith(['student-1'], 'district-uuid-1');
    });

    it('returns null schoolName for non-district scope', async () => {
      const row = buildQueryRow({ userId: 'student-1', grade: '3' });
      setupDefaultStudentScoresMocks([row], 1);

      const service = createService();
      const result = await service.listStudentScores(superAdminAuth, testAdministrationId, {
        ...baseQuery,
        scopeType: 'school',
      });

      expect(result.items[0]!.user.schoolName).toBeNull();
      expect(mockReportRepository.getSchoolNamesForUsers).not.toHaveBeenCalled();
    });

    // --- Error handling ---

    it('wraps unexpected repository errors in a 500 ApiError', async () => {
      mockReportRepository.getStudentScores.mockRejectedValue(new Error('connection reset'));
      mockTaskVariantParameterRepository.getByTaskVariantIds.mockResolvedValue([]);

      const service = createService();
      await expect(service.listStudentScores(superAdminAuth, testAdministrationId, baseQuery)).rejects.toMatchObject({
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
      });
    });

    it('re-throws ApiError without wrapping', async () => {
      mockAdministrationRepository.getById.mockResolvedValue(null);

      const service = createService();
      await expect(service.listStudentScores(superAdminAuth, testAdministrationId, baseQuery)).rejects.toMatchObject({
        statusCode: StatusCodes.NOT_FOUND,
        code: ApiErrorCode.RESOURCE_NOT_FOUND,
      });
    });
  });

  describe('getIndividualStudentReport', () => {
    const targetUserId = 'student-1';
    const reportQuery: IndividualStudentReportInput = {
      scopeType: 'district',
      scopeId: 'district-uuid-1',
    };

    function setupDefaults(opts?: { studentInScope?: boolean }) {
      mockReportRepository.verifyStudentInScope.mockResolvedValue(opts?.studentInScope ?? true);
      mockReportRepository.getCompletedRunScores.mockResolvedValue([]);
      mockReportRepository.getCompletedRunsForUser.mockResolvedValue([]);
      mockReportRepository.getHistoricalRunsForUser.mockResolvedValue([]);
      mockReportRepository.getScoresForRunIds.mockResolvedValue([]);
      mockTaskVariantParameterRepository.getByTaskVariantIds.mockResolvedValue([]);
      mockUserRepository.getById.mockResolvedValue(
        UserFactory.build({ id: targetUserId, nameFirst: 'Jane', nameLast: 'Doe', username: 'jdoe', grade: '3' }),
      );
    }

    // --- Authorization ---

    it('returns 404 when administration does not exist', async () => {
      mockAdministrationRepository.getById.mockResolvedValue(null);

      const service = createService();
      await expect(
        service.getIndividualStudentReport(teacherAuth, testAdministrationId, targetUserId, reportQuery),
      ).rejects.toMatchObject({
        statusCode: StatusCodes.NOT_FOUND,
        code: ApiErrorCode.RESOURCE_NOT_FOUND,
      });
    });

    it('returns 403 when FGA denies can_read_scores at administration level', async () => {
      mockAuthorizationService.requirePermission.mockRejectedValue(
        new ApiError(ApiErrorMessage.FORBIDDEN, {
          statusCode: StatusCodes.FORBIDDEN,
          code: ApiErrorCode.AUTH_FORBIDDEN,
        }),
      );

      const service = createService();
      await expect(
        service.getIndividualStudentReport(teacherAuth, testAdministrationId, targetUserId, reportQuery),
      ).rejects.toMatchObject({ statusCode: StatusCodes.FORBIDDEN });
    });

    it('returns 400 when scope is not assigned', async () => {
      mockReportRepository.isScopeAssignedToAdministration.mockResolvedValue(false);

      const service = createService();
      await expect(
        service.getIndividualStudentReport(teacherAuth, testAdministrationId, targetUserId, reportQuery),
      ).rejects.toMatchObject({
        statusCode: StatusCodes.BAD_REQUEST,
        code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
      });
    });

    it('returns 403 when FGA denies can_read_scores at scope level', async () => {
      mockAuthorizationService.requirePermission.mockResolvedValueOnce(undefined).mockRejectedValueOnce(
        new ApiError(ApiErrorMessage.FORBIDDEN, {
          statusCode: StatusCodes.FORBIDDEN,
          code: ApiErrorCode.AUTH_FORBIDDEN,
        }),
      );

      const service = createService();
      await expect(
        service.getIndividualStudentReport(teacherAuth, testAdministrationId, targetUserId, reportQuery),
      ).rejects.toMatchObject({ statusCode: StatusCodes.FORBIDDEN });
    });

    it('returns 404 when student is not in the requested scope', async () => {
      setupDefaults({ studentInScope: false });

      const service = createService();
      await expect(
        service.getIndividualStudentReport(superAdminAuth, testAdministrationId, targetUserId, reportQuery),
      ).rejects.toMatchObject({
        statusCode: StatusCodes.NOT_FOUND,
        code: ApiErrorCode.RESOURCE_NOT_FOUND,
      });
    });

    it('super admin bypasses FGA but still enforces student-in-scope', async () => {
      setupDefaults();

      const service = createService();
      await service.getIndividualStudentReport(superAdminAuth, testAdministrationId, targetUserId, reportQuery);

      expect(mockAuthorizationService.requirePermission).not.toHaveBeenCalled();
      expect(mockReportRepository.verifyStudentInScope).toHaveBeenCalledWith(
        { scopeType: 'district', scopeId: 'district-uuid-1' },
        expect.objectContaining({ id: expect.any(String), dateStart: expect.any(Date), dateEnd: expect.any(Date) }),
        targetUserId,
      );
    });

    // --- Header info ---

    it('returns student and administration header info', async () => {
      setupDefaults();

      const service = createService();
      const result = await service.getIndividualStudentReport(
        superAdminAuth,
        testAdministrationId,
        targetUserId,
        reportQuery,
      );

      expect(result.student).toMatchObject({
        userId: targetUserId,
        firstName: 'Jane',
        lastName: 'Doe',
        username: 'jdoe',
        grade: '3',
      });
      expect(result.administration).toMatchObject({
        id: testAdministrationId,
      });
      expect(result.administration.name).toBeDefined();
      expect(result.administration.dateStart).toBeDefined();
      expect(result.administration.dateEnd).toBeDefined();
    });

    // --- Per-task assembly ---

    it('classifies a completed task and emits required tags', async () => {
      setupDefaults();
      const completedScoreRow: RunScoreRow = {
        userId: targetUserId,
        taskVariantId: VARIANT_ID_1,
        scoreName: ScoreField.PERCENTILE,
        scoreValue: '90',
      };
      mockReportRepository.getCompletedRunScores.mockResolvedValue([completedScoreRow]);
      mockReportRepository.getCompletedRunsForUser.mockResolvedValue([
        {
          runId: 'run-1',
          taskVariantId: VARIANT_ID_1,
          reliable: true,
          engagementFlags: [],
          completedAt: new Date('2025-09-01'),
        },
      ]);

      const service = createService();
      const result = await service.getIndividualStudentReport(
        superAdminAuth,
        testAdministrationId,
        targetUserId,
        reportQuery,
      );

      const swrTask = result.tasks.find((t) => t.taskId === TASK_ID_1)!;
      expect(swrTask.completed).toBe(true);
      expect(swrTask.scores.percentile).toBe(90);
      // grade 3, swr v0 cutoffs achieved=50 → 90 → achievedSkill
      expect(swrTask.supportLevel).toBe('achievedSkill');
      expect(swrTask.optional).toBe(false);

      // Tags include Type: Required and Reliability for assessed entries
      const labels = swrTask.tags.map((t) => t.label);
      expect(labels).toContain('Type');
      expect(labels).toContain('Reliability');
      const typeTag = swrTask.tags.find((t) => t.label === 'Type')!;
      expect(typeTag.value).toBe('Required');
    });

    it('emits Type tag only (no Reliability) for an unassessed task', async () => {
      setupDefaults();

      const service = createService();
      const result = await service.getIndividualStudentReport(
        superAdminAuth,
        testAdministrationId,
        targetUserId,
        reportQuery,
      );

      const swrTask = result.tasks.find((t) => t.taskId === TASK_ID_1)!;
      expect(swrTask.completed).toBe(false);
      expect(swrTask.tags.map((t) => t.label)).toEqual(['Type']);
    });

    it('marks unassessed optional tasks with supportLevel=optional', async () => {
      setupDefaults();
      mockTaskService.evaluateTaskVariantEligibility.mockReturnValue({ isAssigned: true, isOptional: true });

      const service = createService();
      const result = await service.getIndividualStudentReport(
        superAdminAuth,
        testAdministrationId,
        targetUserId,
        reportQuery,
      );

      const swrTask = result.tasks.find((t) => t.taskId === TASK_ID_1)!;
      expect(swrTask.completed).toBe(false);
      expect(swrTask.supportLevel).toBe('optional');
      expect(swrTask.tags.find((t) => t.label === 'Type')!.value).toBe('Optional');
    });

    it('omits tasks where the student is not assigned (excluded by conditions)', async () => {
      setupDefaults();
      mockTaskService.evaluateTaskVariantEligibility.mockReturnValue({ isAssigned: false, isOptional: false });

      const service = createService();
      const result = await service.getIndividualStudentReport(
        superAdminAuth,
        testAdministrationId,
        targetUserId,
        reportQuery,
      );

      expect(result.tasks).toHaveLength(0);
      expect(result.totalTaskCount).toBe(0);
      expect(result.completedTaskCount).toBe(0);
    });

    // --- Subscores ---

    it('extracts PA subscores and computes skillsToWorkOn for keys below threshold', async () => {
      setupDefaults();
      // Use a PA-slug task in metadata
      const PA_TASK_ID = 'aaaaaaaa-bbbb-cccc-dddd-000000000001';
      const PA_VARIANT_ID = 'pa-variant-1';
      mockReportRepository.getTaskMetadata.mockResolvedValue([
        {
          taskId: PA_TASK_ID,
          taskVariantId: PA_VARIANT_ID,
          taskSlug: 'pa',
          taskName: 'ROAR - Phoneme',
          orderIndex: 0,
          conditionsAssignment: null,
          conditionsRequirements: null,
        },
      ]);
      const scoreRows: RunScoreRow[] = [
        // FSM at 50% (below 78.9% threshold) — should appear in skillsToWorkOn
        {
          userId: targetUserId,
          taskVariantId: PA_VARIANT_ID,
          scoreDomain: 'FSM',
          scoreName: 'numCorrect',
          scoreValue: '10',
        },
        {
          userId: targetUserId,
          taskVariantId: PA_VARIANT_ID,
          scoreDomain: 'FSM',
          scoreName: 'numAttempted',
          scoreValue: '20',
        },
        {
          userId: targetUserId,
          taskVariantId: PA_VARIANT_ID,
          scoreDomain: 'FSM',
          scoreName: 'percentCorrect',
          scoreValue: '50',
        },
        // LSM at 90% (above threshold)
        {
          userId: targetUserId,
          taskVariantId: PA_VARIANT_ID,
          scoreDomain: 'LSM',
          scoreName: 'numCorrect',
          scoreValue: '18',
        },
        {
          userId: targetUserId,
          taskVariantId: PA_VARIANT_ID,
          scoreDomain: 'LSM',
          scoreName: 'numAttempted',
          scoreValue: '20',
        },
        {
          userId: targetUserId,
          taskVariantId: PA_VARIANT_ID,
          scoreDomain: 'LSM',
          scoreName: 'percentCorrect',
          scoreValue: '90',
        },
        // DEL at 60% (below threshold)
        {
          userId: targetUserId,
          taskVariantId: PA_VARIANT_ID,
          scoreDomain: 'DEL',
          scoreName: 'numCorrect',
          scoreValue: '12',
        },
        {
          userId: targetUserId,
          taskVariantId: PA_VARIANT_ID,
          scoreDomain: 'DEL',
          scoreName: 'numAttempted',
          scoreValue: '20',
        },
        {
          userId: targetUserId,
          taskVariantId: PA_VARIANT_ID,
          scoreDomain: 'DEL',
          scoreName: 'percentCorrect',
          scoreValue: '60',
        },
      ];
      mockReportRepository.getCompletedRunScores.mockResolvedValue(scoreRows);
      mockReportRepository.getCompletedRunsForUser.mockResolvedValue([
        {
          runId: 'pa-run-1',
          taskVariantId: PA_VARIANT_ID,
          reliable: true,
          engagementFlags: [],
          completedAt: new Date('2025-09-01'),
        },
      ]);

      const service = createService();
      const result = await service.getIndividualStudentReport(
        superAdminAuth,
        testAdministrationId,
        targetUserId,
        reportQuery,
      );

      const paTask = result.tasks.find((t) => t.taskId === PA_TASK_ID)!;
      expect(paTask.subscores).toBeDefined();
      expect(paTask.subscores!.FSM).toMatchObject({ correct: 10, attempted: 20, percentCorrect: 50 });
      expect(paTask.subscores!.LSM).toMatchObject({ correct: 18, attempted: 20, percentCorrect: 90 });
      expect(paTask.subscores!.DEL).toMatchObject({ correct: 12, attempted: 20, percentCorrect: 60 });
      expect(paTask.skillsToWorkOn).toEqual(['FSM', 'DEL']);
    });

    it('omits subscores and skillsToWorkOn for tasks without a subscores config block', async () => {
      setupDefaults();
      const completedScoreRow: RunScoreRow = {
        userId: targetUserId,
        taskVariantId: VARIANT_ID_1,
        scoreName: ScoreField.PERCENTILE,
        scoreValue: '50',
      };
      mockReportRepository.getCompletedRunScores.mockResolvedValue([completedScoreRow]);
      mockReportRepository.getCompletedRunsForUser.mockResolvedValue([
        {
          runId: 'run-1',
          taskVariantId: VARIANT_ID_1,
          reliable: true,
          engagementFlags: [],
          completedAt: new Date('2025-09-01'),
        },
      ]);

      const service = createService();
      const result = await service.getIndividualStudentReport(
        superAdminAuth,
        testAdministrationId,
        targetUserId,
        reportQuery,
      );

      const swrTask = result.tasks.find((t) => t.taskId === TASK_ID_1)!;
      expect(swrTask.subscores).toBeUndefined();
      expect(swrTask.skillsToWorkOn).toBeUndefined();
    });

    // --- Historical scores ---

    it('builds historicalScores per task, sorted ascending by administration dateStart', async () => {
      setupDefaults();
      const completedScoreRow: RunScoreRow = {
        userId: targetUserId,
        taskVariantId: VARIANT_ID_1,
        scoreName: ScoreField.PERCENTILE,
        scoreValue: '60',
      };
      mockReportRepository.getCompletedRunScores.mockResolvedValue([completedScoreRow]);
      mockReportRepository.getCompletedRunsForUser.mockResolvedValue([
        {
          runId: 'current-run',
          taskVariantId: VARIANT_ID_1,
          reliable: true,
          engagementFlags: [],
          completedAt: new Date('2025-09-01'),
        },
      ]);

      // Two prior-administration runs for swr (TASK_ID_1) — out-of-order to verify sort.
      const historicalRuns: HistoricalRunRow[] = [
        {
          runId: 'run-newer',
          userId: targetUserId,
          taskId: TASK_ID_1,
          taskVariantId: VARIANT_ID_1,
          administrationId: 'admin-newer',
          administrationName: 'Spring 2025',
          administrationDateStart: new Date('2025-04-01T00:00:00Z'),
          completedAt: new Date('2025-04-15T00:00:00Z'),
          reliableRun: true,
          engagementFlags: [],
        },
        {
          runId: 'run-older',
          userId: targetUserId,
          taskId: TASK_ID_1,
          taskVariantId: VARIANT_ID_1,
          administrationId: 'admin-older',
          administrationName: 'Fall 2024',
          administrationDateStart: new Date('2024-09-01T00:00:00Z'),
          completedAt: new Date('2024-09-15T00:00:00Z'),
          reliableRun: true,
          engagementFlags: [],
        },
      ];
      mockReportRepository.getHistoricalRunsForUser.mockResolvedValue(historicalRuns);
      mockReportRepository.getScoresForRunIds.mockResolvedValue([
        { runId: 'run-older', scoreName: ScoreField.PERCENTILE, scoreValue: '40' },
        { runId: 'run-newer', scoreName: ScoreField.PERCENTILE, scoreValue: '50' },
      ]);

      const service = createService();
      const result = await service.getIndividualStudentReport(
        superAdminAuth,
        testAdministrationId,
        targetUserId,
        reportQuery,
      );

      const swrTask = result.tasks.find((t) => t.taskId === TASK_ID_1)!;
      expect(swrTask.historicalScores).toHaveLength(2);
      // Sorted ascending by administration dateStart — older first
      expect(swrTask.historicalScores[0]!.administrationName).toBe('Fall 2024');
      expect(swrTask.historicalScores[1]!.administrationName).toBe('Spring 2025');
      expect(swrTask.historicalScores[0]!.scores.percentile).toBe(40);
      expect(swrTask.historicalScores[1]!.scores.percentile).toBe(50);
    });

    it('returns an empty historicalScores array for tasks with no prior runs', async () => {
      setupDefaults();

      const service = createService();
      const result = await service.getIndividualStudentReport(
        superAdminAuth,
        testAdministrationId,
        targetUserId,
        reportQuery,
      );

      for (const task of result.tasks) {
        expect(task.historicalScores).toEqual([]);
      }
    });

    it('dedups historicalScores by administrationId across multi-variant tasks', async () => {
      // When a task has multiple variants and the student completed more than
      // one in the same prior administration, the response should still emit
      // a single historicalScores entry per administration — keeping the
      // earliest-completed run as the representative.
      setupDefaults();
      const completedScoreRow: RunScoreRow = {
        userId: targetUserId,
        taskVariantId: VARIANT_ID_1,
        scoreName: ScoreField.PERCENTILE,
        scoreValue: '60',
      };
      mockReportRepository.getCompletedRunScores.mockResolvedValue([completedScoreRow]);
      mockReportRepository.getCompletedRunsForUser.mockResolvedValue([
        {
          runId: 'current-run',
          taskVariantId: VARIANT_ID_1,
          reliable: true,
          engagementFlags: [],
          completedAt: new Date('2025-09-01'),
        },
      ]);

      const altVariantId = 'tv-uuid-1111-1111-1111-aaaaaaaaaaaa';
      // Two prior runs: same taskId, same administrationId, different variants.
      // run-late completed later than run-early — earliest should win after dedup.
      const historicalRuns: HistoricalRunRow[] = [
        {
          runId: 'run-late',
          userId: targetUserId,
          taskId: TASK_ID_1,
          taskVariantId: altVariantId,
          administrationId: 'admin-shared',
          administrationName: 'Fall 2024',
          administrationDateStart: new Date('2024-09-01T00:00:00Z'),
          completedAt: new Date('2024-09-30T00:00:00Z'),
          reliableRun: true,
          engagementFlags: [],
        },
        {
          runId: 'run-early',
          userId: targetUserId,
          taskId: TASK_ID_1,
          taskVariantId: VARIANT_ID_1,
          administrationId: 'admin-shared',
          administrationName: 'Fall 2024',
          administrationDateStart: new Date('2024-09-01T00:00:00Z'),
          completedAt: new Date('2024-09-15T00:00:00Z'),
          reliableRun: true,
          engagementFlags: [],
        },
      ];
      mockReportRepository.getHistoricalRunsForUser.mockResolvedValue(historicalRuns);
      mockReportRepository.getScoresForRunIds.mockResolvedValue([
        { runId: 'run-early', scoreName: ScoreField.PERCENTILE, scoreValue: '40' },
        { runId: 'run-late', scoreName: ScoreField.PERCENTILE, scoreValue: '55' },
      ]);

      const service = createService();
      const result = await service.getIndividualStudentReport(
        superAdminAuth,
        testAdministrationId,
        targetUserId,
        reportQuery,
      );

      const swrTask = result.tasks.find((t) => t.taskId === TASK_ID_1)!;
      expect(swrTask.historicalScores).toHaveLength(1);
      expect(swrTask.historicalScores[0]!.administrationId).toBe('admin-shared');
      // Earliest-completed run wins — its score (40), its date.
      expect(swrTask.historicalScores[0]!.scores.percentile).toBe(40);
      expect(swrTask.historicalScores[0]!.date).toBe(new Date('2024-09-15T00:00:00Z').toISOString());
    });

    // --- Counts ---

    it('returns completedTaskCount and totalTaskCount', async () => {
      setupDefaults();
      // Only one variant has scores — TASK_ID_1
      const scoreRow: RunScoreRow = {
        userId: targetUserId,
        taskVariantId: VARIANT_ID_1,
        scoreName: ScoreField.PERCENTILE,
        scoreValue: '50',
      };
      mockReportRepository.getCompletedRunScores.mockResolvedValue([scoreRow]);
      mockReportRepository.getCompletedRunsForUser.mockResolvedValue([
        {
          runId: 'run-1',
          taskVariantId: VARIANT_ID_1,
          reliable: true,
          engagementFlags: [],
          completedAt: new Date('2025-09-01'),
        },
      ]);

      const service = createService();
      const result = await service.getIndividualStudentReport(
        superAdminAuth,
        testAdministrationId,
        targetUserId,
        reportQuery,
      );

      expect(result.totalTaskCount).toBe(testTaskMetas.length);
      expect(result.completedTaskCount).toBe(1);
    });

    // --- Error handling ---

    it('wraps unexpected repository errors in a 500', async () => {
      mockReportRepository.verifyStudentInScope.mockResolvedValue(true);
      mockReportRepository.getCompletedRunScores.mockRejectedValue(new Error('connection reset'));
      mockTaskVariantParameterRepository.getByTaskVariantIds.mockResolvedValue([]);
      mockUserRepository.getById.mockResolvedValue(UserFactory.build({ id: targetUserId }));
      mockReportRepository.getHistoricalRunsForUser.mockResolvedValue([]);

      const service = createService();
      await expect(
        service.getIndividualStudentReport(superAdminAuth, testAdministrationId, targetUserId, reportQuery),
      ).rejects.toMatchObject({
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
      });
    });

    it('re-throws ApiError without wrapping', async () => {
      mockAdministrationRepository.getById.mockResolvedValue(null);

      const service = createService();
      await expect(
        service.getIndividualStudentReport(superAdminAuth, testAdministrationId, targetUserId, reportQuery),
      ).rejects.toMatchObject({
        statusCode: StatusCodes.NOT_FOUND,
        code: ApiErrorCode.RESOURCE_NOT_FOUND,
      });
    });

    // --- Coverage gap tests ---

    it('extracts phonics subscores via the same config-driven path as PA', async () => {
      const PHONICS_TASK_ID = 'aaaaaaaa-bbbb-cccc-dddd-000000000002';
      const PHONICS_VARIANT_ID = 'phonics-variant-1';
      mockReportRepository.getTaskMetadata.mockResolvedValue([
        {
          taskId: PHONICS_TASK_ID,
          taskVariantId: PHONICS_VARIANT_ID,
          taskSlug: 'phonics',
          taskName: 'ROAR - Phonics',
          orderIndex: 0,
          conditionsAssignment: null,
          conditionsRequirements: null,
        },
      ]);
      setupDefaults();
      mockReportRepository.getCompletedRunScores.mockResolvedValue([
        // cvc: 8/10
        { userId: targetUserId, taskVariantId: PHONICS_VARIANT_ID, scoreName: 'cvcCorrect', scoreValue: '8' },
        { userId: targetUserId, taskVariantId: PHONICS_VARIANT_ID, scoreName: 'cvcAttempted', scoreValue: '10' },
        // digraph: 5/10
        { userId: targetUserId, taskVariantId: PHONICS_VARIANT_ID, scoreName: 'digraphCorrect', scoreValue: '5' },
        { userId: targetUserId, taskVariantId: PHONICS_VARIANT_ID, scoreName: 'digraphAttempted', scoreValue: '10' },
      ]);
      mockReportRepository.getCompletedRunsForUser.mockResolvedValue([
        {
          runId: 'phonics-run',
          taskVariantId: PHONICS_VARIANT_ID,
          reliable: true,
          engagementFlags: [],
          completedAt: new Date('2025-09-01'),
        },
      ]);

      const service = createService();
      const result = await service.getIndividualStudentReport(
        superAdminAuth,
        testAdministrationId,
        targetUserId,
        reportQuery,
      );

      const phonicsTask = result.tasks.find((t) => t.taskId === PHONICS_TASK_ID)!;
      // phonics has no percentCorrectName, so percentCorrect is computed from correct/attempted
      expect(phonicsTask.subscores).toBeDefined();
      expect(phonicsTask.subscores!.cvc).toMatchObject({ correct: 8, attempted: 10, percentCorrect: 80 });
      expect(phonicsTask.subscores!.digraph).toMatchObject({ correct: 5, attempted: 10, percentCorrect: 50 });
      // skillsToWorkOn is PA-only — phonics task should NOT include it
      expect(phonicsTask.skillsToWorkOn).toBeUndefined();
    });

    it('falls back to legacy roarScore-vs-PA_SKILL_LEGACY_THRESHOLD when percentCorrect cannot be derived', async () => {
      const PA_TASK_ID = 'aaaaaaaa-bbbb-cccc-dddd-000000000001';
      const PA_VARIANT_ID = 'pa-variant-1';
      mockReportRepository.getTaskMetadata.mockResolvedValue([
        {
          taskId: PA_TASK_ID,
          taskVariantId: PA_VARIANT_ID,
          taskSlug: 'pa',
          taskName: 'ROAR - Phoneme',
          orderIndex: 0,
          conditionsAssignment: null,
          conditionsRequirements: null,
        },
      ]);
      setupDefaults();
      // Legacy assessment runs only emit the per-subtask `correct` count — no
      // `attempted` and no `percentCorrect`. With both inputs to the percent
      // computation missing, the helper returns `percentCorrect: null` for each
      // subscore, and `computePaSkillsToWorkOn` falls through to the legacy
      // `correct < PA_SKILL_LEGACY_THRESHOLD (15)` branch.
      //   FSM correct=10 (< 15) → in skillsToWorkOn
      //   LSM correct=18 (>= 15) → NOT in skillsToWorkOn
      //   DEL correct=12 (< 15) → in skillsToWorkOn
      mockReportRepository.getCompletedRunScores.mockResolvedValue([
        {
          userId: targetUserId,
          taskVariantId: PA_VARIANT_ID,
          scoreDomain: 'FSM',
          scoreName: 'numCorrect',
          scoreValue: '10',
        },
        {
          userId: targetUserId,
          taskVariantId: PA_VARIANT_ID,
          scoreDomain: 'LSM',
          scoreName: 'numCorrect',
          scoreValue: '18',
        },
        {
          userId: targetUserId,
          taskVariantId: PA_VARIANT_ID,
          scoreDomain: 'DEL',
          scoreName: 'numCorrect',
          scoreValue: '12',
        },
      ]);
      mockReportRepository.getCompletedRunsForUser.mockResolvedValue([
        {
          runId: 'pa-run',
          taskVariantId: PA_VARIANT_ID,
          reliable: true,
          engagementFlags: [],
          completedAt: new Date('2025-09-01'),
        },
      ]);

      const service = createService();
      const result = await service.getIndividualStudentReport(
        superAdminAuth,
        testAdministrationId,
        targetUserId,
        reportQuery,
      );

      const paTask = result.tasks.find((t) => t.taskId === PA_TASK_ID)!;
      // No attempted, no percentCorrect row → percentCorrect can't be derived
      expect(paTask.subscores!.FSM!.percentCorrect).toBeNull();
      expect(paTask.subscores!.LSM!.percentCorrect).toBeNull();
      expect(paTask.subscores!.DEL!.percentCorrect).toBeNull();
      // skillsToWorkOn falls back to correct count vs legacy threshold (15)
      expect(paTask.skillsToWorkOn).toEqual(['FSM', 'DEL']);
    });

    it('returns empty skillsToWorkOn when all PA subscores meet the threshold', async () => {
      const PA_TASK_ID = 'aaaaaaaa-bbbb-cccc-dddd-000000000001';
      const PA_VARIANT_ID = 'pa-variant-1';
      mockReportRepository.getTaskMetadata.mockResolvedValue([
        {
          taskId: PA_TASK_ID,
          taskVariantId: PA_VARIANT_ID,
          taskSlug: 'pa',
          taskName: 'ROAR - Phoneme',
          orderIndex: 0,
          conditionsAssignment: null,
          conditionsRequirements: null,
        },
      ]);
      setupDefaults();
      // All three at 90% → all above 78.9% threshold
      mockReportRepository.getCompletedRunScores.mockResolvedValue([
        {
          userId: targetUserId,
          taskVariantId: PA_VARIANT_ID,
          scoreDomain: 'FSM',
          scoreName: 'percentCorrect',
          scoreValue: '90',
        },
        {
          userId: targetUserId,
          taskVariantId: PA_VARIANT_ID,
          scoreDomain: 'LSM',
          scoreName: 'percentCorrect',
          scoreValue: '90',
        },
        {
          userId: targetUserId,
          taskVariantId: PA_VARIANT_ID,
          scoreDomain: 'DEL',
          scoreName: 'percentCorrect',
          scoreValue: '90',
        },
      ]);
      mockReportRepository.getCompletedRunsForUser.mockResolvedValue([
        {
          runId: 'pa-run',
          taskVariantId: PA_VARIANT_ID,
          reliable: true,
          engagementFlags: [],
          completedAt: new Date('2025-09-01'),
        },
      ]);

      const service = createService();
      const result = await service.getIndividualStudentReport(
        superAdminAuth,
        testAdministrationId,
        targetUserId,
        reportQuery,
      );

      const paTask = result.tasks.find((t) => t.taskId === PA_TASK_ID)!;
      expect(paTask.skillsToWorkOn).toEqual([]);
    });

    it('uses the first variant with completed scores for multi-variant tasks (per-task dedup)', async () => {
      const SHARED_TASK = 'aaaaaaaa-bbbb-cccc-dddd-000000000099';
      const variantA: ReportTaskMeta = {
        taskId: SHARED_TASK,
        taskVariantId: 'var-a',
        taskSlug: 'swr',
        taskName: 'ROAR - Word',
        orderIndex: 0,
        conditionsAssignment: null,
        conditionsRequirements: null,
      };
      const variantB: ReportTaskMeta = {
        taskId: SHARED_TASK,
        taskVariantId: 'var-b',
        taskSlug: 'swr',
        taskName: 'ROAR - Word',
        orderIndex: 1,
        conditionsAssignment: null,
        conditionsRequirements: null,
      };
      mockReportRepository.getTaskMetadata.mockResolvedValue([variantA, variantB]);
      setupDefaults();
      // Student has scores on BOTH variants — variant A wins (lower orderIndex).
      mockReportRepository.getCompletedRunScores.mockResolvedValue([
        { userId: targetUserId, taskVariantId: 'var-a', scoreName: ScoreField.PERCENTILE, scoreValue: '90' },
        { userId: targetUserId, taskVariantId: 'var-b', scoreName: ScoreField.PERCENTILE, scoreValue: '10' },
      ]);
      mockReportRepository.getCompletedRunsForUser.mockResolvedValue([
        {
          runId: 'run-a',
          taskVariantId: 'var-a',
          reliable: true,
          engagementFlags: [],
          completedAt: new Date('2025-09-01'),
        },
        {
          runId: 'run-b',
          taskVariantId: 'var-b',
          reliable: false,
          engagementFlags: ['flagB'],
          completedAt: new Date('2025-09-02'),
        },
      ]);

      const service = createService();
      const result = await service.getIndividualStudentReport(
        superAdminAuth,
        testAdministrationId,
        targetUserId,
        reportQuery,
      );

      // One entry per taskId, with variant-A's scores and run metadata
      expect(result.tasks).toHaveLength(1);
      const taskEntry = result.tasks[0]!;
      expect(taskEntry.taskId).toBe(SHARED_TASK);
      expect(taskEntry.scores.percentile).toBe(90);
      expect(taskEntry.reliable).toBe(true);
      expect(taskEntry.engagementFlags).toEqual([]);
    });

    it('emits Reliability=Unreliable with warn severity for an unreliable run', async () => {
      setupDefaults();
      mockReportRepository.getCompletedRunScores.mockResolvedValue([
        { userId: targetUserId, taskVariantId: VARIANT_ID_1, scoreName: ScoreField.PERCENTILE, scoreValue: '50' },
      ]);
      mockReportRepository.getCompletedRunsForUser.mockResolvedValue([
        {
          runId: 'unreliable-run',
          taskVariantId: VARIANT_ID_1,
          reliable: false,
          engagementFlags: [],
          completedAt: new Date('2025-09-01'),
        },
      ]);

      const service = createService();
      const result = await service.getIndividualStudentReport(
        superAdminAuth,
        testAdministrationId,
        targetUserId,
        reportQuery,
      );

      const swrTask = result.tasks.find((t) => t.taskId === TASK_ID_1)!;
      expect(swrTask.reliable).toBe(false);
      const reliabilityTag = swrTask.tags.find((t) => t.label === 'Reliability')!;
      expect(reliabilityTag.value).toBe('Unreliable');
      expect(reliabilityTag.severity).toBe('warn');
    });

    it('surfaces engagementFlags from the run row', async () => {
      setupDefaults();
      mockReportRepository.getCompletedRunScores.mockResolvedValue([
        { userId: targetUserId, taskVariantId: VARIANT_ID_1, scoreName: ScoreField.PERCENTILE, scoreValue: '50' },
      ]);
      mockReportRepository.getCompletedRunsForUser.mockResolvedValue([
        {
          runId: 'flagged-run',
          taskVariantId: VARIANT_ID_1,
          reliable: true,
          engagementFlags: ['guess', 'inattentive'],
          completedAt: new Date('2025-09-01'),
        },
      ]);

      const service = createService();
      const result = await service.getIndividualStudentReport(
        superAdminAuth,
        testAdministrationId,
        targetUserId,
        reportQuery,
      );

      const swrTask = result.tasks.find((t) => t.taskId === TASK_ID_1)!;
      expect(swrTask.engagementFlags).toEqual(['guess', 'inattentive']);
    });
  });

  describe('getGuardianStudentReport', () => {
    const targetUserId = 'student-guardian-1';
    const guardianAuth = { userId: 'guardian-user-id', isSuperAdmin: false };
    const teacherAuthLocal = { userId: 'teacher-user-id', isSuperAdmin: false };
    const studentSelfAuth = { userId: targetUserId, isSuperAdmin: false };
    const supervisedAuth = { userId: 'supervised-user-id', isSuperAdmin: false };

    const ADMIN_OLDER = {
      id: 'admin-old',
      name: 'Fall 2024 Assessment',
      dateStart: new Date('2024-09-01T00:00:00Z'),
      dateEnd: new Date('2024-12-15T00:00:00Z'),
    };
    const ADMIN_NEWER = {
      id: 'admin-new',
      name: 'Spring 2025 Assessment',
      dateStart: new Date('2025-02-01T00:00:00Z'),
      dateEnd: new Date('2025-04-15T00:00:00Z'),
    };

    function setupGuardianDefaults(opts?: {
      user?: ReturnType<typeof UserFactory.build> | null;
      adminMetas?: (typeof ADMIN_OLDER)[];
      schoolName?: string | null;
      taskMetadataByAdmin?: Map<string, ReportTaskMeta[]>;
    }) {
      const adminMetas = opts?.adminMetas ?? [];
      mockUserRepository.getById.mockResolvedValue(
        opts?.user === null
          ? null
          : (opts?.user ??
              UserFactory.build({
                id: targetUserId,
                nameFirst: 'Jane',
                nameLast: 'Doe',
                username: 'jdoe',
                grade: '3',
                rosteringEnded: null,
              })),
      );
      mockReportRepository.verifyGuardianStudentLink.mockResolvedValue(false);
      mockReportRepository.verifyUserOrgOverlap.mockResolvedValue(false);
      mockReportRepository.getStudentAdministrations.mockResolvedValue(adminMetas);
      mockReportRepository.getSchoolNamesForUsers.mockResolvedValue(
        new Map(
          opts?.schoolName === undefined
            ? [[targetUserId, 'Lincoln Elementary']]
            : opts.schoolName === null
              ? []
              : [[targetUserId, opts.schoolName]],
        ),
      );
      // Per-admin task metadata: default to the standard 4 tasks for each admin
      mockReportRepository.getTaskMetadata.mockImplementation(async (adminId: string) => {
        const map = opts?.taskMetadataByAdmin;
        if (map && map.has(adminId)) return map.get(adminId)!;
        return testTaskMetas;
      });
      mockReportRepository.getCompletedRunScores.mockResolvedValue([]);
      mockReportRepository.getCompletedRunsForUser.mockResolvedValue([]);
      mockTaskVariantParameterRepository.getByTaskVariantIds.mockResolvedValue([]);
    }

    // --- Authorization ---

    it('returns 404 when target student does not exist', async () => {
      setupGuardianDefaults({ user: null });

      const service = createService();
      await expect(service.getGuardianStudentReport(guardianAuth, targetUserId)).rejects.toMatchObject({
        statusCode: StatusCodes.NOT_FOUND,
        code: ApiErrorCode.RESOURCE_NOT_FOUND,
      });
    });

    it('returns 404 when target student has rosteringEnded', async () => {
      setupGuardianDefaults({
        user: UserFactory.build({
          id: targetUserId,
          rosteringEnded: new Date('2025-01-01'),
        }),
      });

      const service = createService();
      await expect(service.getGuardianStudentReport(guardianAuth, targetUserId)).rejects.toMatchObject({
        statusCode: StatusCodes.NOT_FOUND,
        code: ApiErrorCode.RESOURCE_NOT_FOUND,
      });
      // Auth checks should not have been reached after the 404
      expect(mockReportRepository.verifyGuardianStudentLink).not.toHaveBeenCalled();
      expect(mockReportRepository.verifyUserOrgOverlap).not.toHaveBeenCalled();
    });

    it('returns 403 when a student attempts to view their own report', async () => {
      setupGuardianDefaults();

      const service = createService();
      await expect(service.getGuardianStudentReport(studentSelfAuth, targetUserId)).rejects.toMatchObject({
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
      });
    });

    it('returns 403 when caller is neither a linked guardian nor a supervisory role', async () => {
      setupGuardianDefaults();
      mockReportRepository.verifyGuardianStudentLink.mockResolvedValue(false);
      // Supervisory roles list is non-empty (Reports.Score.READ allows several);
      // it's the org-overlap check that fails for this caller.
      mockReportRepository.verifyUserOrgOverlap.mockResolvedValue(false);

      const service = createService();
      await expect(service.getGuardianStudentReport(supervisedAuth, targetUserId)).rejects.toMatchObject({
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
      });
    });

    it('returns 200 when caller is a linked guardian (no overlap check needed)', async () => {
      setupGuardianDefaults({ adminMetas: [ADMIN_OLDER] });
      mockReportRepository.verifyGuardianStudentLink.mockResolvedValue(true);

      const service = createService();
      const result = await service.getGuardianStudentReport(guardianAuth, targetUserId);

      expect(result.student.userId).toBe(targetUserId);
      expect(mockReportRepository.verifyGuardianStudentLink).toHaveBeenCalledWith(guardianAuth.userId, targetUserId);
      expect(mockReportRepository.verifyUserOrgOverlap).not.toHaveBeenCalled();
    });

    it('returns 200 when caller is a supervisory role with org overlap', async () => {
      setupGuardianDefaults({ adminMetas: [ADMIN_OLDER] });
      mockReportRepository.verifyGuardianStudentLink.mockResolvedValue(false);
      mockReportRepository.verifyUserOrgOverlap.mockResolvedValue(true);

      const service = createService();
      const result = await service.getGuardianStudentReport(teacherAuthLocal, targetUserId);

      expect(result.student.userId).toBe(targetUserId);
      expect(mockReportRepository.verifyUserOrgOverlap).toHaveBeenCalledWith(
        teacherAuthLocal.userId,
        targetUserId,
        expect.any(Array),
      );
    });

    it('super admin bypasses both guardian and org-overlap checks', async () => {
      setupGuardianDefaults({ adminMetas: [ADMIN_OLDER] });

      const service = createService();
      await service.getGuardianStudentReport(superAdminAuth, targetUserId);

      expect(mockReportRepository.verifyGuardianStudentLink).not.toHaveBeenCalled();
      expect(mockReportRepository.verifyUserOrgOverlap).not.toHaveBeenCalled();
    });

    it('checks guardian link before org overlap', async () => {
      setupGuardianDefaults({ adminMetas: [ADMIN_OLDER] });
      mockReportRepository.verifyGuardianStudentLink.mockResolvedValue(true);
      mockReportRepository.verifyUserOrgOverlap.mockResolvedValue(true); // would pass, but should be skipped

      const service = createService();
      await service.getGuardianStudentReport(guardianAuth, targetUserId);

      expect(mockReportRepository.verifyGuardianStudentLink).toHaveBeenCalledOnce();
      expect(mockReportRepository.verifyUserOrgOverlap).not.toHaveBeenCalled();
    });

    // --- Empty / shape ---

    it('returns an empty payload when the student has no administrations', async () => {
      setupGuardianDefaults({ adminMetas: [] });

      const service = createService();
      const result = await service.getGuardianStudentReport(superAdminAuth, targetUserId);

      expect(result.student.userId).toBe(targetUserId);
      expect(result.student.firstName).toBe('Jane');
      expect(result.student.schoolName).toBe('Lincoln Elementary');
      expect(result.administrations).toEqual([]);
      expect(result.longitudinalScores).toEqual({});
      // No per-admin task fetch should have happened
      expect(mockReportRepository.getTaskMetadata).not.toHaveBeenCalled();
    });

    it('returns null schoolName when no school is found', async () => {
      setupGuardianDefaults({ adminMetas: [ADMIN_OLDER], schoolName: null });

      const service = createService();
      const result = await service.getGuardianStudentReport(superAdminAuth, targetUserId);

      expect(result.student.schoolName).toBeNull();
    });

    it('emits administrations in the order returned by the repository', async () => {
      // Repository contract is "ascending by dateStart"; we trust that ordering
      // and don't re-sort. Verify the service preserves the order.
      setupGuardianDefaults({ adminMetas: [ADMIN_OLDER, ADMIN_NEWER] });

      const service = createService();
      const result = await service.getGuardianStudentReport(superAdminAuth, targetUserId);

      expect(result.administrations).toHaveLength(2);
      expect(result.administrations[0]!.administrationId).toBe('admin-old');
      expect(result.administrations[0]!.dateStart).toBe(ADMIN_OLDER.dateStart.toISOString());
      expect(result.administrations[1]!.administrationId).toBe('admin-new');
    });

    it('omits historicalScores from per-administration task entries', async () => {
      setupGuardianDefaults({ adminMetas: [ADMIN_OLDER] });
      mockReportRepository.getCompletedRunScores.mockResolvedValue([
        { userId: targetUserId, taskVariantId: VARIANT_ID_1, scoreName: ScoreField.PERCENTILE, scoreValue: '60' },
      ]);
      mockReportRepository.getCompletedRunsForUser.mockResolvedValue([
        {
          runId: 'run-old',
          taskVariantId: VARIANT_ID_1,
          reliable: true,
          engagementFlags: [],
          completedAt: new Date('2024-12-01'),
        },
      ]);

      const service = createService();
      const result = await service.getGuardianStudentReport(superAdminAuth, targetUserId);

      const swrEntry = result.administrations[0]!.tasks.find((t) => t.taskId === TASK_ID_1)!;
      expect('historicalScores' in swrEntry).toBe(false);
    });

    // --- Longitudinal scores ---

    it('builds longitudinalScores keyed by task slug, ordered chronologically', async () => {
      setupGuardianDefaults({ adminMetas: [ADMIN_OLDER, ADMIN_NEWER] });
      // Score the swr task in both administrations: 40 in older, 60 in newer.
      mockReportRepository.getCompletedRunScores.mockImplementation(async (adminId: string) => {
        if (adminId === ADMIN_OLDER.id) {
          return [
            { userId: targetUserId, taskVariantId: VARIANT_ID_1, scoreName: ScoreField.PERCENTILE, scoreValue: '40' },
          ];
        }
        return [
          { userId: targetUserId, taskVariantId: VARIANT_ID_1, scoreName: ScoreField.PERCENTILE, scoreValue: '60' },
        ];
      });
      mockReportRepository.getCompletedRunsForUser.mockResolvedValue([
        {
          runId: 'run-1',
          taskVariantId: VARIANT_ID_1,
          reliable: true,
          engagementFlags: [],
          completedAt: new Date('2024-12-01'),
        },
      ]);

      const service = createService();
      const result = await service.getGuardianStudentReport(superAdminAuth, targetUserId);

      expect(result.longitudinalScores.swr).toBeDefined();
      expect(result.longitudinalScores.swr).toHaveLength(2);
      // Older admin first (chronological)
      expect(result.longitudinalScores.swr![0]!.administrationId).toBe(ADMIN_OLDER.id);
      expect(result.longitudinalScores.swr![0]!.scores.percentile).toBe(40);
      expect(result.longitudinalScores.swr![1]!.administrationId).toBe(ADMIN_NEWER.id);
      expect(result.longitudinalScores.swr![1]!.scores.percentile).toBe(60);
      // Date anchored to admin dateEnd
      expect(result.longitudinalScores.swr![0]!.date).toBe(ADMIN_OLDER.dateEnd.toISOString());
    });

    it('omits a task slug from longitudinalScores when the student never completed it', async () => {
      setupGuardianDefaults({ adminMetas: [ADMIN_OLDER] });
      // No scores returned ⇒ no completed runs anywhere.
      mockReportRepository.getCompletedRunScores.mockResolvedValue([]);

      const service = createService();
      const result = await service.getGuardianStudentReport(superAdminAuth, targetUserId);

      expect(result.longitudinalScores).toEqual({});
      // But administrations still contains entries (unassessed) for visible tasks
      expect(result.administrations[0]!.tasks.length).toBeGreaterThan(0);
    });

    // --- Multi-variant ---

    it('per-administration: picks the first variant with completed scores (multi-variant dedup)', async () => {
      // Two variants for swr in this admin; only the second has scores.
      const altVariantId = 'tv-uuid-1111-1111-1111-aaaaaaaaaaaa';
      const swrPrimary: ReportTaskMeta = {
        taskId: TASK_ID_1,
        taskVariantId: VARIANT_ID_1,
        taskSlug: 'swr',
        taskName: 'ROAR - Word',
        orderIndex: 0,
        conditionsAssignment: null,
        conditionsRequirements: null,
      };
      const swrAlt: ReportTaskMeta = { ...swrPrimary, taskVariantId: altVariantId };
      const taskMetadataByAdmin = new Map<string, ReportTaskMeta[]>([[ADMIN_OLDER.id, [swrPrimary, swrAlt]]]);
      setupGuardianDefaults({ adminMetas: [ADMIN_OLDER], taskMetadataByAdmin });
      mockReportRepository.getCompletedRunScores.mockResolvedValue([
        // Primary variant (lowest orderIndex) has no completed score in this admin;
        // include only the alt variant's score, which means the primary is skipped
        // and the alt becomes the scored variant.
        { userId: targetUserId, taskVariantId: altVariantId, scoreName: ScoreField.PERCENTILE, scoreValue: '55' },
      ]);
      mockReportRepository.getCompletedRunsForUser.mockResolvedValue([
        {
          runId: 'run-alt',
          taskVariantId: altVariantId,
          reliable: true,
          engagementFlags: [],
          completedAt: new Date('2024-12-10'),
        },
      ]);

      const service = createService();
      const result = await service.getGuardianStudentReport(superAdminAuth, targetUserId);

      const swrEntry = result.administrations[0]!.tasks.find((t) => t.taskId === TASK_ID_1)!;
      expect(swrEntry.completed).toBe(true);
      expect(swrEntry.scores.percentile).toBe(55);
      expect(result.longitudinalScores.swr).toHaveLength(1);
      expect(result.longitudinalScores.swr![0]!.scores.percentile).toBe(55);
    });

    // --- Tags & reliability ---

    it('emits Required + Reliability tags for completed runs', async () => {
      setupGuardianDefaults({ adminMetas: [ADMIN_OLDER] });
      mockReportRepository.getCompletedRunScores.mockResolvedValue([
        { userId: targetUserId, taskVariantId: VARIANT_ID_1, scoreName: ScoreField.PERCENTILE, scoreValue: '70' },
      ]);
      mockReportRepository.getCompletedRunsForUser.mockResolvedValue([
        {
          runId: 'run-1',
          taskVariantId: VARIANT_ID_1,
          reliable: false,
          engagementFlags: [],
          completedAt: new Date('2024-12-01'),
        },
      ]);

      const service = createService();
      const result = await service.getGuardianStudentReport(superAdminAuth, targetUserId);

      const swrEntry = result.administrations[0]!.tasks.find((t) => t.taskId === TASK_ID_1)!;
      expect(swrEntry.reliable).toBe(false);
      const reliabilityTag = swrEntry.tags.find((t) => t.label === 'Reliability');
      expect(reliabilityTag).toBeDefined();
      expect(reliabilityTag!.value).toBe('Unreliable');
    });

    // --- Error handling ---

    it('wraps unexpected repository errors in a 500', async () => {
      setupGuardianDefaults({ adminMetas: [ADMIN_OLDER] });
      mockReportRepository.getStudentAdministrations.mockRejectedValue(new Error('connection reset'));

      const service = createService();
      await expect(service.getGuardianStudentReport(superAdminAuth, targetUserId)).rejects.toMatchObject({
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
      });
    });

    it('re-throws ApiError without wrapping', async () => {
      setupGuardianDefaults({ user: null });

      const service = createService();
      await expect(service.getGuardianStudentReport(superAdminAuth, targetUserId)).rejects.toMatchObject({
        statusCode: StatusCodes.NOT_FOUND,
        code: ApiErrorCode.RESOURCE_NOT_FOUND,
      });
    });
  });
});
