import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StatusCodes } from 'http-status-codes';
import { ReportService, buildProgressMap } from './report.service';
import { AdministrationFactory } from '../../test-support/factories/administration.factory';
import { createMockAdministrationRepository, createMockReportRepository } from '../../test-support/repositories';
import { createMockAuthorizationService, createMockTaskService } from '../../test-support/services';
import type { MockAuthorizationService } from '../../test-support/services';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { ApiErrorMessage } from '../../enums/api-error-message.enum';
import { ApiError } from '../../errors/api-error';
import { FgaType, FgaRelation } from '../authorization/fga-constants';
import type { ProgressStudentsInput, ProgressOverviewInput } from './report.types';
import type { ReportTaskMeta, StudentProgressRow, TaskStatusCount } from '../../repositories/report.repository';
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
    return ReportService({
      administrationRepository: mockAdministrationRepository,
      reportRepository: mockReportRepository,
      taskService: mockTaskService,
      authorizationService: mockAuthorizationService,
    });
  }

  beforeEach(() => {
    vi.resetAllMocks();
    mockAdministrationRepository = createMockAdministrationRepository();
    mockReportRepository = createMockReportRepository();
    mockTaskService = createMockTaskService();
    mockAuthorizationService = createMockAuthorizationService();

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
      expect(result.items[0]!.progress[TASK_ID_1]!.status).toBe('completed');
      expect(result.items[0]!.progress[TASK_ID_2]!.status).toBe('assigned');
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

      expect(result.items[0]!.progress[TASK_ID_1]!.status).toBe('started');
      expect(result.items[0]!.progress[TASK_ID_2]!.status).toBe('assigned');
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
      expect(result.items[0]!.progress[TASK_ID_1]!.status).toBe('completed');
      expect(result.items[0]!.progress[TASK_ID_2]!.status).toBe('started');

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
        status: 'completed',
        startedAt: '2025-09-10T08:00:00.000Z',
        completedAt: '2025-09-15T10:00:00.000Z',
      });
      expect(result[TASK_ID_2]).toEqual({
        status: 'assigned',
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
        status: 'started',
        startedAt: '2025-09-10T08:00:00.000Z',
        completedAt: null,
      });
    });

    it('returns assigned for tasks with no runs when conditions are null', () => {
      const result = buildProgressMap(defaultStudent, testTaskMetas, makeAssignedEvaluator());

      expect(result[TASK_ID_1]!.status).toBe('assigned');
      expect(result[TASK_ID_2]!.status).toBe('assigned');
    });

    it('returns optional when conditionsRequirements evaluates to true', () => {
      const optionalEvaluator = vi.fn().mockReturnValue({ isAssigned: true, isOptional: true });

      const result = buildProgressMap(defaultStudent, testTaskMetas, optionalEvaluator);

      expect(result[TASK_ID_1]!.status).toBe('optional');
      expect(result[TASK_ID_2]!.status).toBe('optional');
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

      expect(result[TASK_ID_1]!.status).toBe('assigned');
      expect(result[TASK_ID_2]!.status).toBe('optional');
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

        expect(result[SHARED_TASK_ID]!.status).toBe('completed');
      });

      it('keeps completed when a later variant is started', () => {
        // Variant A: completed, Variant B: started
        const student = buildStudent(
          new Map([
            [VARIANT_A, { completedAt: new Date('2025-09-15'), startedAt: new Date('2025-09-10') }],
            [VARIANT_B, { completedAt: null, startedAt: new Date('2025-09-12') }],
          ]),
        );

        const result = buildProgressMap(student, multiVariantMetas, makeAssignedEvaluator());

        expect(result[SHARED_TASK_ID]!.status).toBe('completed');
      });

      it('keeps started when a later variant has no run', () => {
        // Variant A: no run, Variant B: started, Variant C: no run
        const student = buildStudent(new Map([[VARIANT_B, { completedAt: null, startedAt: new Date('2025-09-12') }]]));

        const result = buildProgressMap(student, multiVariantMetas, makeAssignedEvaluator());

        expect(result[SHARED_TASK_ID]!.status).toBe('started');
      });

      it('promotes from assigned to started to completed across variants', () => {
        // Variant A: no run (assigned), Variant B: started, Variant C: completed
        const student = buildStudent(
          new Map([
            [VARIANT_B, { completedAt: null, startedAt: new Date('2025-09-12') }],
            [VARIANT_C, { completedAt: new Date('2025-09-15'), startedAt: new Date('2025-09-14') }],
          ]),
        );

        const result = buildProgressMap(student, multiVariantMetas, makeAssignedEvaluator());

        expect(result[SHARED_TASK_ID]!.status).toBe('completed');
        expect(result[SHARED_TASK_ID]!.completedAt).toBe('2025-09-15T00:00:00.000Z');
      });

      it('produces a single progress key even with multiple variants', () => {
        const student = buildStudent(new Map());

        const result = buildProgressMap(student, multiVariantMetas, makeAssignedEvaluator());

        const keys = Object.keys(result);
        expect(keys).toHaveLength(1);
        expect(keys[0]).toBe(SHARED_TASK_ID);
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

    it('does not call evaluator for tasks with runs', () => {
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

      // All tasks have runs, so evaluator should not be called
      expect(evaluator).not.toHaveBeenCalled();
    });

    it('shows run status even when conditionsAssignment would exclude the student', () => {
      // If a student somehow has a run for a task whose conditionsAssignment would
      // exclude them (e.g., data changed after the run was created), we still show
      // the run — the student's actual progress takes precedence over conditions.
      const notAssignedEvaluator = vi.fn().mockReturnValue({ isAssigned: false, isOptional: false });
      const student: StudentProgressRow = {
        ...defaultStudent,
        runs: new Map([
          [VARIANT_ID_1, { completedAt: new Date('2025-09-15T10:00:00Z'), startedAt: new Date('2025-09-14') }],
        ]),
      };

      const result = buildProgressMap(student, testTaskMetas, notAssignedEvaluator);

      // Task-1 has a run → completed (conditions not checked)
      expect(result[TASK_ID_1]!.status).toBe('completed');
      // Tasks 2-4 have no runs and conditionsAssignment returns false → excluded
      expect(result[TASK_ID_2]).toBeUndefined();
      expect(result[TASK_ID_3]).toBeUndefined();
      expect(result[TASK_ID_4]).toBeUndefined();
      // Evaluator called once per task without a run (3 tasks)
      expect(notAssignedEvaluator).toHaveBeenCalledTimes(3);
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
        { taskId: TASK_ID_1, status: 'completed', count: 10 },
        { taskId: TASK_ID_1, status: 'started', count: 5 },
        { taskId: TASK_ID_1, status: 'assigned', count: 3 },
        { taskId: TASK_ID_2, status: 'completed', count: 8 },
        { taskId: TASK_ID_2, status: 'assigned', count: 10 },
      ];

      mockReportRepository.getProgressOverviewCounts.mockResolvedValue({
        totalStudents: 20,
        taskStatusCounts: statusCounts,
      });

      const service = createService();
      const result = await service.getProgressOverview(superAdminAuth, testAdministrationId, overviewQuery);

      expect(result.totalStudents).toBe(20);
      expect(result.assigned).toBe(13); // 3 + 10
      expect(result.started).toBe(5);
      expect(result.completed).toBe(18); // 10 + 8
      expect(result.byTask).toHaveLength(4); // 4 unique taskIds
      expect(result.computedAt).toBeDefined();

      // Verify task 1 counts
      const task1 = result.byTask.find((t) => t.taskId === TASK_ID_1);
      expect(task1).toEqual(
        expect.objectContaining({
          taskSlug: 'swr',
          assigned: 3,
          started: 5,
          completed: 10,
          optional: 0,
        }),
      );

      // Verify task 2 counts
      const task2 = result.byTask.find((t) => t.taskId === TASK_ID_2);
      expect(task2).toEqual(
        expect.objectContaining({
          taskSlug: 'sre',
          assigned: 10,
          started: 0,
          completed: 8,
          optional: 0,
        }),
      );
    });

    it('returns overview for non-super-admin (via FGA)', async () => {
      mockReportRepository.getProgressOverviewCounts.mockResolvedValue({
        totalStudents: 5,
        taskStatusCounts: [{ taskId: TASK_ID_1, status: 'assigned', count: 5 }],
      });

      const service = createService();
      const result = await service.getProgressOverview(teacherAuth, testAdministrationId, overviewQuery);

      expect(result.totalStudents).toBe(5);
      expect(result.assigned).toBe(5);
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
      });

      const service = createService();
      const result = await service.getProgressOverview(superAdminAuth, testAdministrationId, overviewQuery);

      expect(result.totalStudents).toBe(0);
      expect(result.assigned).toBe(0);
      expect(result.started).toBe(0);
      expect(result.completed).toBe(0);
      expect(result.byTask).toHaveLength(4); // Tasks still listed with zero counts
      for (const task of result.byTask) {
        expect(task.assigned).toBe(0);
        expect(task.started).toBe(0);
        expect(task.completed).toBe(0);
        expect(task.optional).toBe(0);
      }
    });

    it('includes optional counts in per-task breakdown', async () => {
      mockReportRepository.getProgressOverviewCounts.mockResolvedValue({
        totalStudents: 15,
        taskStatusCounts: [
          { taskId: TASK_ID_1, status: 'assigned', count: 5 },
          { taskId: TASK_ID_1, status: 'optional', count: 10 },
        ],
      });

      const service = createService();
      const result = await service.getProgressOverview(superAdminAuth, testAdministrationId, overviewQuery);

      const task1 = result.byTask.find((t) => t.taskId === TASK_ID_1);
      expect(task1!.assigned).toBe(5);
      expect(task1!.optional).toBe(10);
      // Optional is not included in top-level totals (assigned/started/completed)
      expect(result.assigned).toBe(5);
    });

    it('preserves task ordering from metadata', async () => {
      mockReportRepository.getProgressOverviewCounts.mockResolvedValue({
        totalStudents: 10,
        taskStatusCounts: [
          { taskId: TASK_ID_3, status: 'assigned', count: 10 },
          { taskId: TASK_ID_1, status: 'assigned', count: 10 },
        ],
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
          { taskId: TASK_ID_1, status: 'completed', count: 7 },
          { taskId: TASK_ID_1, status: 'started', count: 3 },
          { taskId: TASK_ID_2, status: 'assigned', count: 10 },
        ],
      });

      const service = createService();
      const result = await service.getProgressOverview(superAdminAuth, testAdministrationId, overviewQuery);

      // Should have 2 unique tasks, not 3
      expect(result.byTask).toHaveLength(2);
      const task1 = result.byTask.find((t) => t.taskId === TASK_ID_1);
      expect(task1!.completed).toBe(7);
      expect(task1!.started).toBe(3);
    });

    it('passes task metadata with conditions to repository', async () => {
      mockReportRepository.getProgressOverviewCounts.mockResolvedValue({
        totalStudents: 5,
        taskStatusCounts: [],
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
});
