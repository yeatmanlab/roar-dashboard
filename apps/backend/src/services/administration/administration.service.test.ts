import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AdministrationService } from './administration.service';
import { AdministrationFactory } from '../../test-support/factories/administration.factory';

// Mock the logger
vi.mock('../../logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

import { logger } from '../../logger';

describe('AdministrationService', () => {
  const mockListAuthorized = vi.fn();
  const mockGetAll = vi.fn();
  const mockGetTasksByAdministrationIds = vi.fn();
  const mockGetAssignedUserCountsByAdministrationIds = vi.fn();
  const mockGetRunStatsByAdministrationIds = vi.fn();

  const mockBuildStatusFilter = vi.fn();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockAdministrationRepository: any = {
    listAuthorized: mockListAuthorized,
    getAll: mockGetAll,
    buildStatusFilter: mockBuildStatusFilter,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockAdministrationTaskVariantRepository: any = {
    getByAdministrationIds: mockGetTasksByAdministrationIds,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockAuthorizationRepository: any = {
    getAssignedUserCountsByAdministrationIds: mockGetAssignedUserCountsByAdministrationIds,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockRunsRepository: any = {
    getRunStatsByAdministrationIds: mockGetRunStatsByAdministrationIds,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('list', () => {
    it('should return all administrations for super admins (unrestricted)', async () => {
      const mockAdmins = AdministrationFactory.buildList(3);
      mockGetAll.mockResolvedValue({
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

      expect(mockGetAll).toHaveBeenCalledWith({
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

    describe('embed=stats', () => {
      it('should not fetch stats when embed option is not provided', async () => {
        const mockAdmins = AdministrationFactory.buildList(2);
        mockGetAll.mockResolvedValue({ items: mockAdmins, totalItems: 2 });

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          authorizationRepository: mockAuthorizationRepository,
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
        mockGetAll.mockResolvedValue({ items: mockAdmins, totalItems: 2 });

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          authorizationRepository: mockAuthorizationRepository,
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
        mockGetAll.mockResolvedValue({ items: mockAdmins, totalItems: 2 });

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
          authorizationRepository: mockAuthorizationRepository,
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
        mockGetAll.mockResolvedValue({ items: mockAdmins, totalItems: 2 });

        // Only admin-1 has data
        const assignedCounts = new Map([['admin-1', 10]]);
        const runStats = new Map([['admin-1', { started: 5, completed: 2 }]]);
        mockGetAssignedUserCountsByAdministrationIds.mockResolvedValue(assignedCounts);
        mockGetRunStatsByAdministrationIds.mockResolvedValue(runStats);

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          authorizationRepository: mockAuthorizationRepository,
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
        mockGetAll.mockResolvedValue({ items: mockAdmins, totalItems: 1 });

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
          authorizationRepository: mockAuthorizationRepository,
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
        mockGetAll.mockResolvedValue({ items: [], totalItems: 0 });

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          authorizationRepository: mockAuthorizationRepository,
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

      it('should return administrations without stats when assigned counts query fails', async () => {
        const mockAdmins = [AdministrationFactory.build({ id: 'admin-1' })];
        mockGetAll.mockResolvedValue({ items: mockAdmins, totalItems: 1 });

        const dbError = new Error('Database connection failed');
        mockGetAssignedUserCountsByAdministrationIds.mockRejectedValue(dbError);
        mockGetRunStatsByAdministrationIds.mockResolvedValue(new Map([['admin-1', { started: 5, completed: 2 }]]));

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          authorizationRepository: mockAuthorizationRepository,
          runsRepository: mockRunsRepository,
        });

        const result = await service.list(
          { userId: 'admin-123', isSuperAdmin: true },
          { page: 1, perPage: 25, sortBy: 'createdAt', sortOrder: 'desc', embed: ['stats'] },
        );

        // Should return administrations without stats
        expect(result.items).toHaveLength(1);
        expect(result.items[0]).not.toHaveProperty('stats');
        // Should log the error
        expect(logger.error).toHaveBeenCalledWith(
          { err: dbError },
          'Failed to fetch assigned user counts for stats embed',
        );
      });

      it('should return administrations without stats when run stats query fails', async () => {
        const mockAdmins = [AdministrationFactory.build({ id: 'admin-1' })];
        mockGetAll.mockResolvedValue({ items: mockAdmins, totalItems: 1 });

        const dbError = new Error('Assessment DB timeout');
        mockGetAssignedUserCountsByAdministrationIds.mockResolvedValue(new Map([['admin-1', 25]]));
        mockGetRunStatsByAdministrationIds.mockRejectedValue(dbError);

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          authorizationRepository: mockAuthorizationRepository,
          runsRepository: mockRunsRepository,
        });

        const result = await service.list(
          { userId: 'admin-123', isSuperAdmin: true },
          { page: 1, perPage: 25, sortBy: 'createdAt', sortOrder: 'desc', embed: ['stats'] },
        );

        // Should return administrations without stats
        expect(result.items).toHaveLength(1);
        expect(result.items[0]).not.toHaveProperty('stats');
        // Should log the error
        expect(logger.error).toHaveBeenCalledWith({ err: dbError }, 'Failed to fetch run stats for stats embed');
      });

      it('should return administrations without stats when both queries fail', async () => {
        const mockAdmins = [AdministrationFactory.build({ id: 'admin-1' })];
        mockGetAll.mockResolvedValue({ items: mockAdmins, totalItems: 1 });

        const assignedError = new Error('Core DB error');
        const runsError = new Error('Assessment DB error');
        mockGetAssignedUserCountsByAdministrationIds.mockRejectedValue(assignedError);
        mockGetRunStatsByAdministrationIds.mockRejectedValue(runsError);

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          authorizationRepository: mockAuthorizationRepository,
          runsRepository: mockRunsRepository,
        });

        const result = await service.list(
          { userId: 'admin-123', isSuperAdmin: true },
          { page: 1, perPage: 25, sortBy: 'createdAt', sortOrder: 'desc', embed: ['stats'] },
        );

        // Should return administrations without stats
        expect(result.items).toHaveLength(1);
        expect(result.items[0]).not.toHaveProperty('stats');
        // Should log both errors
        expect(logger.error).toHaveBeenCalledTimes(2);
      });
    });

    describe('embed=tasks', () => {
      it('should not fetch tasks when embed option is not provided', async () => {
        const mockAdmins = AdministrationFactory.buildList(2);
        mockGetAll.mockResolvedValue({ items: mockAdmins, totalItems: 2 });

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
        mockGetAll.mockResolvedValue({ items: mockAdmins, totalItems: 2 });

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
        mockGetAll.mockResolvedValue({ items: mockAdmins, totalItems: 2 });

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

      it('should return administrations without tasks when query fails', async () => {
        const mockAdmins = [AdministrationFactory.build({ id: 'admin-1' })];
        mockGetAll.mockResolvedValue({ items: mockAdmins, totalItems: 1 });

        const dbError = new Error('Database error');
        mockGetTasksByAdministrationIds.mockRejectedValue(dbError);

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          administrationTaskVariantRepository: mockAdministrationTaskVariantRepository,
        });

        const result = await service.list(
          { userId: 'admin-123', isSuperAdmin: true },
          { page: 1, perPage: 25, sortBy: 'createdAt', sortOrder: 'desc', embed: ['tasks'] },
        );

        // Should return administrations without tasks
        expect(result.items).toHaveLength(1);
        expect(result.items[0]).not.toHaveProperty('tasks');
        // Should log the error
        expect(logger.error).toHaveBeenCalledWith({ err: dbError }, 'Failed to fetch tasks for tasks embed');
      });

      it('should not fetch tasks when result is empty', async () => {
        mockGetAll.mockResolvedValue({ items: [], totalItems: 0 });

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

    describe('embed=stats,tasks', () => {
      it('should fetch both stats and tasks when both are requested', async () => {
        const mockAdmins = [AdministrationFactory.build({ id: 'admin-1' })];
        mockGetAll.mockResolvedValue({ items: mockAdmins, totalItems: 1 });

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
          authorizationRepository: mockAuthorizationRepository,
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
});
