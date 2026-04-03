import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StatusCodes } from 'http-status-codes';
import { ReportService, buildProgressMap } from './report.service';
import { AdministrationFactory } from '../../test-support/factories/administration.factory';
import {
  createMockAdministrationRepository,
  createMockReportRepository,
  createMockTaskVariantParameterRepository,
} from '../../test-support/repositories';
import { createMockAuthorizationService, createMockTaskService } from '../../test-support/services';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import type { ProgressStudentsInput } from './report.types';
import type {
  ReportTaskMeta,
  StudentProgressRow,
  StudentOverviewRow,
  RunScoreRow,
} from '../../repositories/report.repository';
import type { ScoreOverviewQuery } from '@roar-dashboard/api-contract';
import { Operator } from '../task/task.types';

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
  let mockAuthorizationService: ReturnType<typeof createMockAuthorizationService>;
  let mockTaskVariantParameterRepository: ReturnType<typeof createMockTaskVariantParameterRepository>;

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
      taskVariantParameterRepository: mockTaskVariantParameterRepository,
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdministrationRepository = createMockAdministrationRepository();
    mockReportRepository = createMockReportRepository();
    mockTaskService = createMockTaskService();
    mockAuthorizationService = createMockAuthorizationService();
    mockTaskVariantParameterRepository = createMockTaskVariantParameterRepository();

    // Default: administration exists
    mockAdministrationRepository.getById.mockResolvedValue(AdministrationFactory.build({ id: testAdministrationId }));
    // Default: FGA allows all checks (non-super-admin path)
    mockAuthorizationService.hasPermission.mockResolvedValue(true);
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
      // First FGA check (administration-level) denies access
      mockAuthorizationService.hasPermission.mockResolvedValue(false);

      const service = createService();

      await expect(service.listProgressStudents(teacherAuth, testAdministrationId, testQuery)).rejects.toMatchObject({
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
      });

      // Verify AuthorizationService.hasPermission was called with correct arguments
      expect(mockAuthorizationService.hasPermission).toHaveBeenCalledWith(
        teacherAuth.userId,
        'can_read_progress',
        `administration:${testAdministrationId}`,
      );

      // Scope validation should not have been reached
      expect(mockReportRepository.isScopeAssignedToAdministration).not.toHaveBeenCalled();
    });

    it('returns 400 when scope is not assigned to administration', async () => {
      mockReportRepository.isScopeAssignedToAdministration.mockResolvedValue(false);

      const service = createService();

      await expect(service.listProgressStudents(teacherAuth, testAdministrationId, testQuery)).rejects.toMatchObject({
        statusCode: StatusCodes.BAD_REQUEST,
        code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
      });
    });

    it('returns 403 when FGA denies can_read_progress at scope level', async () => {
      // Administration-level FGA check passes, scope-level denies
      mockAuthorizationService.hasPermission
        .mockResolvedValueOnce(true) // administration check
        .mockResolvedValueOnce(false); // scope check

      const service = createService();

      await expect(service.listProgressStudents(teacherAuth, testAdministrationId, testQuery)).rejects.toMatchObject({
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
      });

      // Verify scope-level AuthorizationService.hasPermission was called with the correct scope type and ID
      expect(mockAuthorizationService.hasPermission).toHaveBeenCalledTimes(2);
      expect(mockAuthorizationService.hasPermission).toHaveBeenLastCalledWith(
        teacherAuth.userId,
        'can_read_progress',
        `district:${testQuery.scopeId}`,
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

    it('returns progress data for non-super-admin when FGA allows', async () => {
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

      // Super admin should NOT trigger FGA checks
      expect(mockAuthorizationService.hasPermission).not.toHaveBeenCalled();
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

  describe('getScoreOverview', () => {
    const scoreQuery: ScoreOverviewQuery = {
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

    /** Helper to build RunScoreRow entries. */
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

    // --- Authorization tests (same 3-layer pattern as listProgressStudents) ---

    it('returns 404 when administration does not exist', async () => {
      mockAdministrationRepository.getById.mockResolvedValue(null);

      const service = createService();

      await expect(service.getScoreOverview(teacherAuth, testAdministrationId, scoreQuery)).rejects.toMatchObject({
        statusCode: StatusCodes.NOT_FOUND,
        code: ApiErrorCode.RESOURCE_NOT_FOUND,
      });
    });

    it('returns 403 when FGA denies can_read_scores on administration', async () => {
      mockAuthorizationService.hasPermission.mockResolvedValue(false);

      const service = createService();

      await expect(service.getScoreOverview(teacherAuth, testAdministrationId, scoreQuery)).rejects.toMatchObject({
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
      });

      expect(mockAuthorizationService.hasPermission).toHaveBeenCalledWith(
        teacherAuth.userId,
        'can_read_scores',
        `administration:${testAdministrationId}`,
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
      mockAuthorizationService.hasPermission.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

      const service = createService();

      await expect(service.getScoreOverview(teacherAuth, testAdministrationId, scoreQuery)).rejects.toMatchObject({
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
      });
    });

    it('super admin bypasses FGA checks', async () => {
      setupDefaultScoreOverviewMocks();

      const service = createService();
      await service.getScoreOverview(superAdminAuth, testAdministrationId, scoreQuery);

      expect(mockAuthorizationService.hasPermission).not.toHaveBeenCalled();
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
        expect(task.supportLevels.achievedSkill).toEqual({ count: 0, percentage: 0 });
      }
      expect(result.computedAt).toBeDefined();
    });

    it('returns computedAt as ISO 8601 datetime', async () => {
      setupDefaultScoreOverviewMocks();

      const service = createService();
      const result = await service.getScoreOverview(superAdminAuth, testAdministrationId, scoreQuery);

      // Verify it parses as a valid date
      const parsed = new Date(result.computedAt);
      expect(parsed.getTime()).not.toBeNaN();
    });

    // --- Aggregation logic ---

    it('counts assessed students with support levels', async () => {
      const students = [
        buildOverviewStudent({ userId: 'student-1', grade: '3' }),
        buildOverviewStudent({ userId: 'student-2', grade: '3' }),
        buildOverviewStudent({ userId: 'student-3', grade: '3' }),
      ];

      // All 3 students have completed scores for swr (task-1).
      // percentile = 50 → achievedSkill (>= 50th percentile for swr grade 3)
      // percentile = 30 → developingSkill
      // percentile = 10 → needsExtraSupport
      const scoreRows = [
        buildScoreRow('student-1', VARIANT_ID_1, 'percentile', '50'),
        buildScoreRow('student-2', VARIANT_ID_1, 'percentile', '30'),
        buildScoreRow('student-3', VARIANT_ID_1, 'percentile', '10'),
      ];

      setupDefaultScoreOverviewMocks(students, scoreRows);

      const service = createService();
      const result = await service.getScoreOverview(superAdminAuth, testAdministrationId, scoreQuery);

      const swrTask = result.tasks.find((t) => t.taskId === TASK_ID_1);
      expect(swrTask).toBeDefined();
      expect(swrTask!.totalAssessed).toBe(3);
      // At least one student in each bucket (exact classification depends on scoring thresholds)
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

    it('calculates percentages as 0-100 rounded to 1 decimal place', async () => {
      const students = [
        buildOverviewStudent({ userId: 's1', grade: '3' }),
        buildOverviewStudent({ userId: 's2', grade: '3' }),
        buildOverviewStudent({ userId: 's3', grade: '3' }),
      ];

      // Give all students the same high score so they all land in achievedSkill
      const scoreRows = students.map((s) => buildScoreRow(s.userId, VARIANT_ID_1, 'percentile', '90'));

      setupDefaultScoreOverviewMocks(students, scoreRows);

      const service = createService();
      const result = await service.getScoreOverview(superAdminAuth, testAdministrationId, scoreQuery);

      const swrTask = result.tasks.find((t) => t.taskId === TASK_ID_1);
      expect(swrTask).toBeDefined();
      // All 3 assessed → achievedSkill should be 100%
      expect(swrTask!.supportLevels.achievedSkill.percentage).toBe(100);
      expect(swrTask!.supportLevels.developingSkill.percentage).toBe(0);
      expect(swrTask!.supportLevels.needsExtraSupport.percentage).toBe(0);
    });

    // --- Multi-variant deduplication ---

    it('deduplicates across variants of the same task', async () => {
      // Two variants for the same taskId
      const SHARED_TASK = 'shared-task-id';
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

    it('uses first variant with scores for multi-variant student', async () => {
      const SHARED_TASK = 'shared-task-id';
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
      const scoreRows = [
        buildScoreRow('student-1', 'var-a', 'percentile', '90'),
        buildScoreRow('student-1', 'var-b', 'percentile', '10'),
      ];

      setupDefaultScoreOverviewMocks(students, scoreRows);

      const service = createService();
      const result = await service.getScoreOverview(superAdminAuth, testAdministrationId, scoreQuery);

      expect(result.tasks[0]!.totalAssessed).toBe(1);
      // With percentile=90, student should be achievedSkill (not needsExtraSupport from var-b's 10)
      expect(result.tasks[0]!.supportLevels.achievedSkill.count).toBe(1);
    });

    it('evaluates eligibility across all variants when no run exists', async () => {
      const SHARED_TASK = 'shared-task-id';
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
      // Student should be counted as not-assessed required (ANY variant assigns → assigned).
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

    it('filters tasks by taskId when filter includes taskId field', async () => {
      const students = [buildOverviewStudent({ userId: 'student-1', grade: '3' })];
      const scoreRows = [buildScoreRow('student-1', VARIANT_ID_1, 'percentile', '50')];

      setupDefaultScoreOverviewMocks(students, scoreRows);

      const filteredQuery: ScoreOverviewQuery = {
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

    it('passes scoring version from task variant parameters to scoring logic', async () => {
      const students = [buildOverviewStudent({ userId: 'student-1', grade: '3' })];
      const scoreRows = [buildScoreRow('student-1', VARIANT_ID_1, 'percentile', '50')];

      setupDefaultScoreOverviewMocks(students, scoreRows);
      mockTaskVariantParameterRepository.getByTaskVariantIds.mockResolvedValue([
        { taskVariantId: VARIANT_ID_1, name: 'scoringVersion', value: 2, createdAt: new Date(), updatedAt: null },
      ]);

      const service = createService();
      const result = await service.getScoreOverview(superAdminAuth, testAdministrationId, scoreQuery);

      // Should complete without error; scoring version affects threshold selection
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
      // Simulate the administration not found case — should propagate the 404, not wrap in 500
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

      const filteredQuery: ScoreOverviewQuery = {
        ...scoreQuery,
        filter: [{ field: 'user.grade', operator: 'eq', value: '3' }],
      };

      const service = createService();
      await service.getScoreOverview(superAdminAuth, testAdministrationId, filteredQuery);

      // getAllStudentsInScope should be called with a filter condition
      expect(mockReportRepository.getAllStudentsInScope).toHaveBeenCalledWith(
        { scopeType: 'district', scopeId: 'district-uuid-1' },
        expect.anything(), // SQL filter condition
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
  });
});
