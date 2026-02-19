import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AdministrationService } from './administration.service';
import { AdministrationFactory } from '../../test-support/factories/administration.factory';
import { OrgFactory } from '../../test-support/factories/org.factory';
import { ClassFactory } from '../../test-support/factories/class.factory';
import { GroupFactory } from '../../test-support/factories/group.factory';
import { AgreementFactory } from '../../test-support/factories/agreement.factory';
import { AgreementVersionFactory } from '../../test-support/factories/agreement-version.factory';
import { UserFactory } from '../../test-support/factories/user.factory';
import { ApiErrorMessage } from '../../enums/api-error-message.enum';
import type { AssignmentWithOptional } from '../../repositories/administration.repository';

// Mock the logger (used by the service for error handling)
vi.mock('../../logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

describe('AdministrationService', () => {
  const mockListAuthorized = vi.fn();
  const mockGetAll = vi.fn();
  const mockGetTasksByAdministrationIds = vi.fn();
  const mockGetAssignedUserCountsByAdministrationIds = vi.fn();
  const mockGetRunStatsByAdministrationIds = vi.fn();

  const mockListAll = vi.fn();
  const mockGetById = vi.fn();
  const mockGetByIdAuthorized = vi.fn();
  const mockGetDistrictsByAdministrationId = vi.fn();
  const mockGetDistrictsByAdministrationIdAuthorized = vi.fn();
  const mockGetSchoolsByAdministrationId = vi.fn();
  const mockGetSchoolsByAdministrationIdAuthorized = vi.fn();
  const mockGetClassesByAdministrationId = vi.fn();
  const mockGetClassesByAdministrationIdAuthorized = vi.fn();
  const mockGetGroupsByAdministrationId = vi.fn();
  const mockGetGroupsByAdministrationIdAuthorized = vi.fn();
  const mockGetTaskVariantsByAdministrationId = vi.fn();
  const mockGetUserRolesForAdministration = vi.fn();
  const mockGetAgreementsByAdministrationId = vi.fn();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockAdministrationRepository: any = {
    listAuthorized: mockListAuthorized,
    listAll: mockListAll,
    getAll: mockGetAll,
    getById: mockGetById,
    getAuthorizedById: mockGetByIdAuthorized,
    getAssignedUserCountsByAdministrationIds: mockGetAssignedUserCountsByAdministrationIds,
    getDistrictsByAdministrationId: mockGetDistrictsByAdministrationId,
    getAuthorizedDistrictsByAdministrationId: mockGetDistrictsByAdministrationIdAuthorized,
    getSchoolsByAdministrationId: mockGetSchoolsByAdministrationId,
    getAuthorizedSchoolsByAdministrationId: mockGetSchoolsByAdministrationIdAuthorized,
    getClassesByAdministrationId: mockGetClassesByAdministrationId,
    getAuthorizedClassesByAdministrationId: mockGetClassesByAdministrationIdAuthorized,
    getGroupsByAdministrationId: mockGetGroupsByAdministrationId,
    getAuthorizedGroupsByAdministrationId: mockGetGroupsByAdministrationIdAuthorized,
    getTaskVariantsByAdministrationId: mockGetTaskVariantsByAdministrationId,
    getUserRolesForAdministration: mockGetUserRolesForAdministration,
    getAgreementsByAdministrationId: mockGetAgreementsByAdministrationId,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockAdministrationTaskVariantRepository: any = {
    getByAdministrationIds: mockGetTasksByAdministrationIds,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockRunsRepository: any = {
    getRunStatsByAdministrationIds: mockGetRunStatsByAdministrationIds,
  };

  const mockUserGetById = vi.fn();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockUserRepository: any = {
    getById: mockUserGetById,
  };

  const mockEvaluateTaskVariantEligibility = vi.fn();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockTaskService: any = {
    evaluateTaskVariantEligibility: mockEvaluateTaskVariantEligibility,
  };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('list', () => {
    it('should return all administrations for super admins (unrestricted)', async () => {
      const mockAdmins = AdministrationFactory.buildList(3);
      mockListAll.mockResolvedValue({
        items: mockAdmins,
        totalItems: 3,
      });

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
      });

      const result = await service.list(
        { userId: 'admin-123', isSuperAdmin: true },
        {
          page: 1,
          perPage: 25,
          sortBy: 'createdAt',
          sortOrder: 'desc',
        },
      );

      expect(mockListAll).toHaveBeenCalledWith({
        page: 1,
        perPage: 25,
        orderBy: { field: 'createdAt', direction: 'desc' },
      });
      expect(mockListAuthorized).not.toHaveBeenCalled();
      expect(result.items).toHaveLength(3);
      expect(result.totalItems).toBe(3);
    });

    it('should use listAuthorized for non-super admin users', async () => {
      const mockAdmins = AdministrationFactory.buildList(3);

      mockListAuthorized.mockResolvedValue({
        items: mockAdmins,
        totalItems: 3,
      });

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
      });

      const result = await service.list(
        { userId: 'user-123', isSuperAdmin: false },
        {
          page: 1,
          perPage: 25,
          sortBy: 'createdAt',
          sortOrder: 'desc',
        },
      );

      expect(mockListAuthorized).toHaveBeenCalledWith(
        {
          userId: 'user-123',
          allowedRoles: expect.arrayContaining(['site_administrator', 'administrator', 'teacher', 'student']),
        },
        {
          page: 1,
          perPage: 25,
          orderBy: { field: 'createdAt', direction: 'desc' },
        },
      );
      expect(mockGetAll).not.toHaveBeenCalled();
      expect(result.items).toHaveLength(3);
      expect(result.totalItems).toBe(3);
    });

    it('should pass pagination options to repository', async () => {
      mockListAuthorized.mockResolvedValue({ items: [], totalItems: 0 });

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
      });

      await service.list(
        { userId: 'user-456', isSuperAdmin: false },
        {
          page: 3,
          perPage: 50,
          sortBy: 'dateStart',
          sortOrder: 'asc',
        },
      );

      expect(mockListAuthorized).toHaveBeenCalledWith(expect.any(Object), {
        page: 3,
        perPage: 50,
        orderBy: { field: 'dateStart', direction: 'asc' },
      });
    });

    it('should return empty results when user has no accessible administrations', async () => {
      mockListAuthorized.mockResolvedValue({ items: [], totalItems: 0 });

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
      });

      const result = await service.list(
        { userId: 'user-no-access', isSuperAdmin: false },
        {
          page: 1,
          perPage: 25,
          sortBy: 'createdAt',
          sortOrder: 'desc',
        },
      );

      expect(mockListAuthorized).toHaveBeenCalled();
      expect(result.items).toEqual([]);
      expect(result.totalItems).toBe(0);
    });

    it('should map API sort field "name" to database column "name"', async () => {
      mockListAuthorized.mockResolvedValue({ items: [], totalItems: 0 });

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
      });

      await service.list(
        { userId: 'user-123', isSuperAdmin: false },
        {
          page: 1,
          perPage: 25,
          sortBy: 'name',
          sortOrder: 'asc',
        },
      );

      expect(mockListAuthorized).toHaveBeenCalledWith(expect.any(Object), {
        page: 1,
        perPage: 25,
        orderBy: { field: 'name', direction: 'asc' },
      });
    });

    describe('status filter', () => {
      it('should pass status filter to listAll for super admins', async () => {
        const mockAdmins = AdministrationFactory.buildList(2);
        mockListAll.mockResolvedValue({ items: mockAdmins, totalItems: 2 });

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
        });

        await service.list(
          { userId: 'admin-123', isSuperAdmin: true },
          { page: 1, perPage: 25, sortBy: 'createdAt', sortOrder: 'desc', status: 'active' },
        );

        expect(mockListAll).toHaveBeenCalledWith({
          page: 1,
          perPage: 25,
          orderBy: { field: 'createdAt', direction: 'desc' },
          status: 'active',
        });
      });

      it('should pass status filter to listAuthorized for regular users', async () => {
        const mockAdmins = AdministrationFactory.buildList(2);
        mockListAuthorized.mockResolvedValue({ items: mockAdmins, totalItems: 2 });

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
        });

        await service.list(
          { userId: 'user-123', isSuperAdmin: false },
          { page: 1, perPage: 25, sortBy: 'createdAt', sortOrder: 'desc', status: 'past' },
        );

        expect(mockListAuthorized).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-123' }), {
          page: 1,
          perPage: 25,
          orderBy: { field: 'createdAt', direction: 'desc' },
          status: 'past',
        });
      });

      it('should work with status filter combined with embed=stats', async () => {
        const mockAdmins = [AdministrationFactory.build({ id: 'admin-1' })];
        mockListAll.mockResolvedValue({ items: mockAdmins, totalItems: 1 });

        const assignedCounts = new Map([['admin-1', 10]]);
        const runStats = new Map([['admin-1', { started: 5, completed: 2 }]]);
        mockGetAssignedUserCountsByAdministrationIds.mockResolvedValue(assignedCounts);
        mockGetRunStatsByAdministrationIds.mockResolvedValue(runStats);

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          runsRepository: mockRunsRepository,
        });

        const result = await service.list(
          { userId: 'admin-123', isSuperAdmin: true },
          { page: 1, perPage: 25, sortBy: 'createdAt', sortOrder: 'desc', status: 'upcoming', embed: ['stats'] },
        );

        expect(mockListAll).toHaveBeenCalledWith({
          page: 1,
          perPage: 25,
          orderBy: { field: 'createdAt', direction: 'desc' },
          status: 'upcoming',
        });
        expect(result.items[0]!.stats).toEqual({ assigned: 10, started: 5, completed: 2 });
      });
    });

    describe('embed=stats', () => {
      it('should not fetch stats for non-super-admin users even when requested', async () => {
        const mockAdmins = AdministrationFactory.buildList(2);
        mockListAuthorized.mockResolvedValue({ items: mockAdmins, totalItems: 2 });

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          runsRepository: mockRunsRepository,
        });

        const result = await service.list(
          { userId: 'user-123', isSuperAdmin: false },
          { page: 1, perPage: 25, sortBy: 'createdAt', sortOrder: 'desc', embed: ['stats'] },
        );

        expect(mockGetAssignedUserCountsByAdministrationIds).not.toHaveBeenCalled();
        expect(mockGetRunStatsByAdministrationIds).not.toHaveBeenCalled();
        expect(result.items[0]).not.toHaveProperty('stats');
      });

      it('should not fetch stats when embed option is not provided', async () => {
        const mockAdmins = AdministrationFactory.buildList(2);
        mockListAll.mockResolvedValue({ items: mockAdmins, totalItems: 2 });

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          runsRepository: mockRunsRepository,
        });

        const result = await service.list(
          { userId: 'admin-123', isSuperAdmin: true },
          { page: 1, perPage: 25, sortBy: 'createdAt', sortOrder: 'desc' },
        );

        expect(mockGetAssignedUserCountsByAdministrationIds).not.toHaveBeenCalled();
        expect(mockGetRunStatsByAdministrationIds).not.toHaveBeenCalled();
        expect(result.items[0]).not.toHaveProperty('stats');
      });

      it('should not fetch stats when embed is empty array', async () => {
        const mockAdmins = AdministrationFactory.buildList(2);
        mockListAll.mockResolvedValue({ items: mockAdmins, totalItems: 2 });

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          runsRepository: mockRunsRepository,
        });

        const result = await service.list(
          { userId: 'admin-123', isSuperAdmin: true },
          { page: 1, perPage: 25, sortBy: 'createdAt', sortOrder: 'desc', embed: [] },
        );

        expect(mockGetAssignedUserCountsByAdministrationIds).not.toHaveBeenCalled();
        expect(mockGetRunStatsByAdministrationIds).not.toHaveBeenCalled();
        expect(result.items[0]).not.toHaveProperty('stats');
      });

      it('should fetch and attach stats when embed includes stats', async () => {
        const mockAdmins = [
          AdministrationFactory.build({ id: 'admin-1' }),
          AdministrationFactory.build({ id: 'admin-2' }),
        ];
        mockListAll.mockResolvedValue({ items: mockAdmins, totalItems: 2 });

        const assignedCounts = new Map([
          ['admin-1', 25],
          ['admin-2', 50],
        ]);
        const runStats = new Map([
          ['admin-1', { started: 10, completed: 5 }],
          ['admin-2', { started: 30, completed: 20 }],
        ]);
        mockGetAssignedUserCountsByAdministrationIds.mockResolvedValue(assignedCounts);
        mockGetRunStatsByAdministrationIds.mockResolvedValue(runStats);

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          runsRepository: mockRunsRepository,
        });

        const result = await service.list(
          { userId: 'admin-123', isSuperAdmin: true },
          { page: 1, perPage: 25, sortBy: 'createdAt', sortOrder: 'desc', embed: ['stats'] },
        );

        expect(mockGetAssignedUserCountsByAdministrationIds).toHaveBeenCalledWith(['admin-1', 'admin-2']);
        expect(mockGetRunStatsByAdministrationIds).toHaveBeenCalledWith(['admin-1', 'admin-2']);
        expect(result.items[0]!.stats).toEqual({ assigned: 25, started: 10, completed: 5 });
        expect(result.items[1]!.stats).toEqual({ assigned: 50, started: 30, completed: 20 });
      });

      it('should default to zero stats for administrations with no data', async () => {
        const mockAdmins = [
          AdministrationFactory.build({ id: 'admin-1' }),
          AdministrationFactory.build({ id: 'admin-2' }),
        ];
        mockListAll.mockResolvedValue({ items: mockAdmins, totalItems: 2 });

        // Only admin-1 has data
        const assignedCounts = new Map([['admin-1', 10]]);
        const runStats = new Map([['admin-1', { started: 5, completed: 2 }]]);
        mockGetAssignedUserCountsByAdministrationIds.mockResolvedValue(assignedCounts);
        mockGetRunStatsByAdministrationIds.mockResolvedValue(runStats);

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          runsRepository: mockRunsRepository,
        });

        const result = await service.list(
          { userId: 'admin-123', isSuperAdmin: true },
          { page: 1, perPage: 25, sortBy: 'createdAt', sortOrder: 'desc', embed: ['stats'] },
        );

        expect(result.items[0]!.stats).toEqual({ assigned: 10, started: 5, completed: 2 });
        expect(result.items[1]!.stats).toEqual({ assigned: 0, started: 0, completed: 0 });
      });

      it('should fetch stats in parallel', async () => {
        const mockAdmins = [AdministrationFactory.build({ id: 'admin-1' })];
        mockListAll.mockResolvedValue({ items: mockAdmins, totalItems: 1 });

        // Track call order
        const callOrder: string[] = [];
        mockGetAssignedUserCountsByAdministrationIds.mockImplementation(async () => {
          callOrder.push('assigned-start');
          await new Promise((r) => setTimeout(r, 10));
          callOrder.push('assigned-end');
          return new Map([['admin-1', 10]]);
        });
        mockGetRunStatsByAdministrationIds.mockImplementation(async () => {
          callOrder.push('runs-start');
          await new Promise((r) => setTimeout(r, 10));
          callOrder.push('runs-end');
          return new Map([['admin-1', { started: 5, completed: 2 }]]);
        });

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          runsRepository: mockRunsRepository,
        });

        await service.list(
          { userId: 'admin-123', isSuperAdmin: true },
          { page: 1, perPage: 25, sortBy: 'createdAt', sortOrder: 'desc', embed: ['stats'] },
        );

        // Both should start before either ends (parallel execution)
        expect(callOrder.indexOf('assigned-start')).toBeLessThan(callOrder.indexOf('assigned-end'));
        expect(callOrder.indexOf('runs-start')).toBeLessThan(callOrder.indexOf('runs-end'));
        // Both starts should happen before both ends (proving parallelism)
        const startsBeforeEnds =
          callOrder.indexOf('assigned-start') < callOrder.indexOf('runs-end') &&
          callOrder.indexOf('runs-start') < callOrder.indexOf('assigned-end');
        expect(startsBeforeEnds).toBe(true);
      });

      it('should not fetch stats when result is empty', async () => {
        mockListAll.mockResolvedValue({ items: [], totalItems: 0 });

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          runsRepository: mockRunsRepository,
        });

        const result = await service.list(
          { userId: 'admin-123', isSuperAdmin: true },
          { page: 1, perPage: 25, sortBy: 'createdAt', sortOrder: 'desc', embed: ['stats'] },
        );

        expect(mockGetAssignedUserCountsByAdministrationIds).not.toHaveBeenCalled();
        expect(mockGetRunStatsByAdministrationIds).not.toHaveBeenCalled();
        expect(result.items).toEqual([]);
      });

      it('should throw ApiError when assigned counts query fails', async () => {
        const mockAdmins = [AdministrationFactory.build({ id: 'admin-1' })];
        mockListAll.mockResolvedValue({ items: mockAdmins, totalItems: 1 });

        const dbError = new Error('Database connection failed');
        mockGetAssignedUserCountsByAdministrationIds.mockRejectedValue(dbError);
        mockGetRunStatsByAdministrationIds.mockResolvedValue(new Map([['admin-1', { started: 5, completed: 2 }]]));

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          runsRepository: mockRunsRepository,
        });

        await expect(
          service.list(
            { userId: 'admin-123', isSuperAdmin: true },
            { page: 1, perPage: 25, sortBy: 'createdAt', sortOrder: 'desc', embed: ['stats'] },
          ),
        ).rejects.toThrow('Failed to fetch administration stats');
      });

      it('should throw ApiError when run stats query fails', async () => {
        const mockAdmins = [AdministrationFactory.build({ id: 'admin-1' })];
        mockListAll.mockResolvedValue({ items: mockAdmins, totalItems: 1 });

        const dbError = new Error('Assessment DB timeout');
        mockGetAssignedUserCountsByAdministrationIds.mockResolvedValue(new Map([['admin-1', 25]]));
        mockGetRunStatsByAdministrationIds.mockRejectedValue(dbError);

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          runsRepository: mockRunsRepository,
        });

        await expect(
          service.list(
            { userId: 'admin-123', isSuperAdmin: true },
            { page: 1, perPage: 25, sortBy: 'createdAt', sortOrder: 'desc', embed: ['stats'] },
          ),
        ).rejects.toThrow('Failed to fetch administration stats');
      });
    });

    describe('embed=tasks', () => {
      it('should not fetch tasks when embed option is not provided', async () => {
        const mockAdmins = AdministrationFactory.buildList(2);
        mockListAll.mockResolvedValue({ items: mockAdmins, totalItems: 2 });

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          administrationTaskVariantRepository: mockAdministrationTaskVariantRepository,
        });

        const result = await service.list(
          { userId: 'admin-123', isSuperAdmin: true },
          { page: 1, perPage: 25, sortBy: 'createdAt', sortOrder: 'desc' },
        );

        expect(mockGetTasksByAdministrationIds).not.toHaveBeenCalled();
        expect(result.items[0]).not.toHaveProperty('tasks');
      });

      it('should fetch and attach tasks when embed includes tasks', async () => {
        const mockAdmins = [
          AdministrationFactory.build({ id: 'admin-1' }),
          AdministrationFactory.build({ id: 'admin-2' }),
        ];
        mockListAll.mockResolvedValue({ items: mockAdmins, totalItems: 2 });

        const tasksMap = new Map([
          [
            'admin-1',
            [
              { taskId: 'task-1', taskName: 'SWR', variantId: 'variant-1', variantName: 'Variant A', orderIndex: 0 },
              { taskId: 'task-2', taskName: 'PA', variantId: 'variant-2', variantName: null, orderIndex: 1 },
            ],
          ],
          [
            'admin-2',
            [{ taskId: 'task-3', taskName: 'SRE', variantId: 'variant-3', variantName: 'Variant C', orderIndex: 0 }],
          ],
        ]);
        mockGetTasksByAdministrationIds.mockResolvedValue(tasksMap);

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          administrationTaskVariantRepository: mockAdministrationTaskVariantRepository,
        });

        const result = await service.list(
          { userId: 'admin-123', isSuperAdmin: true },
          { page: 1, perPage: 25, sortBy: 'createdAt', sortOrder: 'desc', embed: ['tasks'] },
        );

        expect(mockGetTasksByAdministrationIds).toHaveBeenCalledWith(['admin-1', 'admin-2']);
        expect(result.items[0]!.tasks).toEqual([
          { taskId: 'task-1', taskName: 'SWR', variantId: 'variant-1', variantName: 'Variant A', orderIndex: 0 },
          { taskId: 'task-2', taskName: 'PA', variantId: 'variant-2', variantName: null, orderIndex: 1 },
        ]);
        expect(result.items[1]!.tasks).toEqual([
          { taskId: 'task-3', taskName: 'SRE', variantId: 'variant-3', variantName: 'Variant C', orderIndex: 0 },
        ]);
      });

      it('should return empty array for administrations with no tasks', async () => {
        const mockAdmins = [
          AdministrationFactory.build({ id: 'admin-1' }),
          AdministrationFactory.build({ id: 'admin-2' }),
        ];
        mockListAll.mockResolvedValue({ items: mockAdmins, totalItems: 2 });

        // Only admin-1 has tasks
        const tasksMap = new Map([
          [
            'admin-1',
            [{ taskId: 'task-1', taskName: 'SWR', variantId: 'variant-1', variantName: 'Variant A', orderIndex: 0 }],
          ],
        ]);
        mockGetTasksByAdministrationIds.mockResolvedValue(tasksMap);

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          administrationTaskVariantRepository: mockAdministrationTaskVariantRepository,
        });

        const result = await service.list(
          { userId: 'admin-123', isSuperAdmin: true },
          { page: 1, perPage: 25, sortBy: 'createdAt', sortOrder: 'desc', embed: ['tasks'] },
        );

        expect(result.items[0]!.tasks).toHaveLength(1);
        expect(result.items[1]!.tasks).toEqual([]);
      });

      it('should throw ApiError when tasks query fails', async () => {
        const mockAdmins = [AdministrationFactory.build({ id: 'admin-1' })];
        mockListAll.mockResolvedValue({ items: mockAdmins, totalItems: 1 });

        const dbError = new Error('Database error');
        mockGetTasksByAdministrationIds.mockRejectedValue(dbError);

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          administrationTaskVariantRepository: mockAdministrationTaskVariantRepository,
        });

        await expect(
          service.list(
            { userId: 'admin-123', isSuperAdmin: true },
            { page: 1, perPage: 25, sortBy: 'createdAt', sortOrder: 'desc', embed: ['tasks'] },
          ),
        ).rejects.toThrow('Failed to fetch administration tasks');
      });

      it('should not fetch tasks when result is empty', async () => {
        mockListAll.mockResolvedValue({ items: [], totalItems: 0 });

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          administrationTaskVariantRepository: mockAdministrationTaskVariantRepository,
        });

        const result = await service.list(
          { userId: 'admin-123', isSuperAdmin: true },
          { page: 1, perPage: 25, sortBy: 'createdAt', sortOrder: 'desc', embed: ['tasks'] },
        );

        expect(mockGetTasksByAdministrationIds).not.toHaveBeenCalled();
        expect(result.items).toEqual([]);
      });
    });

    describe('embed=stats,tasks (combined)', () => {
      it('should fetch both stats and tasks when both are requested', async () => {
        const mockAdmins = [AdministrationFactory.build({ id: 'admin-1' })];
        mockListAll.mockResolvedValue({ items: mockAdmins, totalItems: 1 });

        const assignedCounts = new Map([['admin-1', 25]]);
        const runStats = new Map([['admin-1', { started: 10, completed: 5 }]]);
        const tasksMap = new Map([
          [
            'admin-1',
            [{ taskId: 'task-1', taskName: 'SWR', variantId: 'variant-1', variantName: 'Variant A', orderIndex: 0 }],
          ],
        ]);

        mockGetAssignedUserCountsByAdministrationIds.mockResolvedValue(assignedCounts);
        mockGetRunStatsByAdministrationIds.mockResolvedValue(runStats);
        mockGetTasksByAdministrationIds.mockResolvedValue(tasksMap);

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          administrationTaskVariantRepository: mockAdministrationTaskVariantRepository,
          runsRepository: mockRunsRepository,
        });

        const result = await service.list(
          { userId: 'admin-123', isSuperAdmin: true },
          { page: 1, perPage: 25, sortBy: 'createdAt', sortOrder: 'desc', embed: ['stats', 'tasks'] },
        );

        expect(result.items[0]!.stats).toEqual({ assigned: 25, started: 10, completed: 5 });
        expect(result.items[0]!.tasks).toEqual([
          { taskId: 'task-1', taskName: 'SWR', variantId: 'variant-1', variantName: 'Variant A', orderIndex: 0 },
        ]);
      });
    });
  });

  describe('getById', () => {
    it('should return administration for super admin (unrestricted)', async () => {
      const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
      mockGetById.mockResolvedValue(mockAdmin);

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
      });

      const result = await service.getById({ userId: 'admin-user', isSuperAdmin: true }, 'admin-123');

      expect(mockGetById).toHaveBeenCalledWith({ id: 'admin-123' });
      expect(mockGetByIdAuthorized).not.toHaveBeenCalled();
      expect(result).toEqual(mockAdmin);
    });

    it('should use getAuthorized for non-super admin users', async () => {
      const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
      mockGetById.mockResolvedValue(mockAdmin);
      mockGetByIdAuthorized.mockResolvedValue(mockAdmin);

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
      });

      const result = await service.getById({ userId: 'user-123', isSuperAdmin: false }, 'admin-123');

      expect(mockGetById).toHaveBeenCalledWith({ id: 'admin-123' });
      expect(mockGetByIdAuthorized).toHaveBeenCalledWith(
        {
          userId: 'user-123',
          allowedRoles: expect.arrayContaining(['site_administrator', 'administrator', 'teacher', 'student']),
        },
        'admin-123',
      );
      expect(result).toEqual(mockAdmin);
    });

    it('should throw not-found error when administration does not exist', async () => {
      mockGetById.mockResolvedValue(null);

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
      });

      await expect(service.getById({ userId: 'admin-user', isSuperAdmin: true }, 'non-existent-id')).rejects.toThrow(
        'Administration not found',
      );
    });

    it('should throw forbidden error when non-super admin has no access to existing administration', async () => {
      const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
      mockGetById.mockResolvedValue(mockAdmin);
      mockGetByIdAuthorized.mockResolvedValue(null);

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
      });

      await expect(service.getById({ userId: 'user-123', isSuperAdmin: false }, 'admin-123')).rejects.toThrow(
        'You do not have permission to perform this action',
      );
    });

    it('should throw not-found error for non-super admin when administration does not exist', async () => {
      mockGetById.mockResolvedValue(null);

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
      });

      await expect(service.getById({ userId: 'user-123', isSuperAdmin: false }, 'non-existent-id')).rejects.toThrow(
        'Administration not found',
      );
      expect(mockGetByIdAuthorized).not.toHaveBeenCalled();
    });

    it('should throw ApiError when database query fails', async () => {
      const dbError = new Error('Connection refused');
      mockGetById.mockRejectedValue(dbError);

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
      });

      await expect(service.getById({ userId: 'admin-user', isSuperAdmin: true }, 'admin-123')).rejects.toThrow(
        'Failed to retrieve administration',
      );
    });
  });

  describe('listDistricts', () => {
    const defaultOptions = {
      page: 1,
      perPage: 25,
      sortBy: 'name' as const,
      sortOrder: 'asc' as const,
    };

    it('should return districts for super admin (unrestricted)', async () => {
      const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
      const mockDistricts = [
        OrgFactory.build({ id: 'district-1', name: 'District A', orgType: 'district' }),
        OrgFactory.build({ id: 'district-2', name: 'District B', orgType: 'district' }),
      ];
      mockGetById.mockResolvedValue(mockAdmin);
      mockGetDistrictsByAdministrationId.mockResolvedValue({
        items: mockDistricts,
        totalItems: 2,
      });

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
      });

      const result = await service.listDistricts(
        { userId: 'admin-user', isSuperAdmin: true },
        'admin-123',
        defaultOptions,
      );

      expect(mockGetById).toHaveBeenCalledWith({ id: 'admin-123' });
      expect(mockGetByIdAuthorized).not.toHaveBeenCalled();
      expect(mockGetDistrictsByAdministrationId).toHaveBeenCalledWith('admin-123', {
        page: 1,
        perPage: 25,
        orderBy: { field: 'name', direction: 'asc' },
      });
      expect(result.items).toHaveLength(2);
      expect(result.totalItems).toBe(2);
    });

    it('should use getAuthorized for non-super admin users with supervisory roles', async () => {
      const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
      const mockDistricts = [OrgFactory.build({ id: 'district-1', name: 'District A', orgType: 'district' })];
      mockGetById.mockResolvedValue(mockAdmin);
      mockGetByIdAuthorized.mockResolvedValue(mockAdmin);
      // User has a supervisory role (teacher)
      mockGetUserRolesForAdministration.mockResolvedValue(['teacher']);
      mockGetDistrictsByAdministrationIdAuthorized.mockResolvedValue({
        items: mockDistricts,
        totalItems: 1,
      });

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
      });

      const result = await service.listDistricts(
        { userId: 'user-123', isSuperAdmin: false },
        'admin-123',
        defaultOptions,
      );

      expect(mockGetById).toHaveBeenCalledWith({ id: 'admin-123' });
      expect(mockGetByIdAuthorized).toHaveBeenCalledWith(
        {
          userId: 'user-123',
          allowedRoles: expect.arrayContaining(['site_administrator', 'administrator', 'teacher', 'student']),
        },
        'admin-123',
      );
      // Should use authorized method for non-super admin with supervisory role
      expect(mockGetDistrictsByAdministrationIdAuthorized).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-123' }),
        'admin-123',
        expect.any(Object),
      );
      expect(mockGetDistrictsByAdministrationId).not.toHaveBeenCalled();
      expect(result.items).toHaveLength(1);
    });

    it('should pass pagination and sorting options to repository', async () => {
      const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
      mockGetById.mockResolvedValue(mockAdmin);
      mockGetDistrictsByAdministrationId.mockResolvedValue({ items: [], totalItems: 0 });

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
      });

      await service.listDistricts({ userId: 'admin-user', isSuperAdmin: true }, 'admin-123', {
        page: 3,
        perPage: 50,
        sortBy: 'name',
        sortOrder: 'desc',
      });

      expect(mockGetDistrictsByAdministrationId).toHaveBeenCalledWith('admin-123', {
        page: 3,
        perPage: 50,
        orderBy: { field: 'name', direction: 'desc' },
      });
    });

    it('should return empty results when administration has no districts', async () => {
      const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
      mockGetById.mockResolvedValue(mockAdmin);
      mockGetDistrictsByAdministrationId.mockResolvedValue({ items: [], totalItems: 0 });

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
      });

      const result = await service.listDistricts(
        { userId: 'admin-user', isSuperAdmin: true },
        'admin-123',
        defaultOptions,
      );

      expect(result.items).toEqual([]);
      expect(result.totalItems).toBe(0);
    });

    it('should throw not-found error when administration does not exist', async () => {
      mockGetById.mockResolvedValue(null);

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
      });

      await expect(
        service.listDistricts({ userId: 'admin-user', isSuperAdmin: true }, 'non-existent-id', defaultOptions),
      ).rejects.toThrow('Administration not found');
      expect(mockGetDistrictsByAdministrationId).not.toHaveBeenCalled();
    });

    it('should throw forbidden error when non-super admin has no access to existing administration', async () => {
      const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
      mockGetById.mockResolvedValue(mockAdmin);
      mockGetByIdAuthorized.mockResolvedValue(null);

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
      });

      await expect(
        service.listDistricts({ userId: 'user-123', isSuperAdmin: false }, 'admin-123', defaultOptions),
      ).rejects.toThrow('You do not have permission to perform this action');
      expect(mockGetDistrictsByAdministrationId).not.toHaveBeenCalled();
    });

    it('should throw not-found error for non-super admin when administration does not exist', async () => {
      mockGetById.mockResolvedValue(null);

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
      });

      await expect(
        service.listDistricts({ userId: 'user-123', isSuperAdmin: false }, 'non-existent-id', defaultOptions),
      ).rejects.toThrow('Administration not found');
      expect(mockGetByIdAuthorized).not.toHaveBeenCalled();
      expect(mockGetDistrictsByAdministrationId).not.toHaveBeenCalled();
    });

    it('should throw ApiError when getById database query fails', async () => {
      const dbError = new Error('Connection refused');
      mockGetById.mockRejectedValue(dbError);

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
      });

      await expect(
        service.listDistricts({ userId: 'admin-user', isSuperAdmin: true }, 'admin-123', defaultOptions),
      ).rejects.toThrow('Failed to retrieve administration districts');
    });

    it('should throw ApiError when getDistrictsByAdministrationId query fails', async () => {
      const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
      mockGetById.mockResolvedValue(mockAdmin);
      mockGetDistrictsByAdministrationId.mockRejectedValue(new Error('Database timeout'));

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
      });

      await expect(
        service.listDistricts({ userId: 'admin-user', isSuperAdmin: true }, 'admin-123', defaultOptions),
      ).rejects.toThrow('Failed to retrieve administration districts');
    });

    describe('supervised role authorization', () => {
      it('should throw forbidden error when user has no roles for administration', async () => {
        const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
        mockGetById.mockResolvedValue(mockAdmin);
        mockGetByIdAuthorized.mockResolvedValue(mockAdmin);
        // Edge case: user passed verifyAdministrationAccess but has no roles (empty array)
        mockGetUserRolesForAdministration.mockResolvedValue([]);

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
        });

        await expect(
          service.listDistricts({ userId: 'user-with-no-roles', isSuperAdmin: false }, 'admin-123', defaultOptions),
        ).rejects.toThrow(ApiErrorMessage.FORBIDDEN);
        expect(mockGetDistrictsByAdministrationId).not.toHaveBeenCalled();
        expect(mockGetDistrictsByAdministrationIdAuthorized).not.toHaveBeenCalled();
      });

      it('should throw forbidden error when user only has supervised roles', async () => {
        const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
        mockGetById.mockResolvedValue(mockAdmin);
        mockGetByIdAuthorized.mockResolvedValue(mockAdmin);
        // User only has 'student' role, which is a supervised role
        mockGetUserRolesForAdministration.mockResolvedValue(['student']);

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
        });

        await expect(
          service.listDistricts({ userId: 'student-user', isSuperAdmin: false }, 'admin-123', defaultOptions),
        ).rejects.toThrow(ApiErrorMessage.FORBIDDEN);
        expect(mockGetDistrictsByAdministrationId).not.toHaveBeenCalled();
        expect(mockGetDistrictsByAdministrationIdAuthorized).not.toHaveBeenCalled();
      });

      it('should throw forbidden error when user has guardian role', async () => {
        const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
        mockGetById.mockResolvedValue(mockAdmin);
        mockGetByIdAuthorized.mockResolvedValue(mockAdmin);
        mockGetUserRolesForAdministration.mockResolvedValue(['guardian']);

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
        });

        await expect(
          service.listDistricts({ userId: 'guardian-user', isSuperAdmin: false }, 'admin-123', defaultOptions),
        ).rejects.toThrow(ApiErrorMessage.FORBIDDEN);
      });

      it('should throw forbidden error when user has parent role', async () => {
        const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
        mockGetById.mockResolvedValue(mockAdmin);
        mockGetByIdAuthorized.mockResolvedValue(mockAdmin);
        mockGetUserRolesForAdministration.mockResolvedValue(['parent']);

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
        });

        await expect(
          service.listDistricts({ userId: 'parent-user', isSuperAdmin: false }, 'admin-123', defaultOptions),
        ).rejects.toThrow(ApiErrorMessage.FORBIDDEN);
      });

      it('should throw forbidden error when user has relative role', async () => {
        const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
        mockGetById.mockResolvedValue(mockAdmin);
        mockGetByIdAuthorized.mockResolvedValue(mockAdmin);
        mockGetUserRolesForAdministration.mockResolvedValue(['relative']);

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
        });

        await expect(
          service.listDistricts({ userId: 'relative-user', isSuperAdmin: false }, 'admin-123', defaultOptions),
        ).rejects.toThrow(ApiErrorMessage.FORBIDDEN);
      });
    });

    describe('supervisory role authorization', () => {
      it('should use authorized method for teacher (supervisory role)', async () => {
        const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
        const mockDistricts = [OrgFactory.build({ id: 'district-1', orgType: 'district' })];
        mockGetById.mockResolvedValue(mockAdmin);
        mockGetByIdAuthorized.mockResolvedValue(mockAdmin);
        mockGetUserRolesForAdministration.mockResolvedValue(['teacher']);
        mockGetDistrictsByAdministrationIdAuthorized.mockResolvedValue({
          items: mockDistricts,
          totalItems: 1,
        });

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
        });

        const result = await service.listDistricts(
          { userId: 'teacher-user', isSuperAdmin: false },
          'admin-123',
          defaultOptions,
        );

        expect(mockGetDistrictsByAdministrationIdAuthorized).toHaveBeenCalledWith(
          expect.objectContaining({ userId: 'teacher-user' }),
          'admin-123',
          expect.any(Object),
        );
        expect(mockGetDistrictsByAdministrationId).not.toHaveBeenCalled();
        expect(result.items).toHaveLength(1);
      });

      it('should use authorized method for administrator (supervisory role)', async () => {
        const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
        const mockDistricts = [OrgFactory.build({ id: 'district-1', orgType: 'district' })];
        mockGetById.mockResolvedValue(mockAdmin);
        mockGetByIdAuthorized.mockResolvedValue(mockAdmin);
        mockGetUserRolesForAdministration.mockResolvedValue(['administrator']);
        mockGetDistrictsByAdministrationIdAuthorized.mockResolvedValue({
          items: mockDistricts,
          totalItems: 1,
        });

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
        });

        const result = await service.listDistricts(
          { userId: 'admin-user', isSuperAdmin: false },
          'admin-123',
          defaultOptions,
        );

        expect(mockGetDistrictsByAdministrationIdAuthorized).toHaveBeenCalled();
        expect(mockGetDistrictsByAdministrationId).not.toHaveBeenCalled();
        expect(result.items).toHaveLength(1);
      });

      it('should allow access when user has both supervised and supervisory roles', async () => {
        const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
        const mockDistricts = [OrgFactory.build({ id: 'district-1', orgType: 'district' })];
        mockGetById.mockResolvedValue(mockAdmin);
        mockGetByIdAuthorized.mockResolvedValue(mockAdmin);
        // User has both student (supervised) and teacher (supervisory) roles
        mockGetUserRolesForAdministration.mockResolvedValue(['student', 'teacher']);
        mockGetDistrictsByAdministrationIdAuthorized.mockResolvedValue({
          items: mockDistricts,
          totalItems: 1,
        });

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
        });

        const result = await service.listDistricts(
          { userId: 'multi-role-user', isSuperAdmin: false },
          'admin-123',
          defaultOptions,
        );

        // Should succeed because user has at least one supervisory role
        expect(mockGetDistrictsByAdministrationIdAuthorized).toHaveBeenCalled();
        expect(result.items).toHaveLength(1);
      });
    });
  });

  describe('listSchools', () => {
    const defaultOptions = {
      page: 1,
      perPage: 25,
      sortBy: 'name' as const,
      sortOrder: 'asc' as const,
    };

    it('should return schools for super admin (unrestricted)', async () => {
      const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
      const mockSchools = [
        OrgFactory.build({ id: 'school-1', name: 'School A', orgType: 'school' }),
        OrgFactory.build({ id: 'school-2', name: 'School B', orgType: 'school' }),
      ];
      mockGetById.mockResolvedValue(mockAdmin);
      mockGetSchoolsByAdministrationId.mockResolvedValue({
        items: mockSchools,
        totalItems: 2,
      });

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
      });

      const result = await service.listSchools(
        { userId: 'admin-user', isSuperAdmin: true },
        'admin-123',
        defaultOptions,
      );

      expect(mockGetById).toHaveBeenCalledWith({ id: 'admin-123' });
      expect(mockGetByIdAuthorized).not.toHaveBeenCalled();
      expect(mockGetSchoolsByAdministrationId).toHaveBeenCalledWith('admin-123', {
        page: 1,
        perPage: 25,
        orderBy: { field: 'name', direction: 'asc' },
      });
      expect(result.items).toHaveLength(2);
      expect(result.totalItems).toBe(2);
    });

    it('should use getAuthorized for non-super admin users with supervisory roles', async () => {
      const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
      const mockSchools = [OrgFactory.build({ id: 'school-1', name: 'School A', orgType: 'school' })];
      mockGetById.mockResolvedValue(mockAdmin);
      mockGetByIdAuthorized.mockResolvedValue(mockAdmin);
      // User has a supervisory role (teacher)
      mockGetUserRolesForAdministration.mockResolvedValue(['teacher']);
      mockGetSchoolsByAdministrationIdAuthorized.mockResolvedValue({
        items: mockSchools,
        totalItems: 1,
      });

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
      });

      const result = await service.listSchools(
        { userId: 'user-123', isSuperAdmin: false },
        'admin-123',
        defaultOptions,
      );

      expect(mockGetById).toHaveBeenCalledWith({ id: 'admin-123' });
      expect(mockGetByIdAuthorized).toHaveBeenCalledWith(
        {
          userId: 'user-123',
          allowedRoles: expect.arrayContaining(['site_administrator', 'administrator', 'teacher', 'student']),
        },
        'admin-123',
      );
      // Should use authorized method for non-super admin with supervisory role
      expect(mockGetSchoolsByAdministrationIdAuthorized).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-123' }),
        'admin-123',
        expect.any(Object),
      );
      expect(mockGetSchoolsByAdministrationId).not.toHaveBeenCalled();
      expect(result.items).toHaveLength(1);
    });

    it('should pass pagination and sorting options to repository', async () => {
      const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
      mockGetById.mockResolvedValue(mockAdmin);
      mockGetSchoolsByAdministrationId.mockResolvedValue({ items: [], totalItems: 0 });

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
      });

      await service.listSchools({ userId: 'admin-user', isSuperAdmin: true }, 'admin-123', {
        page: 3,
        perPage: 50,
        sortBy: 'name',
        sortOrder: 'desc',
      });

      expect(mockGetSchoolsByAdministrationId).toHaveBeenCalledWith('admin-123', {
        page: 3,
        perPage: 50,
        orderBy: { field: 'name', direction: 'desc' },
      });
    });

    it('should return empty results when administration has no schools', async () => {
      const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
      mockGetById.mockResolvedValue(mockAdmin);
      mockGetSchoolsByAdministrationId.mockResolvedValue({ items: [], totalItems: 0 });

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
      });

      const result = await service.listSchools(
        { userId: 'admin-user', isSuperAdmin: true },
        'admin-123',
        defaultOptions,
      );

      expect(result.items).toEqual([]);
      expect(result.totalItems).toBe(0);
    });

    it('should throw not-found error when administration does not exist', async () => {
      mockGetById.mockResolvedValue(null);

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
      });

      await expect(
        service.listSchools({ userId: 'admin-user', isSuperAdmin: true }, 'non-existent-id', defaultOptions),
      ).rejects.toThrow('Administration not found');
      expect(mockGetSchoolsByAdministrationId).not.toHaveBeenCalled();
    });

    it('should throw forbidden error when non-super admin has no access to existing administration', async () => {
      const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
      mockGetById.mockResolvedValue(mockAdmin);
      mockGetByIdAuthorized.mockResolvedValue(null);

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
      });

      await expect(
        service.listSchools({ userId: 'user-123', isSuperAdmin: false }, 'admin-123', defaultOptions),
      ).rejects.toThrow('You do not have permission to perform this action');
      expect(mockGetSchoolsByAdministrationId).not.toHaveBeenCalled();
    });

    it('should throw not-found error for non-super admin when administration does not exist', async () => {
      mockGetById.mockResolvedValue(null);

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
      });

      await expect(
        service.listSchools({ userId: 'user-123', isSuperAdmin: false }, 'non-existent-id', defaultOptions),
      ).rejects.toThrow('Administration not found');
      expect(mockGetByIdAuthorized).not.toHaveBeenCalled();
      expect(mockGetSchoolsByAdministrationId).not.toHaveBeenCalled();
    });

    it('should throw ApiError when getById database query fails', async () => {
      const dbError = new Error('Connection refused');
      mockGetById.mockRejectedValue(dbError);

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
      });

      await expect(
        service.listSchools({ userId: 'admin-user', isSuperAdmin: true }, 'admin-123', defaultOptions),
      ).rejects.toThrow('Failed to retrieve administration schools');
    });

    it('should throw ApiError when getSchoolsByAdministrationId query fails', async () => {
      const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
      mockGetById.mockResolvedValue(mockAdmin);
      mockGetSchoolsByAdministrationId.mockRejectedValue(new Error('Database timeout'));

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
      });

      await expect(
        service.listSchools({ userId: 'admin-user', isSuperAdmin: true }, 'admin-123', defaultOptions),
      ).rejects.toThrow('Failed to retrieve administration schools');
    });

    describe('supervised role authorization', () => {
      it('should throw forbidden error when user has no roles for administration', async () => {
        const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
        mockGetById.mockResolvedValue(mockAdmin);
        mockGetByIdAuthorized.mockResolvedValue(mockAdmin);
        // Edge case: user passed verifyAdministrationAccess but has no roles (empty array)
        mockGetUserRolesForAdministration.mockResolvedValue([]);

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
        });

        await expect(
          service.listSchools({ userId: 'user-with-no-roles', isSuperAdmin: false }, 'admin-123', defaultOptions),
        ).rejects.toThrow(ApiErrorMessage.FORBIDDEN);
        expect(mockGetSchoolsByAdministrationId).not.toHaveBeenCalled();
        expect(mockGetSchoolsByAdministrationIdAuthorized).not.toHaveBeenCalled();
      });

      it('should throw forbidden error when user only has supervised roles', async () => {
        const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
        mockGetById.mockResolvedValue(mockAdmin);
        mockGetByIdAuthorized.mockResolvedValue(mockAdmin);
        // User only has 'student' role, which is a supervised role
        mockGetUserRolesForAdministration.mockResolvedValue(['student']);

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
        });

        await expect(
          service.listSchools({ userId: 'student-user', isSuperAdmin: false }, 'admin-123', defaultOptions),
        ).rejects.toThrow(ApiErrorMessage.FORBIDDEN);
        expect(mockGetSchoolsByAdministrationId).not.toHaveBeenCalled();
        expect(mockGetSchoolsByAdministrationIdAuthorized).not.toHaveBeenCalled();
      });

      it('should throw forbidden error when user has guardian role', async () => {
        const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
        mockGetById.mockResolvedValue(mockAdmin);
        mockGetByIdAuthorized.mockResolvedValue(mockAdmin);
        mockGetUserRolesForAdministration.mockResolvedValue(['guardian']);

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
        });

        await expect(
          service.listSchools({ userId: 'guardian-user', isSuperAdmin: false }, 'admin-123', defaultOptions),
        ).rejects.toThrow(ApiErrorMessage.FORBIDDEN);
      });

      it('should throw forbidden error when user has parent role', async () => {
        const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
        mockGetById.mockResolvedValue(mockAdmin);
        mockGetByIdAuthorized.mockResolvedValue(mockAdmin);
        mockGetUserRolesForAdministration.mockResolvedValue(['parent']);

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
        });

        await expect(
          service.listSchools({ userId: 'parent-user', isSuperAdmin: false }, 'admin-123', defaultOptions),
        ).rejects.toThrow(ApiErrorMessage.FORBIDDEN);
      });

      it('should throw forbidden error when user has relative role', async () => {
        const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
        mockGetById.mockResolvedValue(mockAdmin);
        mockGetByIdAuthorized.mockResolvedValue(mockAdmin);
        mockGetUserRolesForAdministration.mockResolvedValue(['relative']);

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
        });

        await expect(
          service.listSchools({ userId: 'relative-user', isSuperAdmin: false }, 'admin-123', defaultOptions),
        ).rejects.toThrow(ApiErrorMessage.FORBIDDEN);
      });
    });

    describe('supervisory role authorization', () => {
      it('should use authorized method for teacher (supervisory role)', async () => {
        const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
        const mockSchools = [OrgFactory.build({ id: 'school-1', orgType: 'school' })];
        mockGetById.mockResolvedValue(mockAdmin);
        mockGetByIdAuthorized.mockResolvedValue(mockAdmin);
        mockGetUserRolesForAdministration.mockResolvedValue(['teacher']);
        mockGetSchoolsByAdministrationIdAuthorized.mockResolvedValue({
          items: mockSchools,
          totalItems: 1,
        });

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
        });

        const result = await service.listSchools(
          { userId: 'teacher-user', isSuperAdmin: false },
          'admin-123',
          defaultOptions,
        );

        expect(mockGetSchoolsByAdministrationIdAuthorized).toHaveBeenCalledWith(
          expect.objectContaining({ userId: 'teacher-user' }),
          'admin-123',
          expect.any(Object),
        );
        expect(mockGetSchoolsByAdministrationId).not.toHaveBeenCalled();
        expect(result.items).toHaveLength(1);
      });

      it('should use authorized method for administrator (supervisory role)', async () => {
        const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
        const mockSchools = [OrgFactory.build({ id: 'school-1', orgType: 'school' })];
        mockGetById.mockResolvedValue(mockAdmin);
        mockGetByIdAuthorized.mockResolvedValue(mockAdmin);
        mockGetUserRolesForAdministration.mockResolvedValue(['administrator']);
        mockGetSchoolsByAdministrationIdAuthorized.mockResolvedValue({
          items: mockSchools,
          totalItems: 1,
        });

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
        });

        const result = await service.listSchools(
          { userId: 'admin-user', isSuperAdmin: false },
          'admin-123',
          defaultOptions,
        );

        expect(mockGetSchoolsByAdministrationIdAuthorized).toHaveBeenCalled();
        expect(mockGetSchoolsByAdministrationId).not.toHaveBeenCalled();
        expect(result.items).toHaveLength(1);
      });

      it('should allow access when user has both supervised and supervisory roles', async () => {
        const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
        const mockSchools = [OrgFactory.build({ id: 'school-1', orgType: 'school' })];
        mockGetById.mockResolvedValue(mockAdmin);
        mockGetByIdAuthorized.mockResolvedValue(mockAdmin);
        // User has both student (supervised) and teacher (supervisory) roles
        mockGetUserRolesForAdministration.mockResolvedValue(['student', 'teacher']);
        mockGetSchoolsByAdministrationIdAuthorized.mockResolvedValue({
          items: mockSchools,
          totalItems: 1,
        });

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
        });

        const result = await service.listSchools(
          { userId: 'multi-role-user', isSuperAdmin: false },
          'admin-123',
          defaultOptions,
        );

        // Should succeed because user has at least one supervisory role
        expect(mockGetSchoolsByAdministrationIdAuthorized).toHaveBeenCalled();
        expect(result.items).toHaveLength(1);
      });
    });
  });

  describe('listClasses', () => {
    const defaultOptions = {
      page: 1,
      perPage: 25,
      sortBy: 'name' as const,
      sortOrder: 'asc' as const,
    };

    it('should return classes for super admin (unrestricted)', async () => {
      const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
      const mockClasses = [
        ClassFactory.build({ id: 'class-1', name: 'Class A' }),
        ClassFactory.build({ id: 'class-2', name: 'Class B' }),
      ];
      mockGetById.mockResolvedValue(mockAdmin);
      mockGetClassesByAdministrationId.mockResolvedValue({
        items: mockClasses,
        totalItems: 2,
      });

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
      });

      const result = await service.listClasses(
        { userId: 'admin-user', isSuperAdmin: true },
        'admin-123',
        defaultOptions,
      );

      expect(mockGetById).toHaveBeenCalledWith({ id: 'admin-123' });
      expect(mockGetByIdAuthorized).not.toHaveBeenCalled();
      expect(mockGetClassesByAdministrationId).toHaveBeenCalledWith('admin-123', {
        page: 1,
        perPage: 25,
        orderBy: { field: 'name', direction: 'asc' },
      });
      expect(result.items).toHaveLength(2);
      expect(result.totalItems).toBe(2);
    });

    it('should use getAuthorized for non-super admin users with supervisory roles', async () => {
      const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
      const mockClasses = [ClassFactory.build({ id: 'class-1', name: 'Class A' })];
      mockGetById.mockResolvedValue(mockAdmin);
      mockGetByIdAuthorized.mockResolvedValue(mockAdmin);
      // User has a supervisory role (teacher)
      mockGetUserRolesForAdministration.mockResolvedValue(['teacher']);
      mockGetClassesByAdministrationIdAuthorized.mockResolvedValue({
        items: mockClasses,
        totalItems: 1,
      });

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
      });

      const result = await service.listClasses(
        { userId: 'user-123', isSuperAdmin: false },
        'admin-123',
        defaultOptions,
      );

      expect(mockGetById).toHaveBeenCalledWith({ id: 'admin-123' });
      expect(mockGetByIdAuthorized).toHaveBeenCalledWith(
        {
          userId: 'user-123',
          allowedRoles: expect.arrayContaining(['site_administrator', 'administrator', 'teacher', 'student']),
        },
        'admin-123',
      );
      // Should use authorized method for non-super admin with supervisory role
      expect(mockGetClassesByAdministrationIdAuthorized).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-123' }),
        'admin-123',
        expect.any(Object),
      );
      expect(mockGetClassesByAdministrationId).not.toHaveBeenCalled();
      expect(result.items).toHaveLength(1);
    });

    it('should pass pagination and sorting options to repository', async () => {
      const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
      mockGetById.mockResolvedValue(mockAdmin);
      mockGetClassesByAdministrationId.mockResolvedValue({ items: [], totalItems: 0 });

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
      });

      await service.listClasses({ userId: 'admin-user', isSuperAdmin: true }, 'admin-123', {
        page: 3,
        perPage: 50,
        sortBy: 'name',
        sortOrder: 'desc',
      });

      expect(mockGetClassesByAdministrationId).toHaveBeenCalledWith('admin-123', {
        page: 3,
        perPage: 50,
        orderBy: { field: 'name', direction: 'desc' },
      });
    });

    it('should return empty results when administration has no classes', async () => {
      const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
      mockGetById.mockResolvedValue(mockAdmin);
      mockGetClassesByAdministrationId.mockResolvedValue({ items: [], totalItems: 0 });

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
      });

      const result = await service.listClasses(
        { userId: 'admin-user', isSuperAdmin: true },
        'admin-123',
        defaultOptions,
      );

      expect(result.items).toEqual([]);
      expect(result.totalItems).toBe(0);
    });

    it('should throw not-found error when administration does not exist', async () => {
      mockGetById.mockResolvedValue(null);

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
      });

      await expect(
        service.listClasses({ userId: 'admin-user', isSuperAdmin: true }, 'non-existent-id', defaultOptions),
      ).rejects.toThrow('Administration not found');
      expect(mockGetClassesByAdministrationId).not.toHaveBeenCalled();
    });

    it('should throw forbidden error when non-super admin has no access to existing administration', async () => {
      const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
      mockGetById.mockResolvedValue(mockAdmin);
      mockGetByIdAuthorized.mockResolvedValue(null);

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
      });

      await expect(
        service.listClasses({ userId: 'user-123', isSuperAdmin: false }, 'admin-123', defaultOptions),
      ).rejects.toThrow('You do not have permission to perform this action');
      expect(mockGetClassesByAdministrationId).not.toHaveBeenCalled();
    });

    it('should throw not-found error for non-super admin when administration does not exist', async () => {
      mockGetById.mockResolvedValue(null);

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
      });

      await expect(
        service.listClasses({ userId: 'user-123', isSuperAdmin: false }, 'non-existent-id', defaultOptions),
      ).rejects.toThrow('Administration not found');
      expect(mockGetByIdAuthorized).not.toHaveBeenCalled();
      expect(mockGetClassesByAdministrationId).not.toHaveBeenCalled();
    });

    it('should throw ApiError when getById database query fails', async () => {
      const dbError = new Error('Connection refused');
      mockGetById.mockRejectedValue(dbError);

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
      });

      await expect(
        service.listClasses({ userId: 'admin-user', isSuperAdmin: true }, 'admin-123', defaultOptions),
      ).rejects.toThrow('Failed to retrieve administration classes');
    });

    it('should throw ApiError when getClassesByAdministrationId query fails', async () => {
      const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
      mockGetById.mockResolvedValue(mockAdmin);
      mockGetClassesByAdministrationId.mockRejectedValue(new Error('Database timeout'));

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
      });

      await expect(
        service.listClasses({ userId: 'admin-user', isSuperAdmin: true }, 'admin-123', defaultOptions),
      ).rejects.toThrow('Failed to retrieve administration classes');
    });

    describe('supervised role authorization', () => {
      it('should throw forbidden error when user has no roles for administration', async () => {
        const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
        mockGetById.mockResolvedValue(mockAdmin);
        mockGetByIdAuthorized.mockResolvedValue(mockAdmin);
        // Edge case: user passed verifyAdministrationAccess but has no roles (empty array)
        mockGetUserRolesForAdministration.mockResolvedValue([]);

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
        });

        await expect(
          service.listClasses({ userId: 'user-with-no-roles', isSuperAdmin: false }, 'admin-123', defaultOptions),
        ).rejects.toThrow(ApiErrorMessage.FORBIDDEN);
        expect(mockGetClassesByAdministrationId).not.toHaveBeenCalled();
        expect(mockGetClassesByAdministrationIdAuthorized).not.toHaveBeenCalled();
      });

      it('should throw forbidden error when user only has supervised roles', async () => {
        const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
        mockGetById.mockResolvedValue(mockAdmin);
        mockGetByIdAuthorized.mockResolvedValue(mockAdmin);
        // User only has 'student' role, which is a supervised role
        mockGetUserRolesForAdministration.mockResolvedValue(['student']);

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
        });

        await expect(
          service.listClasses({ userId: 'student-user', isSuperAdmin: false }, 'admin-123', defaultOptions),
        ).rejects.toThrow(ApiErrorMessage.FORBIDDEN);
        expect(mockGetClassesByAdministrationId).not.toHaveBeenCalled();
        expect(mockGetClassesByAdministrationIdAuthorized).not.toHaveBeenCalled();
      });

      it('should throw forbidden error when user has guardian role', async () => {
        const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
        mockGetById.mockResolvedValue(mockAdmin);
        mockGetByIdAuthorized.mockResolvedValue(mockAdmin);
        mockGetUserRolesForAdministration.mockResolvedValue(['guardian']);

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
        });

        await expect(
          service.listClasses({ userId: 'guardian-user', isSuperAdmin: false }, 'admin-123', defaultOptions),
        ).rejects.toThrow(ApiErrorMessage.FORBIDDEN);
      });

      it('should throw forbidden error when user has parent role', async () => {
        const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
        mockGetById.mockResolvedValue(mockAdmin);
        mockGetByIdAuthorized.mockResolvedValue(mockAdmin);
        mockGetUserRolesForAdministration.mockResolvedValue(['parent']);

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
        });

        await expect(
          service.listClasses({ userId: 'parent-user', isSuperAdmin: false }, 'admin-123', defaultOptions),
        ).rejects.toThrow(ApiErrorMessage.FORBIDDEN);
      });

      it('should throw forbidden error when user has relative role', async () => {
        const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
        mockGetById.mockResolvedValue(mockAdmin);
        mockGetByIdAuthorized.mockResolvedValue(mockAdmin);
        mockGetUserRolesForAdministration.mockResolvedValue(['relative']);

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
        });

        await expect(
          service.listClasses({ userId: 'relative-user', isSuperAdmin: false }, 'admin-123', defaultOptions),
        ).rejects.toThrow(ApiErrorMessage.FORBIDDEN);
      });
    });

    describe('supervisory role authorization', () => {
      it('should use authorized method for teacher (supervisory role)', async () => {
        const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
        const mockClasses = [ClassFactory.build({ id: 'class-1' })];
        mockGetById.mockResolvedValue(mockAdmin);
        mockGetByIdAuthorized.mockResolvedValue(mockAdmin);
        mockGetUserRolesForAdministration.mockResolvedValue(['teacher']);
        mockGetClassesByAdministrationIdAuthorized.mockResolvedValue({
          items: mockClasses,
          totalItems: 1,
        });

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
        });

        const result = await service.listClasses(
          { userId: 'teacher-user', isSuperAdmin: false },
          'admin-123',
          defaultOptions,
        );

        expect(mockGetClassesByAdministrationIdAuthorized).toHaveBeenCalledWith(
          expect.objectContaining({ userId: 'teacher-user' }),
          'admin-123',
          expect.any(Object),
        );
        expect(mockGetClassesByAdministrationId).not.toHaveBeenCalled();
        expect(result.items).toHaveLength(1);
      });

      it('should use authorized method for administrator (supervisory role)', async () => {
        const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
        const mockClasses = [ClassFactory.build({ id: 'class-1' })];
        mockGetById.mockResolvedValue(mockAdmin);
        mockGetByIdAuthorized.mockResolvedValue(mockAdmin);
        mockGetUserRolesForAdministration.mockResolvedValue(['administrator']);
        mockGetClassesByAdministrationIdAuthorized.mockResolvedValue({
          items: mockClasses,
          totalItems: 1,
        });

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
        });

        const result = await service.listClasses(
          { userId: 'admin-user', isSuperAdmin: false },
          'admin-123',
          defaultOptions,
        );

        expect(mockGetClassesByAdministrationIdAuthorized).toHaveBeenCalled();
        expect(mockGetClassesByAdministrationId).not.toHaveBeenCalled();
        expect(result.items).toHaveLength(1);
      });

      it('should allow access when user has both supervised and supervisory roles', async () => {
        const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
        const mockClasses = [ClassFactory.build({ id: 'class-1' })];
        mockGetById.mockResolvedValue(mockAdmin);
        mockGetByIdAuthorized.mockResolvedValue(mockAdmin);
        // User has both student (supervised) and teacher (supervisory) roles
        mockGetUserRolesForAdministration.mockResolvedValue(['student', 'teacher']);
        mockGetClassesByAdministrationIdAuthorized.mockResolvedValue({
          items: mockClasses,
          totalItems: 1,
        });

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
        });

        const result = await service.listClasses(
          { userId: 'multi-role-user', isSuperAdmin: false },
          'admin-123',
          defaultOptions,
        );

        // Should succeed because user has at least one supervisory role
        expect(mockGetClassesByAdministrationIdAuthorized).toHaveBeenCalled();
        expect(result.items).toHaveLength(1);
      });
    });
  });

  describe('listGroups', () => {
    const defaultOptions = {
      page: 1,
      perPage: 25,
      sortBy: 'name' as const,
      sortOrder: 'asc' as const,
    };

    it('should return groups for super admin (unrestricted)', async () => {
      const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
      const mockGroups = [
        GroupFactory.build({ id: 'group-1', name: 'Group A' }),
        GroupFactory.build({ id: 'group-2', name: 'Group B' }),
      ];
      mockGetById.mockResolvedValue(mockAdmin);
      mockGetGroupsByAdministrationId.mockResolvedValue({
        items: mockGroups,
        totalItems: 2,
      });

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
      });

      const result = await service.listGroups(
        { userId: 'admin-user', isSuperAdmin: true },
        'admin-123',
        defaultOptions,
      );

      expect(mockGetById).toHaveBeenCalledWith({ id: 'admin-123' });
      expect(mockGetByIdAuthorized).not.toHaveBeenCalled();
      expect(mockGetGroupsByAdministrationId).toHaveBeenCalledWith('admin-123', {
        page: 1,
        perPage: 25,
        orderBy: { field: 'name', direction: 'asc' },
      });
      expect(result.items).toHaveLength(2);
      expect(result.totalItems).toBe(2);
    });

    it('should use getAuthorized for non-super admin users with supervisory roles', async () => {
      const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
      const mockGroups = [GroupFactory.build({ id: 'group-1', name: 'Group A' })];
      mockGetById.mockResolvedValue(mockAdmin);
      mockGetByIdAuthorized.mockResolvedValue(mockAdmin);
      // User has a supervisory role (teacher)
      mockGetUserRolesForAdministration.mockResolvedValue(['teacher']);
      mockGetGroupsByAdministrationIdAuthorized.mockResolvedValue({
        items: mockGroups,
        totalItems: 1,
      });

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
      });

      const result = await service.listGroups({ userId: 'user-123', isSuperAdmin: false }, 'admin-123', defaultOptions);

      expect(mockGetById).toHaveBeenCalledWith({ id: 'admin-123' });
      expect(mockGetByIdAuthorized).toHaveBeenCalledWith(
        {
          userId: 'user-123',
          allowedRoles: expect.arrayContaining(['site_administrator', 'administrator', 'teacher', 'student']),
        },
        'admin-123',
      );
      // Should use authorized method for non-super admin with supervisory role
      expect(mockGetGroupsByAdministrationIdAuthorized).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-123' }),
        'admin-123',
        expect.any(Object),
      );
      expect(mockGetGroupsByAdministrationId).not.toHaveBeenCalled();
      expect(result.items).toHaveLength(1);
    });

    it('should pass pagination and sorting options to repository', async () => {
      const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
      mockGetById.mockResolvedValue(mockAdmin);
      mockGetGroupsByAdministrationId.mockResolvedValue({ items: [], totalItems: 0 });

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
      });

      await service.listGroups({ userId: 'admin-user', isSuperAdmin: true }, 'admin-123', {
        page: 3,
        perPage: 50,
        sortBy: 'name',
        sortOrder: 'desc',
      });

      expect(mockGetGroupsByAdministrationId).toHaveBeenCalledWith('admin-123', {
        page: 3,
        perPage: 50,
        orderBy: { field: 'name', direction: 'desc' },
      });
    });

    it('should return empty results when administration has no groups', async () => {
      const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
      mockGetById.mockResolvedValue(mockAdmin);
      mockGetGroupsByAdministrationId.mockResolvedValue({ items: [], totalItems: 0 });

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
      });

      const result = await service.listGroups(
        { userId: 'admin-user', isSuperAdmin: true },
        'admin-123',
        defaultOptions,
      );

      expect(result.items).toEqual([]);
      expect(result.totalItems).toBe(0);
    });

    it('should throw not-found error when administration does not exist', async () => {
      mockGetById.mockResolvedValue(null);

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
      });

      await expect(
        service.listGroups({ userId: 'admin-user', isSuperAdmin: true }, 'non-existent-id', defaultOptions),
      ).rejects.toThrow('Administration not found');
      expect(mockGetGroupsByAdministrationId).not.toHaveBeenCalled();
    });

    it('should throw forbidden error when non-super admin has no access to existing administration', async () => {
      const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
      mockGetById.mockResolvedValue(mockAdmin);
      mockGetByIdAuthorized.mockResolvedValue(null);

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
      });

      await expect(
        service.listGroups({ userId: 'user-123', isSuperAdmin: false }, 'admin-123', defaultOptions),
      ).rejects.toThrow('You do not have permission to perform this action');
      expect(mockGetGroupsByAdministrationId).not.toHaveBeenCalled();
    });

    it('should throw not-found error for non-super admin when administration does not exist', async () => {
      mockGetById.mockResolvedValue(null);

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
      });

      await expect(
        service.listGroups({ userId: 'user-123', isSuperAdmin: false }, 'non-existent-id', defaultOptions),
      ).rejects.toThrow('Administration not found');
      expect(mockGetByIdAuthorized).not.toHaveBeenCalled();
      expect(mockGetGroupsByAdministrationId).not.toHaveBeenCalled();
    });

    it('should throw ApiError when getById database query fails', async () => {
      const dbError = new Error('Connection refused');
      mockGetById.mockRejectedValue(dbError);

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
      });

      await expect(
        service.listGroups({ userId: 'admin-user', isSuperAdmin: true }, 'admin-123', defaultOptions),
      ).rejects.toThrow('Failed to retrieve administration groups');
    });

    it('should throw ApiError when getGroupsByAdministrationId query fails', async () => {
      const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
      mockGetById.mockResolvedValue(mockAdmin);
      mockGetGroupsByAdministrationId.mockRejectedValue(new Error('Database timeout'));

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
      });

      await expect(
        service.listGroups({ userId: 'admin-user', isSuperAdmin: true }, 'admin-123', defaultOptions),
      ).rejects.toThrow('Failed to retrieve administration groups');
    });

    describe('supervised role authorization', () => {
      it('should throw forbidden error when user has no roles for administration', async () => {
        const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
        mockGetById.mockResolvedValue(mockAdmin);
        mockGetByIdAuthorized.mockResolvedValue(mockAdmin);
        // Edge case: user passed verifyAdministrationAccess but has no roles (empty array)
        mockGetUserRolesForAdministration.mockResolvedValue([]);

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
        });

        await expect(
          service.listGroups({ userId: 'user-with-no-roles', isSuperAdmin: false }, 'admin-123', defaultOptions),
        ).rejects.toThrow(ApiErrorMessage.FORBIDDEN);
        expect(mockGetGroupsByAdministrationId).not.toHaveBeenCalled();
        expect(mockGetGroupsByAdministrationIdAuthorized).not.toHaveBeenCalled();
      });

      it('should throw forbidden error when user only has supervised roles', async () => {
        const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
        mockGetById.mockResolvedValue(mockAdmin);
        mockGetByIdAuthorized.mockResolvedValue(mockAdmin);
        // User only has 'student' role, which is a supervised role
        mockGetUserRolesForAdministration.mockResolvedValue(['student']);

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
        });

        await expect(
          service.listGroups({ userId: 'student-user', isSuperAdmin: false }, 'admin-123', defaultOptions),
        ).rejects.toThrow(ApiErrorMessage.FORBIDDEN);
        expect(mockGetGroupsByAdministrationId).not.toHaveBeenCalled();
        expect(mockGetGroupsByAdministrationIdAuthorized).not.toHaveBeenCalled();
      });

      it('should throw forbidden error when user has guardian role', async () => {
        const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
        mockGetById.mockResolvedValue(mockAdmin);
        mockGetByIdAuthorized.mockResolvedValue(mockAdmin);
        mockGetUserRolesForAdministration.mockResolvedValue(['guardian']);

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
        });

        await expect(
          service.listGroups({ userId: 'guardian-user', isSuperAdmin: false }, 'admin-123', defaultOptions),
        ).rejects.toThrow(ApiErrorMessage.FORBIDDEN);
      });

      it('should throw forbidden error when user has parent role', async () => {
        const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
        mockGetById.mockResolvedValue(mockAdmin);
        mockGetByIdAuthorized.mockResolvedValue(mockAdmin);
        mockGetUserRolesForAdministration.mockResolvedValue(['parent']);

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
        });

        await expect(
          service.listGroups({ userId: 'parent-user', isSuperAdmin: false }, 'admin-123', defaultOptions),
        ).rejects.toThrow(ApiErrorMessage.FORBIDDEN);
      });

      it('should throw forbidden error when user has relative role', async () => {
        const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
        mockGetById.mockResolvedValue(mockAdmin);
        mockGetByIdAuthorized.mockResolvedValue(mockAdmin);
        mockGetUserRolesForAdministration.mockResolvedValue(['relative']);

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
        });

        await expect(
          service.listGroups({ userId: 'relative-user', isSuperAdmin: false }, 'admin-123', defaultOptions),
        ).rejects.toThrow(ApiErrorMessage.FORBIDDEN);
      });
    });

    describe('supervisory role authorization', () => {
      it('should use authorized method for teacher (supervisory role)', async () => {
        const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
        const mockGroups = [GroupFactory.build({ id: 'group-1' })];
        mockGetById.mockResolvedValue(mockAdmin);
        mockGetByIdAuthorized.mockResolvedValue(mockAdmin);
        mockGetUserRolesForAdministration.mockResolvedValue(['teacher']);
        mockGetGroupsByAdministrationIdAuthorized.mockResolvedValue({
          items: mockGroups,
          totalItems: 1,
        });

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
        });

        const result = await service.listGroups(
          { userId: 'teacher-user', isSuperAdmin: false },
          'admin-123',
          defaultOptions,
        );

        expect(mockGetGroupsByAdministrationIdAuthorized).toHaveBeenCalledWith(
          expect.objectContaining({ userId: 'teacher-user' }),
          'admin-123',
          expect.any(Object),
        );
        expect(mockGetGroupsByAdministrationId).not.toHaveBeenCalled();
        expect(result.items).toHaveLength(1);
      });

      it('should use authorized method for administrator (supervisory role)', async () => {
        const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
        const mockGroups = [GroupFactory.build({ id: 'group-1' })];
        mockGetById.mockResolvedValue(mockAdmin);
        mockGetByIdAuthorized.mockResolvedValue(mockAdmin);
        mockGetUserRolesForAdministration.mockResolvedValue(['administrator']);
        mockGetGroupsByAdministrationIdAuthorized.mockResolvedValue({
          items: mockGroups,
          totalItems: 1,
        });

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
        });

        const result = await service.listGroups(
          { userId: 'admin-user', isSuperAdmin: false },
          'admin-123',
          defaultOptions,
        );

        expect(mockGetGroupsByAdministrationIdAuthorized).toHaveBeenCalled();
        expect(mockGetGroupsByAdministrationId).not.toHaveBeenCalled();
        expect(result.items).toHaveLength(1);
      });

      it('should allow access when user has both supervised and supervisory roles', async () => {
        const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
        const mockGroups = [GroupFactory.build({ id: 'group-1' })];
        mockGetById.mockResolvedValue(mockAdmin);
        mockGetByIdAuthorized.mockResolvedValue(mockAdmin);
        // User has both student (supervised) and teacher (supervisory) roles
        mockGetUserRolesForAdministration.mockResolvedValue(['student', 'teacher']);
        mockGetGroupsByAdministrationIdAuthorized.mockResolvedValue({
          items: mockGroups,
          totalItems: 1,
        });

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
        });

        const result = await service.listGroups(
          { userId: 'multi-role-user', isSuperAdmin: false },
          'admin-123',
          defaultOptions,
        );

        // Should succeed because user has at least one supervisory role
        expect(mockGetGroupsByAdministrationIdAuthorized).toHaveBeenCalled();
        expect(result.items).toHaveLength(1);
      });
    });
  });

  describe('listTaskVariants', () => {
    const defaultOptions = {
      page: 1,
      perPage: 25,
      sortBy: 'orderIndex' as const,
      sortOrder: 'asc' as const,
    };

    const mockTaskVariants = [
      {
        variant: { id: 'variant-1', name: 'Variant A', description: 'Variant A description' },
        task: { id: 'task-1', name: 'Task One', description: 'Task One desc', image: null, tutorialVideo: null },
        assignment: { orderIndex: 0, conditionsAssignment: null, conditionsRequirements: null },
      },
      {
        variant: { id: 'variant-2', name: 'Variant B', description: null },
        task: { id: 'task-2', name: 'Task Two', description: null, image: 'img.png', tutorialVideo: 'vid.mp4' },
        assignment: { orderIndex: 1, conditionsAssignment: { grade: '3' }, conditionsRequirements: { minScore: 80 } },
      },
    ];

    it('should return task variants for super admin (unrestricted)', async () => {
      const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
      mockGetById.mockResolvedValue(mockAdmin);
      mockGetTaskVariantsByAdministrationId.mockResolvedValue({
        items: mockTaskVariants,
        totalItems: 2,
      });

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
      });

      const result = await service.listTaskVariants(
        { userId: 'admin-user', isSuperAdmin: true },
        'admin-123',
        defaultOptions,
      );

      expect(mockGetById).toHaveBeenCalledWith({ id: 'admin-123' });
      expect(mockGetByIdAuthorized).not.toHaveBeenCalled();
      // Super admin sees all variants including draft/deprecated (publishedOnly: false)
      expect(mockGetTaskVariantsByAdministrationId).toHaveBeenCalledWith(
        'admin-123',
        false, // publishedOnly
        { page: 1, perPage: 25, orderBy: { field: 'orderIndex', direction: 'asc' } },
      );
      expect(result.items).toHaveLength(2);
      expect(result.totalItems).toBe(2);
    });

    it('should return task variants for non-super admin with administration access (supervisory role)', async () => {
      const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
      mockGetById.mockResolvedValue(mockAdmin);
      mockGetByIdAuthorized.mockResolvedValue(mockAdmin);
      mockGetTaskVariantsByAdministrationId.mockResolvedValue({
        items: mockTaskVariants,
        totalItems: 2,
      });
      // Supervisory roles see all task variants without eligibility filtering
      mockGetUserRolesForAdministration.mockResolvedValue(['teacher']);

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
        userRepository: mockUserRepository,
        taskService: mockTaskService,
      });

      const result = await service.listTaskVariants(
        { userId: 'user-123', isSuperAdmin: false },
        'admin-123',
        defaultOptions,
      );

      expect(mockGetById).toHaveBeenCalledWith({ id: 'admin-123' });
      expect(mockGetByIdAuthorized).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-123' }), 'admin-123');
      // Role check is performed to determine if eligibility filtering applies
      expect(mockGetUserRolesForAdministration).toHaveBeenCalledWith('user-123', 'admin-123');
      // Supervisory roles skip eligibility filtering
      expect(mockEvaluateTaskVariantEligibility).not.toHaveBeenCalled();
      // Supervisory roles see all variants including draft/deprecated (publishedOnly: false)
      expect(mockGetTaskVariantsByAdministrationId).toHaveBeenCalledWith(
        'admin-123',
        false, // publishedOnly
        { page: 1, perPage: 25, orderBy: { field: 'orderIndex', direction: 'asc' } },
      );
      expect(result.items).toHaveLength(2);
    });

    it('should pass pagination and sorting options to repository', async () => {
      const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
      mockGetById.mockResolvedValue(mockAdmin);
      mockGetTaskVariantsByAdministrationId.mockResolvedValue({ items: [], totalItems: 0 });

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
      });

      await service.listTaskVariants({ userId: 'admin-user', isSuperAdmin: true }, 'admin-123', {
        page: 3,
        perPage: 50,
        sortBy: 'name',
        sortOrder: 'desc',
      });

      expect(mockGetTaskVariantsByAdministrationId).toHaveBeenCalledWith(
        'admin-123',
        false, // publishedOnly (super admin)
        { page: 3, perPage: 50, orderBy: { field: 'name', direction: 'desc' } },
      );
    });

    it('should return empty results when administration has no task variants', async () => {
      const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
      mockGetById.mockResolvedValue(mockAdmin);
      mockGetTaskVariantsByAdministrationId.mockResolvedValue({ items: [], totalItems: 0 });

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
      });

      const result = await service.listTaskVariants(
        { userId: 'admin-user', isSuperAdmin: true },
        'admin-123',
        defaultOptions,
      );

      expect(result.items).toEqual([]);
      expect(result.totalItems).toBe(0);
    });

    it('should throw not-found error when administration does not exist', async () => {
      mockGetById.mockResolvedValue(null);

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
      });

      await expect(
        service.listTaskVariants({ userId: 'admin-user', isSuperAdmin: true }, 'non-existent-id', defaultOptions),
      ).rejects.toThrow('Administration not found');
      expect(mockGetTaskVariantsByAdministrationId).not.toHaveBeenCalled();
    });

    it('should throw forbidden error when non-super admin has no access to existing administration', async () => {
      const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
      mockGetById.mockResolvedValue(mockAdmin);
      mockGetByIdAuthorized.mockResolvedValue(null);

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
      });

      await expect(
        service.listTaskVariants({ userId: 'user-123', isSuperAdmin: false }, 'admin-123', defaultOptions),
      ).rejects.toThrow('You do not have permission to perform this action');
      expect(mockGetTaskVariantsByAdministrationId).not.toHaveBeenCalled();
    });

    it('should throw ApiError when database query fails', async () => {
      const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
      mockGetById.mockResolvedValue(mockAdmin);
      mockGetTaskVariantsByAdministrationId.mockRejectedValue(new Error('Database timeout'));

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
      });

      await expect(
        service.listTaskVariants({ userId: 'admin-user', isSuperAdmin: true }, 'admin-123', defaultOptions),
      ).rejects.toThrow('Failed to retrieve administration task variants');
    });

    describe('role-based eligibility filtering', () => {
      // Supervisory roles (teachers, admins) see all task variants.
      // Supervised roles (students) are filtered by eligibility conditions.
      // Super admins bypass all filtering.

      it('should allow teacher to list all task variants (supervisory role - no filtering)', async () => {
        const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
        mockGetById.mockResolvedValue(mockAdmin);
        mockGetByIdAuthorized.mockResolvedValue(mockAdmin);
        mockGetTaskVariantsByAdministrationId.mockResolvedValue({
          items: mockTaskVariants,
          totalItems: 2,
        });
        mockGetUserRolesForAdministration.mockResolvedValue(['teacher']);

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          userRepository: mockUserRepository,
          taskService: mockTaskService,
        });

        const result = await service.listTaskVariants(
          { userId: 'teacher-user', isSuperAdmin: false },
          'admin-123',
          defaultOptions,
        );

        expect(mockGetUserRolesForAdministration).toHaveBeenCalledWith('teacher-user', 'admin-123');
        expect(mockEvaluateTaskVariantEligibility).not.toHaveBeenCalled();
        // Supervisory roles see all variants including draft/deprecated (publishedOnly: false)
        expect(mockGetTaskVariantsByAdministrationId).toHaveBeenCalledWith(
          'admin-123',
          false, // publishedOnly
          { page: 1, perPage: 25, orderBy: { field: 'orderIndex', direction: 'asc' } },
        );
        expect(result.items).toHaveLength(2);
      });

      it('should allow administrator to list all task variants (supervisory role - no filtering)', async () => {
        const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
        mockGetById.mockResolvedValue(mockAdmin);
        mockGetByIdAuthorized.mockResolvedValue(mockAdmin);
        mockGetTaskVariantsByAdministrationId.mockResolvedValue({
          items: mockTaskVariants,
          totalItems: 2,
        });
        mockGetUserRolesForAdministration.mockResolvedValue(['administrator']);

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          userRepository: mockUserRepository,
          taskService: mockTaskService,
        });

        const result = await service.listTaskVariants(
          { userId: 'admin-user', isSuperAdmin: false },
          'admin-123',
          defaultOptions,
        );

        expect(mockGetUserRolesForAdministration).toHaveBeenCalledWith('admin-user', 'admin-123');
        expect(mockEvaluateTaskVariantEligibility).not.toHaveBeenCalled();
        // Supervisory roles see all variants including draft/deprecated (publishedOnly: false)
        expect(mockGetTaskVariantsByAdministrationId).toHaveBeenCalledWith(
          'admin-123',
          false, // publishedOnly
          { page: 1, perPage: 25, orderBy: { field: 'orderIndex', direction: 'asc' } },
        );
        expect(result.items).toHaveLength(2);
      });

      it('should filter task variants for student based on assigned_if condition', async () => {
        const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
        const mockUser = { id: 'student-user', grade: '5' };
        mockGetById.mockResolvedValue(mockAdmin);
        mockGetByIdAuthorized.mockResolvedValue(mockAdmin);
        mockGetTaskVariantsByAdministrationId.mockResolvedValue({
          items: mockTaskVariants,
          totalItems: 2,
        });
        mockGetUserRolesForAdministration.mockResolvedValue(['student']);
        mockUserGetById.mockResolvedValue(mockUser);
        // First variant: assigned and required, Second variant: not assigned
        mockEvaluateTaskVariantEligibility
          .mockReturnValueOnce({ isAssigned: true, isOptional: false }) // First variant: visible, required
          .mockReturnValueOnce({ isAssigned: false, isOptional: false }); // Second variant: not visible

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          userRepository: mockUserRepository,
          taskService: mockTaskService,
        });

        const result = await service.listTaskVariants(
          { userId: 'student-user', isSuperAdmin: false },
          'admin-123',
          defaultOptions,
        );

        expect(mockGetUserRolesForAdministration).toHaveBeenCalledWith('student-user', 'admin-123');
        // Supervised roles (students) only see published variants (publishedOnly: true)
        expect(mockGetTaskVariantsByAdministrationId).toHaveBeenCalledWith(
          'admin-123',
          true, // publishedOnly
          { page: 1, perPage: 25, orderBy: { field: 'orderIndex', direction: 'asc' } },
        );
        expect(mockUserGetById).toHaveBeenCalledWith({ id: 'student-user' });
        // Called once per variant
        expect(mockEvaluateTaskVariantEligibility).toHaveBeenCalledTimes(2);
        expect(result.items).toHaveLength(1);
        expect(result.totalItems).toBe(1);
        // Verify optional flag is set (cast to access dynamically added property)
        expect((result.items[0]!.assignment as AssignmentWithOptional).optional).toBe(false);
      });

      it('should return empty list when student has no visible task variants (assigned_if fails for all)', async () => {
        const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
        const mockUser = { id: 'student-user', grade: '1' };
        mockGetById.mockResolvedValue(mockAdmin);
        mockGetByIdAuthorized.mockResolvedValue(mockAdmin);
        mockGetTaskVariantsByAdministrationId.mockResolvedValue({
          items: mockTaskVariants,
          totalItems: 2,
        });
        mockGetUserRolesForAdministration.mockResolvedValue(['student']);
        mockUserGetById.mockResolvedValue(mockUser);
        // assigned_if fails for all variants
        mockEvaluateTaskVariantEligibility.mockReturnValue({ isAssigned: false, isOptional: false });

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          userRepository: mockUserRepository,
          taskService: mockTaskService,
        });

        const result = await service.listTaskVariants(
          { userId: 'student-user', isSuperAdmin: false },
          'admin-123',
          defaultOptions,
        );

        expect(result.items).toHaveLength(0);
        expect(result.totalItems).toBe(0);
      });

      it('should return all task variants when student passes assigned_if for all', async () => {
        const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
        const mockUser = { id: 'student-user', grade: '5' };
        mockGetById.mockResolvedValue(mockAdmin);
        mockGetByIdAuthorized.mockResolvedValue(mockAdmin);
        mockGetTaskVariantsByAdministrationId.mockResolvedValue({
          items: mockTaskVariants,
          totalItems: 2,
        });
        mockGetUserRolesForAdministration.mockResolvedValue(['student']);
        mockUserGetById.mockResolvedValue(mockUser);
        // assigned_if passes for all, optional_if also passes (making them optional)
        mockEvaluateTaskVariantEligibility.mockReturnValue({ isAssigned: true, isOptional: true });

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          userRepository: mockUserRepository,
          taskService: mockTaskService,
        });

        const result = await service.listTaskVariants(
          { userId: 'student-user', isSuperAdmin: false },
          'admin-123',
          defaultOptions,
        );

        expect(result.items).toHaveLength(2);
        expect(result.totalItems).toBe(2);
        // All should have optional flag set based on optional_if evaluation (cast to access dynamically added property)
        expect((result.items[0]!.assignment as AssignmentWithOptional).optional).toBeDefined();
        expect((result.items[1]!.assignment as AssignmentWithOptional).optional).toBeDefined();
      });

      it('should throw error when user not found during eligibility filtering', async () => {
        const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
        mockGetById.mockResolvedValue(mockAdmin);
        mockGetByIdAuthorized.mockResolvedValue(mockAdmin);
        mockGetTaskVariantsByAdministrationId.mockResolvedValue({
          items: mockTaskVariants,
          totalItems: 2,
        });
        mockGetUserRolesForAdministration.mockResolvedValue(['student']);
        mockUserGetById.mockResolvedValue(null);

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          userRepository: mockUserRepository,
          taskService: mockTaskService,
        });

        await expect(
          service.listTaskVariants({ userId: 'non-existent-user', isSuperAdmin: false }, 'admin-123', defaultOptions),
        ).rejects.toThrow('Failed to retrieve user data for eligibility check');
      });

      it('should pass conditions to evaluateTaskVariantEligibility for eligibility and optionality evaluation', async () => {
        const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
        const mockUser = { id: 'student-user', grade: '5' };
        const assignedIfCondition = { field: 'studentData.grade', op: 'EQUAL', value: 5 };
        const optionalIfCondition = { field: 'studentData.statusEll', op: 'EQUAL', value: 'active' };
        const variantWithConditions = {
          variant: { id: 'variant-1', name: 'Test Variant' },
          task: { id: 'task-1', name: 'Test Task' },
          assignment: {
            orderIndex: 0,
            conditionsAssignment: assignedIfCondition,
            conditionsRequirements: optionalIfCondition,
          },
        };
        mockGetById.mockResolvedValue(mockAdmin);
        mockGetByIdAuthorized.mockResolvedValue(mockAdmin);
        mockGetTaskVariantsByAdministrationId.mockResolvedValue({
          items: [variantWithConditions],
          totalItems: 1,
        });
        mockGetUserRolesForAdministration.mockResolvedValue(['student']);
        mockUserGetById.mockResolvedValue(mockUser);
        // assigned and optional
        mockEvaluateTaskVariantEligibility.mockReturnValue({ isAssigned: true, isOptional: true });

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          userRepository: mockUserRepository,
          taskService: mockTaskService,
        });

        const result = await service.listTaskVariants(
          { userId: 'student-user', isSuperAdmin: false },
          'admin-123',
          defaultOptions,
        );

        // Called once with user, assigned_if, and optional_if
        expect(mockEvaluateTaskVariantEligibility).toHaveBeenCalledWith(
          mockUser,
          assignedIfCondition,
          optionalIfCondition,
        );
        // Result should have optional=true - cast to access dynamically added property
        expect((result.items[0]!.assignment as AssignmentWithOptional).optional).toBe(true);
      });

      it('should handle null conditions (null assigned_if = visible, null optional_if = required)', async () => {
        const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
        const mockUser = { id: 'student-user', grade: '5' };
        const variantWithNullConditions = {
          variant: { id: 'variant-1', name: 'Test Variant' },
          task: { id: 'task-1', name: 'Test Task' },
          assignment: {
            orderIndex: 0,
            conditionsAssignment: null,
            conditionsRequirements: null,
          },
        };
        mockGetById.mockResolvedValue(mockAdmin);
        mockGetByIdAuthorized.mockResolvedValue(mockAdmin);
        mockGetTaskVariantsByAdministrationId.mockResolvedValue({
          items: [variantWithNullConditions],
          totalItems: 1,
        });
        mockGetUserRolesForAdministration.mockResolvedValue(['student']);
        mockUserGetById.mockResolvedValue(mockUser);
        // null assigned_if = assigned to all, null optional_if = required
        mockEvaluateTaskVariantEligibility.mockReturnValue({ isAssigned: true, isOptional: false });

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          userRepository: mockUserRepository,
          taskService: mockTaskService,
        });

        const result = await service.listTaskVariants(
          { userId: 'student-user', isSuperAdmin: false },
          'admin-123',
          defaultOptions,
        );

        // Called with both null conditions
        expect(mockEvaluateTaskVariantEligibility).toHaveBeenCalledWith(mockUser, null, null);
        // Variant should be visible (null assigned_if = assigned to all)
        expect(result.items).toHaveLength(1);
        // Null optional_if means required (optional=false)
        // Cast to access dynamically added property
        expect((result.items[0]!.assignment as AssignmentWithOptional).optional).toBe(false);
      });

      it('should exclude variant and not crash when eligibility evaluation throws error (malformed condition)', async () => {
        const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
        const mockUser = { id: 'student-user', grade: '5' };
        const variantWithMalformedCondition = {
          variant: { id: 'variant-malformed', name: 'Malformed Variant' },
          task: { id: 'task-1', name: 'Test Task' },
          assignment: {
            orderIndex: 0,
            conditionsAssignment: { invalidField: 'bad data' }, // Malformed
            conditionsRequirements: null,
          },
        };
        const variantWithValidCondition = {
          variant: { id: 'variant-valid', name: 'Valid Variant' },
          task: { id: 'task-2', name: 'Test Task 2' },
          assignment: {
            orderIndex: 1,
            conditionsAssignment: null,
            conditionsRequirements: null,
          },
        };
        mockGetById.mockResolvedValue(mockAdmin);
        mockGetByIdAuthorized.mockResolvedValue(mockAdmin);
        mockGetTaskVariantsByAdministrationId.mockResolvedValue({
          items: [variantWithMalformedCondition, variantWithValidCondition],
          totalItems: 2,
        });
        mockGetUserRolesForAdministration.mockResolvedValue(['student']);
        mockUserGetById.mockResolvedValue(mockUser);
        // First call throws (malformed conditions), second call succeeds
        mockEvaluateTaskVariantEligibility
          .mockImplementationOnce(() => {
            throw new Error('Invalid condition structure');
          })
          .mockReturnValueOnce({ isAssigned: true, isOptional: false });

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          userRepository: mockUserRepository,
          taskService: mockTaskService,
        });

        const result = await service.listTaskVariants(
          { userId: 'student-user', isSuperAdmin: false },
          'admin-123',
          defaultOptions,
        );

        // Should exclude malformed variant but include valid one
        expect(result.items).toHaveLength(1);
        expect(result.items[0]!.variant.id).toBe('variant-valid');
        expect(result.totalItems).toBe(1);
      });

      it('should treat user with no roles as supervised (publishedOnly: true, eligibility filtering applied)', async () => {
        const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
        const mockUser = { id: 'no-roles-user', grade: '5' };
        mockGetById.mockResolvedValue(mockAdmin);
        mockGetByIdAuthorized.mockResolvedValue(mockAdmin);
        mockGetTaskVariantsByAdministrationId.mockResolvedValue({
          items: mockTaskVariants,
          totalItems: 2,
        });
        // User has no roles for this administration (empty array)
        mockGetUserRolesForAdministration.mockResolvedValue([]);
        mockUserGetById.mockResolvedValue(mockUser);
        mockEvaluateTaskVariantEligibility.mockReturnValue({ isAssigned: true, isOptional: false });

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          userRepository: mockUserRepository,
          taskService: mockTaskService,
        });

        const result = await service.listTaskVariants(
          { userId: 'no-roles-user', isSuperAdmin: false },
          'admin-123',
          defaultOptions,
        );

        // Should be treated as supervised: publishedOnly: true
        expect(mockGetTaskVariantsByAdministrationId).toHaveBeenCalledWith(
          'admin-123',
          true, // publishedOnly
          { page: 1, perPage: 25, orderBy: { field: 'orderIndex', direction: 'asc' } },
        );
        // Should apply eligibility filtering (like students)
        expect(mockUserGetById).toHaveBeenCalledWith({ id: 'no-roles-user' });
        expect(mockEvaluateTaskVariantEligibility).toHaveBeenCalledTimes(2);
        expect(result.items).toHaveLength(2);
      });
    });
  });

  describe('listAgreements', () => {
    const defaultAgreementOptions = {
      page: 1,
      perPage: 25,
      sortBy: 'name' as const,
      sortOrder: 'asc' as const,
      locale: 'en-US',
    };

    describe('authorization', () => {
      it('should verify administration access before returning agreements', async () => {
        const mockAdmin = AdministrationFactory.build();
        const mockAgreement = AgreementFactory.build();
        const mockVersion = AgreementVersionFactory.build({ locale: 'en-US' });

        mockGetById.mockResolvedValue(mockAdmin);
        mockGetByIdAuthorized.mockResolvedValue(mockAdmin);
        mockGetUserRolesForAdministration.mockResolvedValue(['teacher']);
        mockGetAgreementsByAdministrationId.mockResolvedValue({
          items: [{ agreement: mockAgreement, currentVersion: mockVersion }],
          totalItems: 1,
        });

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
        });

        const result = await service.listAgreements(
          { userId: 'user-123', isSuperAdmin: false },
          mockAdmin.id,
          defaultAgreementOptions,
        );

        expect(mockGetById).toHaveBeenCalledWith({ id: mockAdmin.id });
        expect(result.items).toHaveLength(1);
        expect(result.items[0]!.agreement.id).toBe(mockAgreement.id);
      });

      it('should return 404 when administration does not exist', async () => {
        mockGetById.mockResolvedValue(null);

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
        });

        await expect(
          service.listAgreements(
            { userId: 'user-123', isSuperAdmin: false },
            'nonexistent-id',
            defaultAgreementOptions,
          ),
        ).rejects.toMatchObject({
          statusCode: 404,
        });
      });

      it('should return 403 when user lacks access to administration', async () => {
        const mockAdmin = AdministrationFactory.build();
        mockGetById.mockResolvedValue(mockAdmin);
        mockGetByIdAuthorized.mockResolvedValue(null);

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
        });

        await expect(
          service.listAgreements({ userId: 'user-123', isSuperAdmin: false }, mockAdmin.id, defaultAgreementOptions),
        ).rejects.toMatchObject({
          statusCode: 403,
          message: ApiErrorMessage.FORBIDDEN,
        });
      });

      it('should skip authorization check for super admin', async () => {
        const mockAdmin = AdministrationFactory.build();
        const mockAgreement = AgreementFactory.build();
        const mockVersion = AgreementVersionFactory.build();

        mockGetById.mockResolvedValue(mockAdmin);
        mockGetAgreementsByAdministrationId.mockResolvedValue({
          items: [{ agreement: mockAgreement, currentVersion: mockVersion }],
          totalItems: 1,
        });

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
        });

        const result = await service.listAgreements(
          { userId: 'admin-123', isSuperAdmin: true },
          mockAdmin.id,
          defaultAgreementOptions,
        );

        expect(mockGetByIdAuthorized).not.toHaveBeenCalled();
        expect(result.items).toHaveLength(1);
      });
    });

    describe('data retrieval', () => {
      it('should pass correct parameters to repository', async () => {
        const mockAdmin = AdministrationFactory.build();
        mockGetById.mockResolvedValue(mockAdmin);
        mockGetAgreementsByAdministrationId.mockResolvedValue({ items: [], totalItems: 0 });

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
        });

        await service.listAgreements({ userId: 'admin-123', isSuperAdmin: true }, mockAdmin.id, {
          page: 2,
          perPage: 10,
          sortBy: 'agreementType',
          sortOrder: 'desc',
          locale: 'es',
          agreementType: 'consent',
        });

        expect(mockGetAgreementsByAdministrationId).toHaveBeenCalledWith(mockAdmin.id, {
          page: 2,
          perPage: 10,
          orderBy: {
            field: 'agreementType',
            direction: 'desc',
          },
          agreementType: 'consent',
          locale: 'es',
        });
      });

      it('should return agreements with current version', async () => {
        const mockAdmin = AdministrationFactory.build();
        const mockAgreement = AgreementFactory.build({ name: 'Test Agreement', agreementType: 'tos' });
        const mockVersion = AgreementVersionFactory.build({ locale: 'en-US', githubFilename: 'TOS.md' });

        mockGetById.mockResolvedValue(mockAdmin);
        mockGetAgreementsByAdministrationId.mockResolvedValue({
          items: [{ agreement: mockAgreement, currentVersion: mockVersion }],
          totalItems: 1,
        });

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
        });

        const result = await service.listAgreements(
          { userId: 'admin-123', isSuperAdmin: true },
          mockAdmin.id,
          defaultAgreementOptions,
        );

        expect(result.items).toHaveLength(1);
        expect(result.items[0]!.agreement.name).toBe('Test Agreement');
        expect(result.items[0]!.currentVersion).not.toBeNull();
        expect(result.items[0]!.currentVersion!.locale).toBe('en-US');
      });

      it('should return null currentVersion when no version exists for locale', async () => {
        const mockAdmin = AdministrationFactory.build();
        const mockAgreement = AgreementFactory.build();

        mockGetById.mockResolvedValue(mockAdmin);
        mockGetAgreementsByAdministrationId.mockResolvedValue({
          items: [{ agreement: mockAgreement, currentVersion: null }],
          totalItems: 1,
        });

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
        });

        const result = await service.listAgreements({ userId: 'admin-123', isSuperAdmin: true }, mockAdmin.id, {
          ...defaultAgreementOptions,
          locale: 'fr',
        });

        expect(result.items).toHaveLength(1);
        expect(result.items[0]!.currentVersion).toBeNull();
      });

      it('should return empty array when no agreements assigned', async () => {
        const mockAdmin = AdministrationFactory.build();

        mockGetById.mockResolvedValue(mockAdmin);
        mockGetAgreementsByAdministrationId.mockResolvedValue({ items: [], totalItems: 0 });

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
        });

        const result = await service.listAgreements(
          { userId: 'admin-123', isSuperAdmin: true },
          mockAdmin.id,
          defaultAgreementOptions,
        );

        expect(result.items).toEqual([]);
        expect(result.totalItems).toBe(0);
      });
    });

    describe('error handling', () => {
      it('should wrap unexpected errors with appropriate context', async () => {
        const mockAdmin = AdministrationFactory.build();
        mockGetById.mockResolvedValue(mockAdmin);
        mockGetAgreementsByAdministrationId.mockRejectedValue(new Error('Database connection lost'));

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
        });

        await expect(
          service.listAgreements({ userId: 'admin-123', isSuperAdmin: true }, mockAdmin.id, defaultAgreementOptions),
        ).rejects.toMatchObject({
          statusCode: 500,
          message: 'Failed to retrieve administration agreements',
        });
      });
    });

    describe('majority age filtering', () => {
      it('should not filter agreements for super admin', async () => {
        const mockAdmin = AdministrationFactory.build();
        const regularAgreement = AgreementFactory.build({ requiresMajorityAge: false });
        const majorityAgeAgreement = AgreementFactory.build({ requiresMajorityAge: true });

        mockGetById.mockResolvedValue(mockAdmin);
        mockGetAgreementsByAdministrationId.mockResolvedValue({
          items: [
            { agreement: regularAgreement, currentVersion: null },
            { agreement: majorityAgeAgreement, currentVersion: null },
          ],
          totalItems: 2,
        });

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
        });

        const result = await service.listAgreements(
          { userId: 'admin-123', isSuperAdmin: true },
          mockAdmin.id,
          defaultAgreementOptions,
        );

        expect(result.items).toHaveLength(2);
        expect(mockGetUserRolesForAdministration).not.toHaveBeenCalled();
      });

      it('should not filter agreements for supervisory roles (teacher)', async () => {
        const mockAdmin = AdministrationFactory.build();
        const regularAgreement = AgreementFactory.build({ requiresMajorityAge: false });
        const majorityAgeAgreement = AgreementFactory.build({ requiresMajorityAge: true });

        mockGetById.mockResolvedValue(mockAdmin);
        mockGetByIdAuthorized.mockResolvedValue(mockAdmin);
        mockGetUserRolesForAdministration.mockResolvedValue(['teacher']);
        mockGetAgreementsByAdministrationId.mockResolvedValue({
          items: [
            { agreement: regularAgreement, currentVersion: null },
            { agreement: majorityAgeAgreement, currentVersion: null },
          ],
          totalItems: 2,
        });

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
        });

        const result = await service.listAgreements(
          { userId: 'teacher-123', isSuperAdmin: false },
          mockAdmin.id,
          defaultAgreementOptions,
        );

        expect(result.items).toHaveLength(2);
      });

      it('should filter out requiresMajorityAge agreements for student under 18 (by dob)', async () => {
        const mockAdmin = AdministrationFactory.build();
        const regularAgreement = AgreementFactory.build({ requiresMajorityAge: false, name: 'Regular Agreement' });
        const majorityAgeAgreement = AgreementFactory.build({ requiresMajorityAge: true, name: 'Adult Agreement' });

        // Student born 10 years ago (under 18)
        const tenYearsAgo = new Date();
        tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10);
        const dobString = tenYearsAgo.toISOString().split('T')[0]!;
        const mockUser = UserFactory.build({ dob: dobString, grade: null });

        mockGetById.mockResolvedValue(mockAdmin);
        mockGetByIdAuthorized.mockResolvedValue(mockAdmin);
        mockGetUserRolesForAdministration.mockResolvedValue(['student']);
        mockGetAgreementsByAdministrationId.mockResolvedValue({
          items: [
            { agreement: regularAgreement, currentVersion: null },
            { agreement: majorityAgeAgreement, currentVersion: null },
          ],
          totalItems: 2,
        });
        mockUserRepository.getById.mockResolvedValue(mockUser);

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          userRepository: mockUserRepository,
        });

        const result = await service.listAgreements(
          { userId: 'student-123', isSuperAdmin: false },
          mockAdmin.id,
          defaultAgreementOptions,
        );

        expect(result.items).toHaveLength(1);
        expect(result.items[0]!.agreement.name).toBe('Regular Agreement');
        expect(result.totalItems).toBe(1);
      });

      it('should include requiresMajorityAge agreements for student 18+ (by dob)', async () => {
        const mockAdmin = AdministrationFactory.build();
        const regularAgreement = AgreementFactory.build({ requiresMajorityAge: false });
        const majorityAgeAgreement = AgreementFactory.build({ requiresMajorityAge: true });

        // Student born 20 years ago (over 18)
        const twentyYearsAgo = new Date();
        twentyYearsAgo.setFullYear(twentyYearsAgo.getFullYear() - 20);
        const dobString = twentyYearsAgo.toISOString().split('T')[0]!;
        const mockUser = UserFactory.build({ dob: dobString, grade: null });

        mockGetById.mockResolvedValue(mockAdmin);
        mockGetByIdAuthorized.mockResolvedValue(mockAdmin);
        mockGetUserRolesForAdministration.mockResolvedValue(['student']);
        mockGetAgreementsByAdministrationId.mockResolvedValue({
          items: [
            { agreement: regularAgreement, currentVersion: null },
            { agreement: majorityAgeAgreement, currentVersion: null },
          ],
          totalItems: 2,
        });
        mockUserRepository.getById.mockResolvedValue(mockUser);

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          userRepository: mockUserRepository,
        });

        const result = await service.listAgreements(
          { userId: 'adult-student-123', isSuperAdmin: false },
          mockAdmin.id,
          defaultAgreementOptions,
        );

        expect(result.items).toHaveLength(2);
      });

      it('should filter by grade when dob is not available (grade 11 = under 18)', async () => {
        const mockAdmin = AdministrationFactory.build();
        const regularAgreement = AgreementFactory.build({ requiresMajorityAge: false, name: 'Regular Agreement' });
        const majorityAgeAgreement = AgreementFactory.build({ requiresMajorityAge: true, name: 'Adult Agreement' });

        // Student with no dob but grade 11 (typical age 17)
        const mockUser = UserFactory.build({ dob: null, grade: '11' });

        mockGetById.mockResolvedValue(mockAdmin);
        mockGetByIdAuthorized.mockResolvedValue(mockAdmin);
        mockGetUserRolesForAdministration.mockResolvedValue(['student']);
        mockGetAgreementsByAdministrationId.mockResolvedValue({
          items: [
            { agreement: regularAgreement, currentVersion: null },
            { agreement: majorityAgeAgreement, currentVersion: null },
          ],
          totalItems: 2,
        });
        mockUserRepository.getById.mockResolvedValue(mockUser);

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          userRepository: mockUserRepository,
        });

        const result = await service.listAgreements(
          { userId: 'student-123', isSuperAdmin: false },
          mockAdmin.id,
          defaultAgreementOptions,
        );

        expect(result.items).toHaveLength(1);
        expect(result.items[0]!.agreement.name).toBe('Regular Agreement');
      });

      it('should filter out requiresMajorityAge for grade 12 (conservative estimate: age 17)', async () => {
        const mockAdmin = AdministrationFactory.build();
        const regularAgreement = AgreementFactory.build({ requiresMajorityAge: false, name: 'Regular Agreement' });
        const majorityAgeAgreement = AgreementFactory.build({ requiresMajorityAge: true, name: 'Adult Agreement' });

        // Student with no dob but grade 12 - conservative age estimate is 17 (under majority age)
        const mockUser = UserFactory.build({ dob: null, grade: '12' });

        mockGetById.mockResolvedValue(mockAdmin);
        mockGetByIdAuthorized.mockResolvedValue(mockAdmin);
        mockGetUserRolesForAdministration.mockResolvedValue(['student']);
        mockGetAgreementsByAdministrationId.mockResolvedValue({
          items: [
            { agreement: regularAgreement, currentVersion: null },
            { agreement: majorityAgeAgreement, currentVersion: null },
          ],
          totalItems: 2,
        });
        mockUserRepository.getById.mockResolvedValue(mockUser);

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          userRepository: mockUserRepository,
        });

        const result = await service.listAgreements(
          { userId: 'student-123', isSuperAdmin: false },
          mockAdmin.id,
          defaultAgreementOptions,
        );

        // Grade 12 maps to age 17 (conservative), so majority age agreements are filtered out
        expect(result.items).toHaveLength(1);
        expect(result.items[0]!.agreement.name).toBe('Regular Agreement');
      });

      it('should include requiresMajorityAge for grade 13 (conservative estimate: age 18)', async () => {
        const mockAdmin = AdministrationFactory.build();
        const regularAgreement = AgreementFactory.build({ requiresMajorityAge: false });
        const majorityAgeAgreement = AgreementFactory.build({ requiresMajorityAge: true });

        // Student with no dob but grade 13 - conservative age estimate is 18 (majority age)
        const mockUser = UserFactory.build({ dob: null, grade: '13' });

        mockGetById.mockResolvedValue(mockAdmin);
        mockGetByIdAuthorized.mockResolvedValue(mockAdmin);
        mockGetUserRolesForAdministration.mockResolvedValue(['student']);
        mockGetAgreementsByAdministrationId.mockResolvedValue({
          items: [
            { agreement: regularAgreement, currentVersion: null },
            { agreement: majorityAgeAgreement, currentVersion: null },
          ],
          totalItems: 2,
        });
        mockUserRepository.getById.mockResolvedValue(mockUser);

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          userRepository: mockUserRepository,
        });

        const result = await service.listAgreements(
          { userId: 'student-123', isSuperAdmin: false },
          mockAdmin.id,
          defaultAgreementOptions,
        );

        expect(result.items).toHaveLength(2);
      });

      it('should filter out requiresMajorityAge when age cannot be determined (no dob, no grade)', async () => {
        const mockAdmin = AdministrationFactory.build();
        const regularAgreement = AgreementFactory.build({ requiresMajorityAge: false, name: 'Regular Agreement' });
        const majorityAgeAgreement = AgreementFactory.build({ requiresMajorityAge: true, name: 'Adult Agreement' });

        // Student with neither dob nor grade - conservative approach: exclude majority age agreements
        const mockUser = UserFactory.build({ dob: null, grade: null });

        mockGetById.mockResolvedValue(mockAdmin);
        mockGetByIdAuthorized.mockResolvedValue(mockAdmin);
        mockGetUserRolesForAdministration.mockResolvedValue(['student']);
        mockGetAgreementsByAdministrationId.mockResolvedValue({
          items: [
            { agreement: regularAgreement, currentVersion: null },
            { agreement: majorityAgeAgreement, currentVersion: null },
          ],
          totalItems: 2,
        });
        mockUserRepository.getById.mockResolvedValue(mockUser);

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          userRepository: mockUserRepository,
        });

        const result = await service.listAgreements(
          { userId: 'student-123', isSuperAdmin: false },
          mockAdmin.id,
          defaultAgreementOptions,
        );

        expect(result.items).toHaveLength(1);
        expect(result.items[0]!.agreement.name).toBe('Regular Agreement');
      });

      it('should throw error when user not found during filtering', async () => {
        const mockAdmin = AdministrationFactory.build();
        const majorityAgeAgreement = AgreementFactory.build({ requiresMajorityAge: true });

        mockGetById.mockResolvedValue(mockAdmin);
        mockGetByIdAuthorized.mockResolvedValue(mockAdmin);
        mockGetUserRolesForAdministration.mockResolvedValue(['student']);
        mockGetAgreementsByAdministrationId.mockResolvedValue({
          items: [{ agreement: majorityAgeAgreement, currentVersion: null }],
          totalItems: 1,
        });
        mockUserRepository.getById.mockResolvedValue(null);

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          userRepository: mockUserRepository,
        });

        await expect(
          service.listAgreements(
            { userId: 'missing-user', isSuperAdmin: false },
            mockAdmin.id,
            defaultAgreementOptions,
          ),
        ).rejects.toMatchObject({
          statusCode: 500,
          message: 'Failed to retrieve user data for agreement filtering',
        });
      });
    });
  });
});
