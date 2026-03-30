import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StatusCodes } from 'http-status-codes';
import { ReportService, buildProgressMap } from './report.service';
import { AdministrationFactory } from '../../test-support/factories/administration.factory';
import { createMockAdministrationRepository, createMockReportRepository } from '../../test-support/repositories';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import type { ProgressStudentsInput } from './report.types';
import type { ReportTaskMeta, StudentProgressRow } from '../../repositories/report.repository';

describe('ReportService', () => {
  let mockAdministrationRepository: ReturnType<typeof createMockAdministrationRepository>;
  let mockReportRepository: ReturnType<typeof createMockReportRepository>;

  const superAdminAuth = { userId: 'super-admin-id', isSuperAdmin: true };
  const teacherAuth = { userId: 'teacher-id', isSuperAdmin: false };
  const studentAuth = { userId: 'student-id', isSuperAdmin: false };
  const caregiverAuth = { userId: 'caregiver-id', isSuperAdmin: false };

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

  const testTaskMetas: ReportTaskMeta[] = [
    { taskId: TASK_ID_1, taskVariantId: 'tv-1', taskSlug: 'swr', taskName: 'ROAR - Word', orderIndex: 0 },
    { taskId: TASK_ID_2, taskVariantId: 'tv-2', taskSlug: 'sre', taskName: 'ROAR - Sentence', orderIndex: 1 },
  ];

  function createService() {
    return ReportService({
      administrationRepository: mockAdministrationRepository,
      reportRepository: mockReportRepository,
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdministrationRepository = createMockAdministrationRepository();
    mockReportRepository = createMockReportRepository();

    // Default: administration exists
    mockAdministrationRepository.getById.mockResolvedValue(AdministrationFactory.build({ id: testAdministrationId }));
    // Default: scope is assigned
    mockReportRepository.isScopeAssignedToAdministration.mockResolvedValue(true);
    // Default: task metadata
    mockReportRepository.getTaskMetadata.mockResolvedValue(testTaskMetas);
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
        runs: new Map([['tv-1', { completedAt: new Date('2025-09-15'), startedAt: new Date('2025-09-10') }]]),
      };

      mockReportRepository.getProgressStudents.mockResolvedValue({
        items: [studentRow],
        totalItems: 1,
      });

      const service = createService();
      const result = await service.listProgressStudents(superAdminAuth, testAdministrationId, testQuery);

      expect(result.tasks).toHaveLength(2);
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

    it('returns 403 when user lacks access to administration', async () => {
      mockAdministrationRepository.getAuthorizedById.mockResolvedValue(null);

      const service = createService();

      await expect(service.listProgressStudents(teacherAuth, testAdministrationId, testQuery)).rejects.toMatchObject({
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
      });

      // Verify the 403 came from the administration access check
      expect(mockAdministrationRepository.getAuthorizedById).toHaveBeenCalledWith(
        { userId: teacherAuth.userId, allowedRoles: expect.any(Array) },
        testAdministrationId,
      );
    });

    it('returns 403 when user role lacks Reports.Progress.READ permission', async () => {
      mockAdministrationRepository.getAuthorizedById.mockResolvedValue(
        AdministrationFactory.build({ id: testAdministrationId }),
      );
      // Students don't have Reports.Progress.READ
      mockAdministrationRepository.getUserRolesForAdministration.mockResolvedValue(['student']);

      const service = createService();

      await expect(service.listProgressStudents(studentAuth, testAdministrationId, testQuery)).rejects.toMatchObject({
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
      });

      // Verify the correct userId was passed to the role check
      expect(mockAdministrationRepository.getUserRolesForAdministration).toHaveBeenCalledWith(
        studentAuth.userId,
        testAdministrationId,
      );
    });

    it('returns 403 when user has report permission but only supervised roles', async () => {
      mockAdministrationRepository.getAuthorizedById.mockResolvedValue(
        AdministrationFactory.build({ id: testAdministrationId }),
      );
      // Caregivers have Reports.Progress.READ but are not supervisory
      mockAdministrationRepository.getUserRolesForAdministration.mockResolvedValue(['caregiver']);

      const service = createService();

      await expect(service.listProgressStudents(caregiverAuth, testAdministrationId, testQuery)).rejects.toMatchObject({
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
      });

      // Verify the correct userId was passed to the role check
      expect(mockAdministrationRepository.getUserRolesForAdministration).toHaveBeenCalledWith(
        caregiverAuth.userId,
        testAdministrationId,
      );
    });

    it('returns 400 when scope is not assigned to administration', async () => {
      mockAdministrationRepository.getAuthorizedById.mockResolvedValue(
        AdministrationFactory.build({ id: testAdministrationId }),
      );
      mockAdministrationRepository.getUserRolesForAdministration.mockResolvedValue(['teacher']);
      mockReportRepository.isScopeAssignedToAdministration.mockResolvedValue(false);

      const service = createService();

      await expect(service.listProgressStudents(teacherAuth, testAdministrationId, testQuery)).rejects.toMatchObject({
        statusCode: StatusCodes.BAD_REQUEST,
        code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
      });
    });

    it('returns 403 when user lacks supervisory role at scope level', async () => {
      mockAdministrationRepository.getAuthorizedById.mockResolvedValue(
        AdministrationFactory.build({ id: testAdministrationId }),
      );
      mockAdministrationRepository.getUserRolesForAdministration.mockResolvedValue(['teacher']);
      mockReportRepository.getUserRolesAtOrAboveScope.mockResolvedValue(['student']);

      const service = createService();

      await expect(service.listProgressStudents(teacherAuth, testAdministrationId, testQuery)).rejects.toMatchObject({
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
      });
    });

    it('maps started runs correctly', async () => {
      mockAdministrationRepository.getAuthorizedById.mockResolvedValue(
        AdministrationFactory.build({ id: testAdministrationId }),
      );
      mockAdministrationRepository.getUserRolesForAdministration.mockResolvedValue(['teacher']);
      mockReportRepository.getUserRolesAtOrAboveScope.mockResolvedValue(['teacher']);

      const studentRow: StudentProgressRow = {
        userId: 'student-1',
        assessmentPid: 'pid-student-1',
        username: 'jdoe',
        email: null,
        nameFirst: 'Jane',
        nameLast: 'Doe',
        grade: '3',
        schoolName: null,
        runs: new Map([['tv-1', { completedAt: null, startedAt: new Date('2025-09-10') }]]),
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

    it('returns progress data for non-super-admin with supervisory role', async () => {
      mockAdministrationRepository.getAuthorizedById.mockResolvedValue(
        AdministrationFactory.build({ id: testAdministrationId }),
      );
      mockAdministrationRepository.getUserRolesForAdministration.mockResolvedValue(['teacher']);
      mockReportRepository.getUserRolesAtOrAboveScope.mockResolvedValue(['teacher']);

      const studentRow: StudentProgressRow = {
        userId: 'student-1',
        assessmentPid: 'pid-student-1',
        username: 'jdoe',
        email: 'jdoe@school.edu',
        nameFirst: 'Jane',
        nameLast: 'Doe',
        grade: '3',
        schoolName: 'Lincoln Elementary',
        runs: new Map([
          ['tv-1', { completedAt: new Date('2025-09-15'), startedAt: new Date('2025-09-10') }],
          ['tv-2', { completedAt: null, startedAt: new Date('2025-09-12') }],
        ]),
      };

      mockReportRepository.getProgressStudents.mockResolvedValue({
        items: [studentRow],
        totalItems: 1,
      });

      const service = createService();
      const result = await service.listProgressStudents(teacherAuth, testAdministrationId, testQuery);

      expect(result.tasks).toHaveLength(2);
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
        ['tv-1', 'tv-2'],
        expect.objectContaining({ page: 1, perPage: 25, sortDirection: 'asc' }),
        undefined,
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
        ['tv-1', 'tv-2'],
        expect.objectContaining({ page: 1, perPage: 25, sortDirection: 'asc' }),
        expect.anything(), // filter condition SQL object
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
        schoolName: 'Lincoln Elementary', // repository returns a school name
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

    it('super admin bypasses scope authorization', async () => {
      mockReportRepository.getProgressStudents.mockResolvedValue({ items: [], totalItems: 0 });

      const service = createService();
      await service.listProgressStudents(superAdminAuth, testAdministrationId, testQuery);

      // Super admin should NOT trigger role checks — both are inside the `if (!isSuperAdmin)` guard
      expect(mockAdministrationRepository.getUserRolesForAdministration).not.toHaveBeenCalled();
      expect(mockReportRepository.getUserRolesAtOrAboveScope).not.toHaveBeenCalled();
    });

    it('returns 400 when multiple progress status filters are provided', async () => {
      const multiFilterQuery: ProgressStudentsInput = {
        ...testQuery,
        filter: [
          { field: `progress.${TASK_ID_1}.status`, operator: 'eq', value: 'completed' },
          { field: `progress.${TASK_ID_2}.status`, operator: 'eq', value: 'started' },
        ],
      };

      const service = createService();
      await expect(
        service.listProgressStudents(superAdminAuth, testAdministrationId, multiFilterQuery),
      ).rejects.toMatchObject({
        statusCode: StatusCodes.BAD_REQUEST,
        code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
      });
    });
  });

  describe('buildProgressMap', () => {
    it('maps completed runs correctly', () => {
      const student: StudentProgressRow = {
        userId: 'student-1',
        assessmentPid: 'pid-student-1',
        username: null,
        email: null,
        nameFirst: null,
        nameLast: null,
        grade: null,
        schoolName: null,
        runs: new Map([
          ['tv-1', { completedAt: new Date('2025-09-15T10:00:00Z'), startedAt: new Date('2025-09-10T08:00:00Z') }],
        ]),
      };

      const result = buildProgressMap(student, testTaskMetas);

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
        userId: 'student-1',
        assessmentPid: 'pid-student-1',
        username: null,
        email: null,
        nameFirst: null,
        nameLast: null,
        grade: null,
        schoolName: null,
        runs: new Map([['tv-1', { completedAt: null, startedAt: new Date('2025-09-10T08:00:00Z') }]]),
      };

      const result = buildProgressMap(student, testTaskMetas);

      expect(result[TASK_ID_1]).toEqual({
        status: 'started',
        startedAt: '2025-09-10T08:00:00.000Z',
        completedAt: null,
      });
    });

    it('returns assigned for tasks with no runs', () => {
      const student: StudentProgressRow = {
        userId: 'student-1',
        assessmentPid: 'pid-student-1',
        username: null,
        email: null,
        nameFirst: null,
        nameLast: null,
        grade: null,
        schoolName: null,
        runs: new Map(),
      };

      const result = buildProgressMap(student, testTaskMetas);

      expect(result[TASK_ID_1]!.status).toBe('assigned');
      expect(result[TASK_ID_2]!.status).toBe('assigned');
    });

    describe('multi-variant priority (same taskId)', () => {
      const SHARED_TASK_ID = 'ccc00000-0000-0000-0000-000000000001';
      const VARIANT_A = 'variant-a';
      const VARIANT_B = 'variant-b';
      const VARIANT_C = 'variant-c';

      const multiVariantMetas: ReportTaskMeta[] = [
        { taskId: SHARED_TASK_ID, taskVariantId: VARIANT_A, taskSlug: 'swr', taskName: 'ROAR - Word', orderIndex: 0 },
        { taskId: SHARED_TASK_ID, taskVariantId: VARIANT_B, taskSlug: 'swr', taskName: 'ROAR - Word', orderIndex: 1 },
        { taskId: SHARED_TASK_ID, taskVariantId: VARIANT_C, taskSlug: 'swr', taskName: 'ROAR - Word', orderIndex: 2 },
      ];

      function buildStudent(runs: Map<string, { completedAt: Date | null; startedAt: Date }>): StudentProgressRow {
        return {
          userId: 'student-1',
          assessmentPid: 'pid-1',
          username: null,
          email: null,
          nameFirst: null,
          nameLast: null,
          grade: null,
          schoolName: null,
          runs,
        };
      }

      it('keeps completed when a later variant has no run', () => {
        // Variant A: completed, Variant B: no run, Variant C: no run
        const student = buildStudent(
          new Map([[VARIANT_A, { completedAt: new Date('2025-09-15'), startedAt: new Date('2025-09-10') }]]),
        );

        const result = buildProgressMap(student, multiVariantMetas);

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

        const result = buildProgressMap(student, multiVariantMetas);

        expect(result[SHARED_TASK_ID]!.status).toBe('completed');
      });

      it('keeps started when a later variant has no run', () => {
        // Variant A: no run, Variant B: started, Variant C: no run
        const student = buildStudent(new Map([[VARIANT_B, { completedAt: null, startedAt: new Date('2025-09-12') }]]));

        const result = buildProgressMap(student, multiVariantMetas);

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

        const result = buildProgressMap(student, multiVariantMetas);

        expect(result[SHARED_TASK_ID]!.status).toBe('completed');
        expect(result[SHARED_TASK_ID]!.completedAt).toBe('2025-09-15T00:00:00.000Z');
      });

      it('produces a single progress key even with multiple variants', () => {
        const student = buildStudent(new Map());

        const result = buildProgressMap(student, multiVariantMetas);

        const keys = Object.keys(result);
        expect(keys).toHaveLength(1);
        expect(keys[0]).toBe(SHARED_TASK_ID);
      });
    });

    it('populates startedAt when available from run data', () => {
      const student: StudentProgressRow = {
        userId: 'student-1',
        assessmentPid: 'pid-student-1',
        username: null,
        email: null,
        nameFirst: null,
        nameLast: null,
        grade: null,
        schoolName: null,
        runs: new Map([
          ['tv-1', { completedAt: new Date('2025-09-15T12:00:00Z'), startedAt: new Date('2025-09-15T10:00:00Z') }],
          ['tv-2', { completedAt: null, startedAt: new Date('2025-09-15T11:00:00Z') }],
        ]),
      };

      const result = buildProgressMap(student, testTaskMetas);

      expect(result[TASK_ID_1]!.startedAt).toBe('2025-09-15T10:00:00.000Z');
      expect(result[TASK_ID_2]!.startedAt).toBe('2025-09-15T11:00:00.000Z');
    });
  });
});
