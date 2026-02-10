import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AdministrationService } from './administration.service';
import { AdministrationFactory } from '../../test-support/factories/administration.factory';
import { OrgFactory } from '../../test-support/factories/org.factory';
import { ApiErrorMessage } from '../../enums/api-error-message.enum';

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
  const mockGetUserRolesForAdministration = vi.fn();

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
    getUserRolesForAdministration: mockGetUserRolesForAdministration,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockAdministrationTaskVariantRepository: any = {
    getByAdministrationIds: mockGetTasksByAdministrationIds,
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
});
