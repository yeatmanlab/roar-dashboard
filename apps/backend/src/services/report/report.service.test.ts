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
  StudentScoresInput,
  IndividualStudentReportInput,
  TaskSubscoresInput,
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
        testTaskMetas.map((t) => t.taskVariantId),
        expect.objectContaining({ page: 1, perPage: 25, sortDirection: 'asc' }),
        undefined,
        undefined, // no progress status sort
        undefined, // no progress status filters
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
        testTaskMetas.map((t) => t.taskVariantId),
        expect.objectContaining({ page: 1, perPage: 25, sortDirection: 'asc' }),
        expect.anything(), // filter condition SQL object
        undefined, // no progress status sort
        undefined, // no progress status filters
      );

      // Verify sortColumn is defined (mapped from 'user.firstName')
      const callArgs = mockReportRepository.getProgressStudents.mock.calls[0]!;
      expect(callArgs[3]!.sortColumn).toBeDefined();
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
      // arg[5] is progressStatusSort
      expect(callArgs[5]).toEqual(expect.objectContaining({ taskVariantId: VARIANT_ID_1 }));
      // arg[4] should be undefined (no user-level filter)
      expect(callArgs[4]).toBeUndefined();
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
      // arg[6] is progressStatusFilters
      expect(callArgs[6]).toEqual([
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
      expect(callArgs[6]).toEqual([
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
      // arg[6] is progressStatusFilters
      expect(callArgs[6]).toHaveLength(3);
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
        testTaskMetas,
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
        buildScoreRow('student-1', VARIANT_ID_1, 'percentile', '90'),
        buildScoreRow('student-2', VARIANT_ID_1, 'percentile', '50'),
        buildScoreRow('student-3', VARIANT_ID_1, 'percentile', '10'),
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
      const scoreRows = [buildScoreRow('student-1', VARIANT_ID_1, 'percentile', '50')];

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
      const scoreRows = [buildScoreRow('student-1', 'var-a', 'percentile', '50')];

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
        buildScoreRow('student-1', 'var-a', 'percentile', '90'),
        buildScoreRow('student-1', 'var-b', 'percentile', '10'),
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
      const scoreRows = [buildScoreRow('student-1', VARIANT_ID_1, 'percentile', '50')];

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
      const scoreRows = [buildScoreRow('student-1', VARIANT_ID_1, 'percentile', '50')];

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
        expect.anything(),
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

    // --- Empty-result short-circuit when taskId filter excludes all tasks ---

    it('returns empty tasks array when taskId filter excludes every task', async () => {
      // Filter targets a UUID not present in testTaskMetas — taskMetas becomes []
      // and taskGroups.length === 0 triggers the short-circuit. Because the short-circuit
      // is evaluated BEFORE the student-fetch DB call, getAllStudentsInScope is also skipped
      // and the response carries totalStudents: 0 by definition (no tasks → no aggregation).
      const students = [buildOverviewStudent({ userId: 'student-1' })];
      setupDefaultScoreOverviewMocks(students, []);

      const filteredQuery: ScoreOverviewInput = {
        ...scoreQuery,
        filter: [{ field: 'taskId', operator: 'in', value: '00000000-0000-0000-0000-000000000000' }],
      };

      const service = createService();
      const result = await service.getScoreOverview(superAdminAuth, testAdministrationId, filteredQuery);

      expect(result.tasks).toHaveLength(0);
      expect(result.totalStudents).toBe(0);
      expect(typeof result.computedAt).toBe('string');
      // Short-circuit means we don't touch the student-fetch path or downstream queries
      expect(mockReportRepository.getAllStudentsInScope).not.toHaveBeenCalled();
      expect(mockTaskVariantParameterRepository.getByTaskVariantIds).not.toHaveBeenCalled();
      expect(mockReportRepository.getCompletedRunScores).not.toHaveBeenCalled();
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
      const scoreRows = [buildScoreRow('student-1', VARIANT_ID_1, 'percentile', '45')];

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
      const scoreRows = [buildScoreRow('student-1', VARIANT_ID_1, 'percentile', '45')];

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
      const scoreRows = [buildScoreRow('student-1', VARIANT_ID_1, 'percentile', '45')];

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
      const scoreRows = [buildScoreRow('student-1', ROAM_VARIANT, 'supportLevel', 'achievedSkill')];

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
      const scoreRows = [buildScoreRow('student-1', VARIANT_ID_1, 'percentile', '>99')];

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
      // (e.g., 'percentile', 'wjPercentile', 'roarScore'). getSupportLevel
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
      const sortField = callArgs[5];
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

      const taskMetasArg = mockReportRepository.getStudentScores.mock.calls[0]![2];
      const seenIds = new Set(taskMetasArg.map((t) => t.taskId));
      expect(seenIds).toEqual(new Set([TASK_ID_1, TASK_ID_3]));
    });

    it('returns an empty page when taskId filter excludes every task', async () => {
      // Filter targets a UUID not present in testTaskMetas — taskMetas becomes []
      // and the empty-task short-circuit returns immediately. No pagination query
      // is run; totalItems is 0 by definition because no per-task entries can be
      // assembled when no tasks are in scope.
      setupDefaultStudentScoresMocks();

      const filteredQuery: StudentScoresInput = {
        ...baseQuery,
        filter: [{ field: 'taskId', operator: 'in', value: '00000000-0000-0000-0000-000000000000' }],
      };

      const service = createService();
      const result = await service.listStudentScores(superAdminAuth, testAdministrationId, filteredQuery);

      expect(result.tasks).toEqual([]);
      expect(result.items).toEqual([]);
      expect(result.totalItems).toBe(0);
      // Short-circuit means we don't touch the paginated row fetch or downstream queries
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

      const fieldFilters = mockReportRepository.getStudentScores.mock.calls[0]![6];
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

      const fieldFilters = mockReportRepository.getStudentScores.mock.calls[0]![6];
      expect(fieldFilters![0]!.values).toEqual(['3', '2']);
    });

    it('drops supportLevel:eq:optional from SQL filters (post-fetch only)', async () => {
      setupDefaultStudentScoresMocks();

      const service = createService();
      await service.listStudentScores(superAdminAuth, testAdministrationId, {
        ...baseQuery,
        filter: [{ field: `scores.${TASK_ID_1}.supportLevel`, operator: 'eq', value: 'optional' }],
      });

      const fieldFilters = mockReportRepository.getStudentScores.mock.calls[0]![6];
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

      const fieldFilters = mockReportRepository.getStudentScores.mock.calls[0]![6];
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
        scores: new Map([[VARIANT_ID_1, new Map([['percentile', '90']])]]),
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
              ['percentile', '90.7'],
              ['roarScore', '512.4'],
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
          ['var-a', new Map([['percentile', '90']])],
          ['var-b', new Map([['percentile', '10']])],
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
        scoreName: 'percentile',
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
        { userId: targetUserId, taskVariantId: PA_VARIANT_ID, scoreName: 'fsmCorrect', scoreValue: '10' },
        { userId: targetUserId, taskVariantId: PA_VARIANT_ID, scoreName: 'fsmAttempted', scoreValue: '20' },
        { userId: targetUserId, taskVariantId: PA_VARIANT_ID, scoreName: 'fsmPercentCorrect', scoreValue: '50' },
        // LSM at 90% (above threshold)
        { userId: targetUserId, taskVariantId: PA_VARIANT_ID, scoreName: 'lsmCorrect', scoreValue: '18' },
        { userId: targetUserId, taskVariantId: PA_VARIANT_ID, scoreName: 'lsmAttempted', scoreValue: '20' },
        { userId: targetUserId, taskVariantId: PA_VARIANT_ID, scoreName: 'lsmPercentCorrect', scoreValue: '90' },
        // DEL at 60% (below threshold)
        { userId: targetUserId, taskVariantId: PA_VARIANT_ID, scoreName: 'delCorrect', scoreValue: '12' },
        { userId: targetUserId, taskVariantId: PA_VARIANT_ID, scoreName: 'delAttempted', scoreValue: '20' },
        { userId: targetUserId, taskVariantId: PA_VARIANT_ID, scoreName: 'delPercentCorrect', scoreValue: '60' },
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
        scoreName: 'percentile',
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
        scoreName: 'percentile',
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
        { runId: 'run-older', scoreName: 'percentile', scoreValue: '40' },
        { runId: 'run-newer', scoreName: 'percentile', scoreValue: '50' },
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
        scoreName: 'percentile',
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
        { runId: 'run-early', scoreName: 'percentile', scoreValue: '40' },
        { runId: 'run-late', scoreName: 'percentile', scoreValue: '55' },
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
        scoreName: 'percentile',
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
        { userId: targetUserId, taskVariantId: PA_VARIANT_ID, scoreName: 'fsmCorrect', scoreValue: '10' },
        { userId: targetUserId, taskVariantId: PA_VARIANT_ID, scoreName: 'lsmCorrect', scoreValue: '18' },
        { userId: targetUserId, taskVariantId: PA_VARIANT_ID, scoreName: 'delCorrect', scoreValue: '12' },
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
        { userId: targetUserId, taskVariantId: PA_VARIANT_ID, scoreName: 'fsmPercentCorrect', scoreValue: '90' },
        { userId: targetUserId, taskVariantId: PA_VARIANT_ID, scoreName: 'lsmPercentCorrect', scoreValue: '90' },
        { userId: targetUserId, taskVariantId: PA_VARIANT_ID, scoreName: 'delPercentCorrect', scoreValue: '90' },
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
        { userId: targetUserId, taskVariantId: 'var-a', scoreName: 'percentile', scoreValue: '90' },
        { userId: targetUserId, taskVariantId: 'var-b', scoreName: 'percentile', scoreValue: '10' },
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
        { userId: targetUserId, taskVariantId: VARIANT_ID_1, scoreName: 'percentile', scoreValue: '50' },
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
        { userId: targetUserId, taskVariantId: VARIANT_ID_1, scoreName: 'percentile', scoreValue: '50' },
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
        { userId: targetUserId, taskVariantId: VARIANT_ID_1, scoreName: 'percentile', scoreValue: '60' },
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
          return [{ userId: targetUserId, taskVariantId: VARIANT_ID_1, scoreName: 'percentile', scoreValue: '40' }];
        }
        return [{ userId: targetUserId, taskVariantId: VARIANT_ID_1, scoreName: 'percentile', scoreValue: '60' }];
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
        { userId: targetUserId, taskVariantId: altVariantId, scoreName: 'percentile', scoreValue: '55' },
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
        { userId: targetUserId, taskVariantId: VARIANT_ID_1, scoreName: 'percentile', scoreValue: '70' },
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

  describe('listTaskSubscores', () => {
    // Phonics task as the canonical exercise — registry-verified columns and
    // numeric sort/filter capabilities. Uses TASK_ID_3 / VARIANT_ID_3 from the
    // outer describe's testTaskMetas so we can reuse the same mock factories.
    const PHONICS_TASK_ID = 'aaaaaaaa-bbbb-cccc-dddd-000000000003';
    const PHONICS_VARIANT_ID = 'phonics-variant-1';
    const PA_TASK_ID = 'aaaaaaaa-bbbb-cccc-dddd-000000000004';
    const PA_VARIANT_ID = 'pa-variant-1';
    const SWR_TASK_ID = 'aaaaaaaa-bbbb-cccc-dddd-000000000005';
    const SWR_VARIANT_ID = 'swr-variant-1';

    function phonicsTaskMeta(): ReportTaskMeta {
      return {
        taskId: PHONICS_TASK_ID,
        taskVariantId: PHONICS_VARIANT_ID,
        taskSlug: 'phonics',
        taskName: 'ROAR - Phonics',
        orderIndex: 0,
        conditionsAssignment: null,
        conditionsRequirements: null,
      };
    }
    function paTaskMeta(): ReportTaskMeta {
      return {
        taskId: PA_TASK_ID,
        taskVariantId: PA_VARIANT_ID,
        taskSlug: 'pa',
        taskName: 'ROAR - Phonological Awareness',
        orderIndex: 0,
        conditionsAssignment: null,
        conditionsRequirements: null,
      };
    }
    function swrTaskMeta(): ReportTaskMeta {
      return {
        taskId: SWR_TASK_ID,
        taskVariantId: SWR_VARIANT_ID,
        taskSlug: 'swr',
        taskName: 'ROAR - Word',
        orderIndex: 0,
        conditionsAssignment: null,
        conditionsRequirements: null,
      };
    }

    function defaultQuery(overrides?: Partial<TaskSubscoresInput>): TaskSubscoresInput {
      return {
        scopeType: 'district',
        scopeId: 'district-uuid-1',
        page: 1,
        perPage: 25,
        sortBy: 'user.lastName',
        sortOrder: 'asc',
        filter: [],
        ...overrides,
      };
    }

    function setupRepoDefaults(opts?: { taskMeta?: ReportTaskMeta; pageItems?: any[]; totalItems?: number }) {
      mockReportRepository.getTaskMetadata.mockResolvedValue([opts?.taskMeta ?? phonicsTaskMeta()]);
      mockTaskVariantParameterRepository.getByTaskVariantIds.mockResolvedValue([]);
      mockReportRepository.getTaskSubscoreStudents.mockResolvedValue({
        items: opts?.pageItems ?? [],
        totalItems: opts?.totalItems ?? 0,
      });
      mockReportRepository.getSchoolNamesForUsers.mockResolvedValue(new Map());
    }

    // --- Authorization ---

    it('returns 404 when administration does not exist', async () => {
      mockAdministrationRepository.getById.mockResolvedValue(null);

      const service = createService();
      await expect(
        service.listTaskSubscores(teacherAuth, testAdministrationId, PHONICS_TASK_ID, defaultQuery()),
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
        service.listTaskSubscores(teacherAuth, testAdministrationId, PHONICS_TASK_ID, defaultQuery()),
      ).rejects.toMatchObject({ statusCode: StatusCodes.FORBIDDEN });
    });

    it('returns 400 when scope is not assigned to administration', async () => {
      mockReportRepository.isScopeAssignedToAdministration.mockResolvedValue(false);

      const service = createService();
      await expect(
        service.listTaskSubscores(teacherAuth, testAdministrationId, PHONICS_TASK_ID, defaultQuery()),
      ).rejects.toMatchObject({
        statusCode: StatusCodes.BAD_REQUEST,
        code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
      });
    });

    // --- 404 / 400 paths specific to task subscores ---

    it('returns 404 when the task is not part of the administration', async () => {
      setupRepoDefaults({ taskMeta: paTaskMeta() }); // admin has PA, not phonics

      const service = createService();
      await expect(
        service.listTaskSubscores(superAdminAuth, testAdministrationId, PHONICS_TASK_ID, defaultQuery()),
      ).rejects.toMatchObject({
        statusCode: StatusCodes.NOT_FOUND,
        code: ApiErrorCode.RESOURCE_NOT_FOUND,
      });
    });

    it('returns 400 for tasks without a registered subscore schema (e.g., SWR)', async () => {
      setupRepoDefaults({ taskMeta: swrTaskMeta() });

      const service = createService();
      await expect(
        service.listTaskSubscores(superAdminAuth, testAdministrationId, SWR_TASK_ID, defaultQuery()),
      ).rejects.toMatchObject({
        statusCode: StatusCodes.BAD_REQUEST,
        code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
      });
    });

    it('returns 400 for an unknown subscores.<key> in sortBy', async () => {
      setupRepoDefaults();

      const service = createService();
      await expect(
        service.listTaskSubscores(
          superAdminAuth,
          testAdministrationId,
          PHONICS_TASK_ID,
          defaultQuery({ sortBy: 'subscores.notARealKey' }),
        ),
      ).rejects.toMatchObject({
        statusCode: StatusCodes.BAD_REQUEST,
        code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
      });
    });

    it('returns 400 for an unknown subscores.<key> in filter', async () => {
      setupRepoDefaults();

      const service = createService();
      await expect(
        service.listTaskSubscores(
          superAdminAuth,
          testAdministrationId,
          PHONICS_TASK_ID,
          defaultQuery({
            filter: [{ field: 'subscores.notARealKey', operator: 'gte' as const, value: '50' }],
          }),
        ),
      ).rejects.toMatchObject({
        statusCode: StatusCodes.BAD_REQUEST,
        code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
      });
    });

    it('returns 400 when filtering on a column with no numeric form', async () => {
      // PA's `skillsToWorkOn` is a computed column (kind: 'paSkillsToWorkOn')
      // — there is no numeric run_scores.name to filter against.
      setupRepoDefaults({ taskMeta: paTaskMeta() });

      const service = createService();
      await expect(
        service.listTaskSubscores(
          superAdminAuth,
          testAdministrationId,
          PA_TASK_ID,
          defaultQuery({
            filter: [{ field: 'subscores.skillsToWorkOn', operator: 'gte' as const, value: '50' }],
          }),
        ),
      ).rejects.toMatchObject({
        statusCode: StatusCodes.BAD_REQUEST,
        code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
      });
    });

    it('returns 400 when a non-numeric operator is used on a subscore filter', async () => {
      setupRepoDefaults();

      const service = createService();
      await expect(
        service.listTaskSubscores(
          superAdminAuth,
          testAdministrationId,
          PHONICS_TASK_ID,
          defaultQuery({
            filter: [{ field: 'subscores.cvc', operator: 'contains' as const, value: '50' }],
          }),
        ),
      ).rejects.toMatchObject({
        statusCode: StatusCodes.BAD_REQUEST,
        code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
      });
    });

    it('returns 400 when subscore filter value is not numeric', async () => {
      setupRepoDefaults();

      const service = createService();
      await expect(
        service.listTaskSubscores(
          superAdminAuth,
          testAdministrationId,
          PHONICS_TASK_ID,
          defaultQuery({
            filter: [{ field: 'subscores.cvc', operator: 'gte' as const, value: 'not-a-number' }],
          }),
        ),
      ).rejects.toMatchObject({
        statusCode: StatusCodes.BAD_REQUEST,
        code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
      });
    });

    // --- Response shape: column metadata ---

    it('returns the registered phonics columns in the expected order', async () => {
      setupRepoDefaults();

      const service = createService();
      const result = await service.listTaskSubscores(
        superAdminAuth,
        testAdministrationId,
        PHONICS_TASK_ID,
        defaultQuery(),
      );

      const keys = result.subscoreColumns.map((c) => c.key);
      expect(keys).toEqual([
        'cvc',
        'digraph',
        'initialBlend',
        'tripleBlend',
        'finalBlend',
        'rControlled',
        'rCluster',
        'silentE',
        'vowelTeam',
        'totalPercentCorrect',
      ]);
    });

    it('returns the registered PA columns in the expected order', async () => {
      setupRepoDefaults({ taskMeta: paTaskMeta() });

      const service = createService();
      const result = await service.listTaskSubscores(superAdminAuth, testAdministrationId, PA_TASK_ID, defaultQuery());

      const keys = result.subscoreColumns.map((c) => c.key);
      expect(keys).toEqual(['firstSound', 'lastSound', 'deletion', 'total', 'skillsToWorkOn']);
    });

    // --- Per-row formatting ---

    it('formats phonics rows with itemLevel "X/Y" strings + numeric totalPercentCorrect', async () => {
      setupRepoDefaults({
        pageItems: [
          {
            userId: 'student-1',
            assessmentPid: 'pid-1',
            username: 'jdoe',
            email: 'jdoe@school.edu',
            nameFirst: 'Jane',
            nameLast: 'Doe',
            grade: '3',
            scores: new Map([
              [
                PHONICS_VARIANT_ID,
                new Map([
                  ['cvcCorrect', '15'],
                  ['cvcAttempted', '19'],
                  ['cvcPercentCorrect', '78.9'],
                  ['totalPercentCorrect', '78.5'],
                ]),
              ],
            ]),
          },
        ],
        totalItems: 1,
      });

      const service = createService();
      const result = await service.listTaskSubscores(
        superAdminAuth,
        testAdministrationId,
        PHONICS_TASK_ID,
        defaultQuery(),
      );

      expect(result.items).toHaveLength(1);
      const row = result.items[0]!;
      expect(row.subscores.cvc).toBe('15/19');
      expect(row.subscores.totalPercentCorrect).toBe(79); // rounded
      // Columns the row didn't have data for collapse to null.
      expect(row.subscores.digraph).toBeNull();
    });

    it('emits PA skillsToWorkOn as a comma-separated list when subscores fall below threshold', async () => {
      setupRepoDefaults({
        taskMeta: paTaskMeta(),
        pageItems: [
          {
            userId: 'student-1',
            assessmentPid: null,
            username: 'jdoe',
            email: null,
            nameFirst: 'Jane',
            nameLast: 'Doe',
            grade: '1',
            scores: new Map([
              [
                PA_VARIANT_ID,
                new Map([
                  ['fsmCorrect', '15'],
                  ['fsmAttempted', '19'],
                  ['fsmPercentCorrect', '78.9'],
                  ['lsmCorrect', '18'],
                  ['lsmAttempted', '19'],
                  ['lsmPercentCorrect', '94.7'],
                  ['delCorrect', '12'],
                  ['delAttempted', '19'],
                  ['delPercentCorrect', '63.2'],
                ]),
              ],
            ]),
          },
        ],
        totalItems: 1,
      });

      const service = createService();
      const result = await service.listTaskSubscores(superAdminAuth, testAdministrationId, PA_TASK_ID, defaultQuery());

      const row = result.items[0]!;
      expect(row.subscores.firstSound).toBe('15/19');
      expect(row.subscores.lastSound).toBe('18/19');
      expect(row.subscores.deletion).toBe('12/19');
      // FSM is exactly at threshold (78.9 >= 78.9 ⇒ NOT in skills list — but
      // the helper treats >= threshold as proficient). DEL is below.
      expect(typeof row.subscores.skillsToWorkOn).toBe('string');
      expect(row.subscores.skillsToWorkOn as string).toMatch(/DEL/);
    });

    // --- Sort + filter compilation forwarded to the repository ---

    it('forwards subscores.<key> sort to the repository as a numeric scoreName', async () => {
      setupRepoDefaults();

      const service = createService();
      await service.listTaskSubscores(
        superAdminAuth,
        testAdministrationId,
        PHONICS_TASK_ID,
        defaultQuery({ sortBy: 'subscores.cvc', sortOrder: 'desc' }),
      );

      expect(mockReportRepository.getTaskSubscoreStudents).toHaveBeenCalledWith(
        testAdministrationId,
        expect.objectContaining({ scopeType: 'district' }),
        [PHONICS_VARIANT_ID],
        expect.any(Object),
        undefined,
        { scoreName: 'cvcPercentCorrect' },
        [],
      );
    });

    it('forwards subscores.<key> filter to the repository as a numeric filter', async () => {
      setupRepoDefaults();

      const service = createService();
      await service.listTaskSubscores(
        superAdminAuth,
        testAdministrationId,
        PHONICS_TASK_ID,
        defaultQuery({
          filter: [{ field: 'subscores.cvc', operator: 'gte' as const, value: '80' }],
        }),
      );

      expect(mockReportRepository.getTaskSubscoreStudents).toHaveBeenCalledWith(
        testAdministrationId,
        expect.any(Object),
        [PHONICS_VARIANT_ID],
        expect.any(Object),
        undefined,
        null,
        [{ scoreName: 'cvcPercentCorrect', operator: 'gte', value: 80 }],
      );
    });

    // --- District scope school name resolution ---

    it('attaches schoolName for district scope (and not otherwise)', async () => {
      setupRepoDefaults({
        pageItems: [
          {
            userId: 'student-1',
            assessmentPid: null,
            username: 'jdoe',
            email: null,
            nameFirst: 'Jane',
            nameLast: 'Doe',
            grade: '3',
            scores: new Map(),
          },
        ],
        totalItems: 1,
      });
      mockReportRepository.getSchoolNamesForUsers.mockResolvedValue(new Map([['student-1', 'Lincoln Elementary']]));

      const service = createService();
      const districtResult = await service.listTaskSubscores(
        superAdminAuth,
        testAdministrationId,
        PHONICS_TASK_ID,
        defaultQuery({ scopeType: 'district' }),
      );
      expect(districtResult.items[0]!.user.schoolName).toBe('Lincoln Elementary');

      // School scope ⇒ schoolName must be omitted from the row entirely.
      const schoolResult = await service.listTaskSubscores(
        superAdminAuth,
        testAdministrationId,
        PHONICS_TASK_ID,
        defaultQuery({ scopeType: 'school' }),
      );
      expect('schoolName' in schoolResult.items[0]!.user).toBe(false);
    });

    // --- Multi-variant dedup ---

    it('picks the lowest-orderIndex variant the student has scores for', async () => {
      const altVariantId = 'phonics-variant-2';
      mockReportRepository.getTaskMetadata.mockResolvedValue([
        // Out-of-order on purpose to verify the service sorts before picking.
        { ...phonicsTaskMeta(), taskVariantId: altVariantId, orderIndex: 1 },
        phonicsTaskMeta(),
      ]);
      mockTaskVariantParameterRepository.getByTaskVariantIds.mockResolvedValue([]);
      mockReportRepository.getTaskSubscoreStudents.mockResolvedValue({
        items: [
          {
            userId: 'student-1',
            assessmentPid: null,
            username: null,
            email: null,
            nameFirst: 'Jane',
            nameLast: 'Doe',
            grade: '3',
            scores: new Map([
              // Only the alt variant has data — the primary's map is empty.
              [PHONICS_VARIANT_ID, new Map()],
              [
                altVariantId,
                new Map([
                  ['cvcCorrect', '12'],
                  ['cvcAttempted', '19'],
                ]),
              ],
            ]),
          },
        ],
        totalItems: 1,
      });
      mockReportRepository.getSchoolNamesForUsers.mockResolvedValue(new Map());

      const service = createService();
      const result = await service.listTaskSubscores(
        superAdminAuth,
        testAdministrationId,
        PHONICS_TASK_ID,
        defaultQuery({ scopeType: 'school' }),
      );

      // The primary (orderIndex 0) variant has no scores; the service falls
      // through to the alt variant, so the row reports the alt's data.
      const row = result.items[0]!;
      expect(row.subscores.cvc).toBe('12/19');
    });

    // --- Pagination + total ---

    it('returns the repository totalItems count', async () => {
      setupRepoDefaults({ pageItems: [], totalItems: 73 });

      const service = createService();
      const result = await service.listTaskSubscores(
        superAdminAuth,
        testAdministrationId,
        PHONICS_TASK_ID,
        defaultQuery(),
      );
      expect(result.totalItems).toBe(73);
    });

    // --- Error handling ---

    it('wraps unexpected repository errors in a 500', async () => {
      mockReportRepository.getTaskMetadata.mockResolvedValue([phonicsTaskMeta()]);
      mockTaskVariantParameterRepository.getByTaskVariantIds.mockResolvedValue([]);
      mockReportRepository.getTaskSubscoreStudents.mockRejectedValue(new Error('connection reset'));

      const service = createService();
      await expect(
        service.listTaskSubscores(superAdminAuth, testAdministrationId, PHONICS_TASK_ID, defaultQuery()),
      ).rejects.toMatchObject({
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
      });
    });
  });
});
