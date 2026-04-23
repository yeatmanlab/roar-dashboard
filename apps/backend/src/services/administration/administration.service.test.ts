import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StatusCodes } from 'http-status-codes';
import { AdministrationService } from './administration.service';
import { AdministrationFactory } from '../../test-support/factories/administration.factory';
import { UserFactory } from '../../test-support/factories/user.factory';
import { TaskFactory } from '../../test-support/factories/task.factory';
import { TaskVariantFactory } from '../../test-support/factories/task-variant.factory';
import { AdministrationTaskVariantFactory } from '../../test-support/factories/administration-task-variant.factory';
import { AgreementFactory } from '../../test-support/factories/agreement.factory';
import { AgreementVersionFactory } from '../../test-support/factories/agreement-version.factory';
import { RunFactory } from '../../test-support/factories/run.factory';
import { ApiError } from '../../errors/api-error';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { ApiErrorMessage } from '../../enums/api-error-message.enum';
import type { AssignmentWithOptional, TaskVariantWithAssignment } from '../../repositories/administration.repository';
import {
  createMockAdministrationRepository,
  createMockAdministrationTaskVariantRepository,
  createMockRunRepository,
  createMockUserRepository,
} from '../../test-support/repositories';
import { createMockAuthorizationService, createMockTaskService } from '../../test-support/services';
import type { MockAuthorizationService } from '../../test-support/services';

describe('AdministrationService', () => {
  let mockAdministrationRepository: ReturnType<typeof createMockAdministrationRepository>;
  let mockAdministrationTaskVariantRepository: ReturnType<typeof createMockAdministrationTaskVariantRepository>;
  let mockUserRepository: ReturnType<typeof createMockUserRepository>;
  let mockRunRepository: ReturnType<typeof createMockRunRepository>;
  let mockTaskService: ReturnType<typeof createMockTaskService>;
  let mockAuthorizationService: MockAuthorizationService;

  beforeEach(() => {
    vi.resetAllMocks();
    mockAdministrationRepository = createMockAdministrationRepository();
    mockAdministrationTaskVariantRepository = createMockAdministrationTaskVariantRepository();
    mockUserRepository = createMockUserRepository();
    mockRunRepository = createMockRunRepository();
    mockTaskService = createMockTaskService();
    mockAuthorizationService = createMockAuthorizationService();
  });

  describe('list', () => {
    it('should return all administrations for super admins (unrestricted)', async () => {
      const mockAdmins = AdministrationFactory.buildList(3);
      mockAdministrationRepository.listAll.mockResolvedValue({
        items: mockAdmins,
        totalItems: 3,
      });

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
        authorizationService: mockAuthorizationService,
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

      expect(mockAdministrationRepository.listAll).toHaveBeenCalledWith({
        page: 1,
        perPage: 25,
        orderBy: { field: 'createdAt', direction: 'desc' },
      });
      // Super admins bypass FGA — no FGA call should be made
      expect(mockAuthorizationService.listAccessibleObjects).not.toHaveBeenCalled();
      expect(result.items).toHaveLength(3);
      expect(result.totalItems).toBe(3);
    });

    it('should use FGA listObjects + getByIds for non-super-admin users', async () => {
      const mockAdmins = AdministrationFactory.buildList(3);

      mockAuthorizationService.listAccessibleObjects.mockResolvedValue(mockAdmins.map((a) => `administration:${a.id}`));
      mockAdministrationRepository.getByIds.mockResolvedValue({
        items: mockAdmins,
        totalItems: 3,
      });

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
        authorizationService: mockAuthorizationService,
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

      expect(mockAuthorizationService.listAccessibleObjects).toHaveBeenCalledWith(
        'user-123',
        'can_list',
        'administration',
      );
      expect(mockAdministrationRepository.getByIds).toHaveBeenCalledWith(
        mockAdmins.map((a) => a.id),
        {
          page: 1,
          perPage: 25,
          orderBy: { field: 'createdAt', direction: 'desc' },
        },
      );
      expect(mockAdministrationRepository.listAll).not.toHaveBeenCalled();
      expect(result.items).toHaveLength(3);
      expect(result.totalItems).toBe(3);
    });

    it('should pass pagination options to getByIds', async () => {
      mockAuthorizationService.listAccessibleObjects.mockResolvedValue(['administration:admin-1']);
      mockAdministrationRepository.getByIds.mockResolvedValue({ items: [], totalItems: 0 });

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
        authorizationService: mockAuthorizationService,
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

      expect(mockAdministrationRepository.getByIds).toHaveBeenCalledWith(['admin-1'], {
        page: 3,
        perPage: 50,
        orderBy: { field: 'dateStart', direction: 'asc' },
      });
    });

    it('should return empty results when FGA returns no accessible administrations', async () => {
      mockAuthorizationService.listAccessibleObjects.mockResolvedValue([]);

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
        authorizationService: mockAuthorizationService,
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

      expect(mockAuthorizationService.listAccessibleObjects).toHaveBeenCalledWith(
        'user-no-access',
        'can_list',
        'administration',
      );
      // Should short-circuit without calling the repository
      expect(mockAdministrationRepository.getByIds).not.toHaveBeenCalled();
      expect(result.items).toEqual([]);
      expect(result.totalItems).toBe(0);
    });

    it('should map API sort field "name" to database column "name"', async () => {
      mockAuthorizationService.listAccessibleObjects.mockResolvedValue(['administration:admin-1']);
      mockAdministrationRepository.getByIds.mockResolvedValue({ items: [], totalItems: 0 });

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
        authorizationService: mockAuthorizationService,
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

      expect(mockAdministrationRepository.getByIds).toHaveBeenCalledWith(['admin-1'], {
        page: 1,
        perPage: 25,
        orderBy: { field: 'name', direction: 'asc' },
      });
    });

    describe('status filter', () => {
      it('should pass status filter to listAll for super admins', async () => {
        const mockAdmins = AdministrationFactory.buildList(2);
        mockAdministrationRepository.listAll.mockResolvedValue({ items: mockAdmins, totalItems: 2 });

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          authorizationService: mockAuthorizationService,
        });

        await service.list(
          { userId: 'admin-123', isSuperAdmin: true },
          { page: 1, perPage: 25, sortBy: 'createdAt', sortOrder: 'desc', status: 'active' },
        );

        expect(mockAdministrationRepository.listAll).toHaveBeenCalledWith({
          page: 1,
          perPage: 25,
          orderBy: { field: 'createdAt', direction: 'desc' },
          status: 'active',
        });
      });

      it('should pass status filter to getByIds for non-super-admin users', async () => {
        const mockAdmins = AdministrationFactory.buildList(2);
        mockAuthorizationService.listAccessibleObjects.mockResolvedValue(
          mockAdmins.map((a) => `administration:${a.id}`),
        );
        mockAdministrationRepository.getByIds.mockResolvedValue({ items: mockAdmins, totalItems: 2 });

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          authorizationService: mockAuthorizationService,
        });

        await service.list(
          { userId: 'user-123', isSuperAdmin: false },
          { page: 1, perPage: 25, sortBy: 'createdAt', sortOrder: 'desc', status: 'past' },
        );

        expect(mockAdministrationRepository.getByIds).toHaveBeenCalledWith(
          mockAdmins.map((a) => a.id),
          {
            page: 1,
            perPage: 25,
            orderBy: { field: 'createdAt', direction: 'desc' },
            status: 'past',
          },
        );
      });

      it('should work with status filter combined with embed=stats', async () => {
        const mockAdmins = [AdministrationFactory.build({ id: 'admin-1' })];
        mockAdministrationRepository.listAll.mockResolvedValue({ items: mockAdmins, totalItems: 1 });

        const assignedCounts = new Map([['admin-1', 10]]);
        const runStats = new Map([['admin-1', { started: 5, completed: 2 }]]);
        mockAdministrationRepository.getAssignedUserCountsByAdministrationIds.mockResolvedValue(assignedCounts);
        mockRunRepository.getRunStatsByAdministrationIds.mockResolvedValue(runStats);

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          runRepository: mockRunRepository,
          authorizationService: mockAuthorizationService,
        });

        const result = await service.list(
          { userId: 'admin-123', isSuperAdmin: true },
          { page: 1, perPage: 25, sortBy: 'createdAt', sortOrder: 'desc', status: 'upcoming', embed: ['stats'] },
        );

        expect(mockAdministrationRepository.listAll).toHaveBeenCalledWith({
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
        mockAuthorizationService.listAccessibleObjects.mockResolvedValue(
          mockAdmins.map((a) => `administration:${a.id}`),
        );
        mockAdministrationRepository.getByIds.mockResolvedValue({ items: mockAdmins, totalItems: 2 });

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          runRepository: mockRunRepository,
          authorizationService: mockAuthorizationService,
        });

        const result = await service.list(
          { userId: 'user-123', isSuperAdmin: false },
          { page: 1, perPage: 25, sortBy: 'createdAt', sortOrder: 'desc', embed: ['stats'] },
        );

        expect(mockAdministrationRepository.getAssignedUserCountsByAdministrationIds).not.toHaveBeenCalled();
        expect(mockRunRepository.getRunStatsByAdministrationIds).not.toHaveBeenCalled();
        expect(result.items[0]).not.toHaveProperty('stats');
      });

      it('should not fetch stats when embed option is not provided', async () => {
        const mockAdmins = AdministrationFactory.buildList(2);
        mockAdministrationRepository.listAll.mockResolvedValue({ items: mockAdmins, totalItems: 2 });

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          runRepository: mockRunRepository,
          authorizationService: mockAuthorizationService,
        });

        const result = await service.list(
          { userId: 'admin-123', isSuperAdmin: true },
          { page: 1, perPage: 25, sortBy: 'createdAt', sortOrder: 'desc' },
        );

        expect(mockAdministrationRepository.getAssignedUserCountsByAdministrationIds).not.toHaveBeenCalled();
        expect(mockRunRepository.getRunStatsByAdministrationIds).not.toHaveBeenCalled();
        expect(result.items[0]).not.toHaveProperty('stats');
      });

      it('should not fetch stats when embed is empty array', async () => {
        const mockAdmins = AdministrationFactory.buildList(2);
        mockAdministrationRepository.listAll.mockResolvedValue({ items: mockAdmins, totalItems: 2 });

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          runRepository: mockRunRepository,
          authorizationService: mockAuthorizationService,
        });

        const result = await service.list(
          { userId: 'admin-123', isSuperAdmin: true },
          { page: 1, perPage: 25, sortBy: 'createdAt', sortOrder: 'desc', embed: [] },
        );

        expect(mockAdministrationRepository.getAssignedUserCountsByAdministrationIds).not.toHaveBeenCalled();
        expect(mockRunRepository.getRunStatsByAdministrationIds).not.toHaveBeenCalled();
        expect(result.items[0]).not.toHaveProperty('stats');
      });

      it('should fetch and attach stats when embed includes stats', async () => {
        const mockAdmins = [
          AdministrationFactory.build({ id: 'admin-1' }),
          AdministrationFactory.build({ id: 'admin-2' }),
        ];
        mockAdministrationRepository.listAll.mockResolvedValue({ items: mockAdmins, totalItems: 2 });

        const assignedCounts = new Map([
          ['admin-1', 25],
          ['admin-2', 50],
        ]);
        const runStats = new Map([
          ['admin-1', { started: 10, completed: 5 }],
          ['admin-2', { started: 30, completed: 20 }],
        ]);
        mockAdministrationRepository.getAssignedUserCountsByAdministrationIds.mockResolvedValue(assignedCounts);
        mockRunRepository.getRunStatsByAdministrationIds.mockResolvedValue(runStats);

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          runRepository: mockRunRepository,
          authorizationService: mockAuthorizationService,
        });

        const result = await service.list(
          { userId: 'admin-123', isSuperAdmin: true },
          { page: 1, perPage: 25, sortBy: 'createdAt', sortOrder: 'desc', embed: ['stats'] },
        );

        expect(mockAdministrationRepository.getAssignedUserCountsByAdministrationIds).toHaveBeenCalledWith([
          'admin-1',
          'admin-2',
        ]);
        expect(mockRunRepository.getRunStatsByAdministrationIds).toHaveBeenCalledWith(['admin-1', 'admin-2']);
        expect(result.items[0]!.stats).toEqual({ assigned: 25, started: 10, completed: 5 });
        expect(result.items[1]!.stats).toEqual({ assigned: 50, started: 30, completed: 20 });
      });

      it('should default to zero stats for administrations with no data', async () => {
        const mockAdmins = [
          AdministrationFactory.build({ id: 'admin-1' }),
          AdministrationFactory.build({ id: 'admin-2' }),
        ];
        mockAdministrationRepository.listAll.mockResolvedValue({ items: mockAdmins, totalItems: 2 });

        // Only admin-1 has data
        const assignedCounts = new Map([['admin-1', 10]]);
        const runStats = new Map([['admin-1', { started: 5, completed: 2 }]]);
        mockAdministrationRepository.getAssignedUserCountsByAdministrationIds.mockResolvedValue(assignedCounts);
        mockRunRepository.getRunStatsByAdministrationIds.mockResolvedValue(runStats);

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          runRepository: mockRunRepository,
          authorizationService: mockAuthorizationService,
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
        mockAdministrationRepository.listAll.mockResolvedValue({ items: mockAdmins, totalItems: 1 });

        // Track call order
        const callOrder: string[] = [];
        mockAdministrationRepository.getAssignedUserCountsByAdministrationIds.mockImplementation(async () => {
          callOrder.push('assigned-start');
          await new Promise((r) => setTimeout(r, 10));
          callOrder.push('assigned-end');
          return new Map([['admin-1', 10]]);
        });
        mockRunRepository.getRunStatsByAdministrationIds.mockImplementation(async () => {
          callOrder.push('runs-start');
          await new Promise((r) => setTimeout(r, 10));
          callOrder.push('runs-end');
          return new Map([['admin-1', { started: 5, completed: 2 }]]);
        });

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          runRepository: mockRunRepository,
          authorizationService: mockAuthorizationService,
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
        mockAdministrationRepository.listAll.mockResolvedValue({ items: [], totalItems: 0 });

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          runRepository: mockRunRepository,
          authorizationService: mockAuthorizationService,
        });

        const result = await service.list(
          { userId: 'admin-123', isSuperAdmin: true },
          { page: 1, perPage: 25, sortBy: 'createdAt', sortOrder: 'desc', embed: ['stats'] },
        );

        expect(mockAdministrationRepository.getAssignedUserCountsByAdministrationIds).not.toHaveBeenCalled();
        expect(mockRunRepository.getRunStatsByAdministrationIds).not.toHaveBeenCalled();
        expect(result.items).toEqual([]);
      });

      it('should throw ApiError when assigned counts query fails', async () => {
        const mockAdmins = [AdministrationFactory.build({ id: 'admin-1' })];
        mockAdministrationRepository.listAll.mockResolvedValue({ items: mockAdmins, totalItems: 1 });

        const dbError = new Error('Database connection failed');
        mockAdministrationRepository.getAssignedUserCountsByAdministrationIds.mockRejectedValue(dbError);
        mockRunRepository.getRunStatsByAdministrationIds.mockResolvedValue(
          new Map([['admin-1', { started: 5, completed: 2 }]]),
        );

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          runRepository: mockRunRepository,
          authorizationService: mockAuthorizationService,
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
        mockAdministrationRepository.listAll.mockResolvedValue({ items: mockAdmins, totalItems: 1 });

        const dbError = new Error('Assessment DB timeout');
        mockAdministrationRepository.getAssignedUserCountsByAdministrationIds.mockResolvedValue(
          new Map([['admin-1', 25]]),
        );
        mockRunRepository.getRunStatsByAdministrationIds.mockRejectedValue(dbError);

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          runRepository: mockRunRepository,
          authorizationService: mockAuthorizationService,
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
        mockAdministrationRepository.listAll.mockResolvedValue({ items: mockAdmins, totalItems: 2 });

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          administrationTaskVariantRepository: mockAdministrationTaskVariantRepository,
          authorizationService: mockAuthorizationService,
        });

        const result = await service.list(
          { userId: 'admin-123', isSuperAdmin: true },
          { page: 1, perPage: 25, sortBy: 'createdAt', sortOrder: 'desc' },
        );

        expect(mockAdministrationTaskVariantRepository.getByAdministrationIds).not.toHaveBeenCalled();
        expect(result.items[0]).not.toHaveProperty('tasks');
      });

      it('should fetch and attach tasks when embed includes tasks', async () => {
        const mockAdmins = [
          AdministrationFactory.build({ id: 'admin-1' }),
          AdministrationFactory.build({ id: 'admin-2' }),
        ];
        mockAdministrationRepository.listAll.mockResolvedValue({ items: mockAdmins, totalItems: 2 });

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
        mockAdministrationTaskVariantRepository.getByAdministrationIds.mockResolvedValue(tasksMap);

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          administrationTaskVariantRepository: mockAdministrationTaskVariantRepository,
          authorizationService: mockAuthorizationService,
        });

        const result = await service.list(
          { userId: 'admin-123', isSuperAdmin: true },
          { page: 1, perPage: 25, sortBy: 'createdAt', sortOrder: 'desc', embed: ['tasks'] },
        );

        expect(mockAdministrationTaskVariantRepository.getByAdministrationIds).toHaveBeenCalledWith([
          'admin-1',
          'admin-2',
        ]);
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
        mockAdministrationRepository.listAll.mockResolvedValue({ items: mockAdmins, totalItems: 2 });

        // Only admin-1 has tasks
        const tasksMap = new Map([
          [
            'admin-1',
            [{ taskId: 'task-1', taskName: 'SWR', variantId: 'variant-1', variantName: 'Variant A', orderIndex: 0 }],
          ],
        ]);
        mockAdministrationTaskVariantRepository.getByAdministrationIds.mockResolvedValue(tasksMap);

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          administrationTaskVariantRepository: mockAdministrationTaskVariantRepository,
          authorizationService: mockAuthorizationService,
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
        mockAdministrationRepository.listAll.mockResolvedValue({ items: mockAdmins, totalItems: 1 });

        const dbError = new Error('Database error');
        mockAdministrationTaskVariantRepository.getByAdministrationIds.mockRejectedValue(dbError);

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          administrationTaskVariantRepository: mockAdministrationTaskVariantRepository,
          authorizationService: mockAuthorizationService,
        });

        await expect(
          service.list(
            { userId: 'admin-123', isSuperAdmin: true },
            { page: 1, perPage: 25, sortBy: 'createdAt', sortOrder: 'desc', embed: ['tasks'] },
          ),
        ).rejects.toThrow('Failed to fetch administration tasks');
      });

      it('should not fetch tasks when result is empty', async () => {
        mockAdministrationRepository.listAll.mockResolvedValue({ items: [], totalItems: 0 });

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          administrationTaskVariantRepository: mockAdministrationTaskVariantRepository,
          authorizationService: mockAuthorizationService,
        });

        const result = await service.list(
          { userId: 'admin-123', isSuperAdmin: true },
          { page: 1, perPage: 25, sortBy: 'createdAt', sortOrder: 'desc', embed: ['tasks'] },
        );

        expect(mockAdministrationTaskVariantRepository.getByAdministrationIds).not.toHaveBeenCalled();
        expect(result.items).toEqual([]);
      });
    });

    describe('embed=stats,tasks (combined)', () => {
      it('should fetch both stats and tasks when both are requested', async () => {
        const mockAdmins = [AdministrationFactory.build({ id: 'admin-1' })];
        mockAdministrationRepository.listAll.mockResolvedValue({ items: mockAdmins, totalItems: 1 });

        const assignedCounts = new Map([['admin-1', 25]]);
        const runStats = new Map([['admin-1', { started: 10, completed: 5 }]]);
        const tasksMap = new Map([
          [
            'admin-1',
            [{ taskId: 'task-1', taskName: 'SWR', variantId: 'variant-1', variantName: 'Variant A', orderIndex: 0 }],
          ],
        ]);

        mockAdministrationRepository.getAssignedUserCountsByAdministrationIds.mockResolvedValue(assignedCounts);
        mockRunRepository.getRunStatsByAdministrationIds.mockResolvedValue(runStats);
        mockAdministrationTaskVariantRepository.getByAdministrationIds.mockResolvedValue(tasksMap);

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          administrationTaskVariantRepository: mockAdministrationTaskVariantRepository,
          runRepository: mockRunRepository,
          authorizationService: mockAuthorizationService,
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
      mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
        authorizationService: mockAuthorizationService,
      });

      const result = await service.getById({ userId: 'admin-user', isSuperAdmin: true }, 'admin-123');

      expect(mockAdministrationRepository.getById).toHaveBeenCalledWith({ id: 'admin-123' });
      // Super admins bypass FGA — no permission check should be made
      expect(mockAuthorizationService.requirePermission).not.toHaveBeenCalled();
      expect(result).toEqual(mockAdmin);
    });

    it('should use FGA requirePermission for non-super admin users', async () => {
      const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
      mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
      mockAuthorizationService.requirePermission.mockResolvedValue(undefined);

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
        authorizationService: mockAuthorizationService,
      });

      const result = await service.getById({ userId: 'user-123', isSuperAdmin: false }, 'admin-123');

      expect(mockAdministrationRepository.getById).toHaveBeenCalledWith({ id: 'admin-123' });
      expect(mockAuthorizationService.requirePermission).toHaveBeenCalledWith(
        'user-123',
        'can_read',
        'administration:admin-123',
      );
      expect(result).toEqual(mockAdmin);
    });

    it('should throw not-found error when administration does not exist', async () => {
      mockAdministrationRepository.getById.mockResolvedValue(null);

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
        authorizationService: mockAuthorizationService,
      });

      await expect(service.getById({ userId: 'admin-user', isSuperAdmin: true }, 'non-existent-id')).rejects.toThrow(
        ApiErrorMessage.NOT_FOUND,
      );
    });

    it('should throw forbidden error when non-super admin has no access to existing administration', async () => {
      const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
      mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
      mockAuthorizationService.requirePermission.mockRejectedValue(
        new ApiError(ApiErrorMessage.FORBIDDEN, {
          statusCode: StatusCodes.FORBIDDEN,
          code: ApiErrorCode.AUTH_FORBIDDEN,
          context: { userId: 'user-123', relation: 'can_read', object: 'administration:admin-123' },
        }),
      );

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
        authorizationService: mockAuthorizationService,
      });

      await expect(service.getById({ userId: 'user-123', isSuperAdmin: false }, 'admin-123')).rejects.toThrow(
        'You do not have permission to perform this action',
      );
    });

    it('should throw not-found error for non-super admin when administration does not exist', async () => {
      mockAdministrationRepository.getById.mockResolvedValue(null);

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
        authorizationService: mockAuthorizationService,
      });

      await expect(service.getById({ userId: 'user-123', isSuperAdmin: false }, 'non-existent-id')).rejects.toThrow(
        ApiErrorMessage.NOT_FOUND,
      );
      // FGA should not be called when admin doesn't exist (404 before 403)
      expect(mockAuthorizationService.requirePermission).not.toHaveBeenCalled();
    });

    it('should throw ApiError when database query fails', async () => {
      const dbError = new Error('Connection refused');
      mockAdministrationRepository.getById.mockRejectedValue(dbError);

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
        authorizationService: mockAuthorizationService,
      });

      await expect(service.getById({ userId: 'admin-user', isSuperAdmin: true }, 'admin-123')).rejects.toThrow(
        'Failed to retrieve administration',
      );
    });
  });

  describe('getAssignees', () => {
    it('should return assignees when user is super admin and administration exists', async () => {
      const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
      const mockAssignees = {
        districts: [{ id: 'district-1', name: 'District A' }],
        schools: [{ id: 'school-1', name: 'School A', parentOrgId: 'district-1' }],
        classes: [{ id: 'class-1', name: 'Class A', schoolId: 'school-1', districtId: 'district-1' }],
        groups: [{ id: 'group-1', name: 'Group A' }],
      };
      mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
      mockAdministrationRepository.getAssignees.mockResolvedValue(mockAssignees);

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
        authorizationService: mockAuthorizationService,
      });

      const result = await service.getAssignees({ userId: 'admin-user', isSuperAdmin: true }, 'admin-123');

      expect(mockAdministrationRepository.getById).toHaveBeenCalledWith({ id: 'admin-123' });
      expect(mockAdministrationRepository.getAssignees).toHaveBeenCalledWith('admin-123');
      expect(result).toEqual(mockAssignees);
    });

    it('should throw 403 when user is not super admin', async () => {
      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
        authorizationService: mockAuthorizationService,
      });

      await expect(
        service.getAssignees({ userId: 'user-123', isSuperAdmin: false }, 'admin-123'),
      ).rejects.toMatchObject({
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
        message: ApiErrorMessage.FORBIDDEN,
      });

      expect(mockAdministrationRepository.getById).not.toHaveBeenCalled();
      expect(mockAdministrationRepository.getAssignees).not.toHaveBeenCalled();
    });

    it('should throw 404 when administration does not exist', async () => {
      mockAdministrationRepository.getById.mockResolvedValue(null);

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
        authorizationService: mockAuthorizationService,
      });

      await expect(
        service.getAssignees({ userId: 'admin-user', isSuperAdmin: true }, 'non-existent-id'),
      ).rejects.toMatchObject({
        statusCode: StatusCodes.NOT_FOUND,
        code: ApiErrorCode.RESOURCE_NOT_FOUND,
        message: ApiErrorMessage.NOT_FOUND,
      });

      expect(mockAdministrationRepository.getAssignees).not.toHaveBeenCalled();
    });

    it('should wrap unexpected errors in ApiError with 500', async () => {
      const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
      const dbError = new Error('Database connection failed');
      mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
      mockAdministrationRepository.getAssignees.mockRejectedValue(dbError);

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
        authorizationService: mockAuthorizationService,
      });

      await expect(
        service.getAssignees({ userId: 'admin-user', isSuperAdmin: true }, 'admin-123'),
      ).rejects.toMatchObject({
        message: ApiErrorMessage.INTERNAL_SERVER_ERROR,
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
      });

      expect(mockAdministrationRepository.getAssignees).toHaveBeenCalledWith('admin-123');
    });
  });

  describe('listTaskVariants', () => {
    const defaultOptions = {
      page: 1,
      perPage: 25,
      sortBy: 'orderIndex' as const,
      sortOrder: 'asc' as const,
    };

    /**
     * Helper to create a TaskVariantWithAssignment mock using factories.
     * Provides sensible defaults while allowing overrides for specific test needs.
     */
    const createMockTaskVariant = (overrides?: {
      variantId?: string;
      variantName?: string;
      taskId?: string;
      taskName?: string;
      administrationId?: string;
      orderIndex?: number;
      conditionsAssignment?: unknown;
      conditionsRequirements?: unknown;
      taskOverrides?: Partial<ReturnType<typeof TaskFactory.build>>;
      variantOverrides?: Partial<ReturnType<typeof TaskVariantFactory.build>>;
      assignmentOverrides?: Partial<ReturnType<typeof AdministrationTaskVariantFactory.build>>;
    }): TaskVariantWithAssignment => {
      const task = TaskFactory.build({
        ...(overrides?.taskId && { id: overrides.taskId }),
        ...(overrides?.taskName && { name: overrides.taskName }),
        ...overrides?.taskOverrides,
      });

      const variant = TaskVariantFactory.build({
        ...(overrides?.variantId && { id: overrides.variantId }),
        ...(overrides?.variantName && { name: overrides.variantName }),
        taskId: task.id,
        ...overrides?.variantOverrides,
      });

      const assignment = AdministrationTaskVariantFactory.build({
        administrationId: overrides?.administrationId ?? 'admin-123',
        taskVariantId: variant.id,
        orderIndex: overrides?.orderIndex ?? 0,
        conditionsAssignment: overrides?.conditionsAssignment ?? null,
        conditionsRequirements: overrides?.conditionsRequirements ?? null,
        ...overrides?.assignmentOverrides,
      });

      return { variant, task, assignment };
    };

    const mockTaskVariants: TaskVariantWithAssignment[] = [
      createMockTaskVariant({
        variantId: 'variant-1',
        variantName: 'Variant A',
        taskId: 'task-1',
        taskName: 'Task One',
        orderIndex: 0,
        variantOverrides: { description: 'Variant A description' },
        taskOverrides: { description: 'Task One desc' },
      }),
      createMockTaskVariant({
        variantId: 'variant-2',
        variantName: 'Variant B',
        taskId: 'task-2',
        taskName: 'Task Two',
        orderIndex: 1,
        conditionsAssignment: { grade: '3' },
        conditionsRequirements: { minScore: 80 },
        variantOverrides: { description: null, updatedAt: null },
        taskOverrides: { description: null, image: 'img.png', tutorialVideo: 'vid.mp4' },
      }),
    ];

    it('should return task variants for super admin (unrestricted)', async () => {
      const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
      mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
      mockAdministrationRepository.getTaskVariantsByAdministrationId.mockResolvedValue({
        items: mockTaskVariants,
        totalItems: 2,
      });

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
        authorizationService: mockAuthorizationService,
      });

      const result = await service.listTaskVariants(
        { userId: 'admin-user', isSuperAdmin: true },
        'admin-123',
        defaultOptions,
      );

      expect(mockAdministrationRepository.getById).toHaveBeenCalledWith({ id: 'admin-123' });
      // Super admin bypasses FGA permission checks
      expect(mockAuthorizationService.requirePermission).not.toHaveBeenCalled();
      expect(mockAuthorizationService.hasPermission).not.toHaveBeenCalled();
      // Super admin sees all variants including draft/deprecated (publishedOnly: false)
      expect(mockAdministrationRepository.getTaskVariantsByAdministrationId).toHaveBeenCalledWith(
        'admin-123',
        false, // publishedOnly
        { page: 1, perPage: 25, orderBy: { field: 'orderIndex', direction: 'asc' } },
      );
      expect(result.items).toHaveLength(2);
      expect(result.totalItems).toBe(2);
    });

    it('should return task variants for non-super admin with administration access (supervisory role)', async () => {
      const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
      mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
      // requirePermission: can_read (verifyAdministrationAccess) passes
      mockAuthorizationService.requirePermission.mockResolvedValue(undefined);
      // hasPermission: can_list_users (supervisory check) = true
      mockAuthorizationService.hasPermission.mockResolvedValue(true);
      mockAdministrationRepository.getTaskVariantsByAdministrationId.mockResolvedValue({
        items: mockTaskVariants,
        totalItems: 2,
      });

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
        userRepository: mockUserRepository,
        taskService: mockTaskService,
        authorizationService: mockAuthorizationService,
      });

      const result = await service.listTaskVariants(
        { userId: 'user-123', isSuperAdmin: false },
        'admin-123',
        defaultOptions,
      );

      expect(mockAdministrationRepository.getById).toHaveBeenCalledWith({ id: 'admin-123' });
      // FGA requirePermission check for can_read
      expect(mockAuthorizationService.requirePermission).toHaveBeenCalledWith(
        'user-123',
        'can_read',
        'administration:admin-123',
      );
      // FGA hasPermission check for can_list_users (supervisory branching check)
      expect(mockAuthorizationService.hasPermission).toHaveBeenCalledWith(
        'user-123',
        'can_list_users',
        'administration:admin-123',
      );
      // Supervisory roles skip eligibility filtering
      expect(mockTaskService.evaluateTaskVariantEligibility).not.toHaveBeenCalled();
      // Supervisory roles see all variants including draft/deprecated (publishedOnly: false)
      expect(mockAdministrationRepository.getTaskVariantsByAdministrationId).toHaveBeenCalledWith(
        'admin-123',
        false, // publishedOnly
        { page: 1, perPage: 25, orderBy: { field: 'orderIndex', direction: 'asc' } },
      );
      expect(result.items).toHaveLength(2);
    });

    it('should pass pagination and sorting options to repository', async () => {
      const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
      mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
      mockAdministrationRepository.getTaskVariantsByAdministrationId.mockResolvedValue({ items: [], totalItems: 0 });

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
        authorizationService: mockAuthorizationService,
      });

      await service.listTaskVariants({ userId: 'admin-user', isSuperAdmin: true }, 'admin-123', {
        page: 3,
        perPage: 50,
        sortBy: 'name',
        sortOrder: 'desc',
      });

      expect(mockAdministrationRepository.getTaskVariantsByAdministrationId).toHaveBeenCalledWith(
        'admin-123',
        false, // publishedOnly (super admin)
        { page: 3, perPage: 50, orderBy: { field: 'name', direction: 'desc' } },
      );
    });

    it('should return empty results when administration has no task variants', async () => {
      const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
      mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
      mockAdministrationRepository.getTaskVariantsByAdministrationId.mockResolvedValue({ items: [], totalItems: 0 });

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
        authorizationService: mockAuthorizationService,
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
      mockAdministrationRepository.getById.mockResolvedValue(null);

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
        authorizationService: mockAuthorizationService,
      });

      await expect(
        service.listTaskVariants({ userId: 'admin-user', isSuperAdmin: true }, 'non-existent-id', defaultOptions),
      ).rejects.toThrow(ApiErrorMessage.NOT_FOUND);
      expect(mockAdministrationRepository.getTaskVariantsByAdministrationId).not.toHaveBeenCalled();
    });

    it('should throw forbidden error when non-super admin has no access to existing administration', async () => {
      const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
      mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
      // FGA: can_read permission denied via requirePermission
      mockAuthorizationService.requirePermission.mockRejectedValue(
        new ApiError(ApiErrorMessage.FORBIDDEN, {
          statusCode: StatusCodes.FORBIDDEN,
          code: ApiErrorCode.AUTH_FORBIDDEN,
          context: { userId: 'user-123', relation: 'can_read', object: 'administration:admin-123' },
        }),
      );

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
        authorizationService: mockAuthorizationService,
      });

      await expect(
        service.listTaskVariants({ userId: 'user-123', isSuperAdmin: false }, 'admin-123', defaultOptions),
      ).rejects.toThrow('You do not have permission to perform this action');
      expect(mockAdministrationRepository.getTaskVariantsByAdministrationId).not.toHaveBeenCalled();
    });

    it('should throw ApiError when database query fails', async () => {
      const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
      mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
      mockAdministrationRepository.getTaskVariantsByAdministrationId.mockRejectedValue(new Error('Database timeout'));

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
        authorizationService: mockAuthorizationService,
      });

      await expect(
        service.listTaskVariants({ userId: 'admin-user', isSuperAdmin: true }, 'admin-123', defaultOptions),
      ).rejects.toThrow('Failed to retrieve administration task variants');
    });

    describe('role-based eligibility filtering', () => {
      // Supervisory roles (teachers, admins) see all task variants.
      // Supervised roles (students) are filtered by eligibility conditions.
      // Super admins bypass all filtering.

      it('should allow user with can_list_users permission to list all task variants (supervisory - no filtering)', async () => {
        const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
        mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
        // requirePermission: can_read (verifyAdministrationAccess) passes
        mockAuthorizationService.requirePermission.mockResolvedValue(undefined);
        // hasPermission: can_list_users = true (supervisory role)
        mockAuthorizationService.hasPermission.mockResolvedValue(true);
        mockAdministrationRepository.getTaskVariantsByAdministrationId.mockResolvedValue({
          items: mockTaskVariants,
          totalItems: 2,
        });

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          userRepository: mockUserRepository,
          taskService: mockTaskService,
          authorizationService: mockAuthorizationService,
        });

        const result = await service.listTaskVariants(
          { userId: 'teacher-user', isSuperAdmin: false },
          'admin-123',
          defaultOptions,
        );

        // FGA hasPermission check for can_list_users (supervisory branching check)
        expect(mockAuthorizationService.hasPermission).toHaveBeenCalledWith(
          'teacher-user',
          'can_list_users',
          'administration:admin-123',
        );
        expect(mockTaskService.evaluateTaskVariantEligibility).not.toHaveBeenCalled();
        // Supervisory roles see all variants including draft/deprecated (publishedOnly: false)
        expect(mockAdministrationRepository.getTaskVariantsByAdministrationId).toHaveBeenCalledWith(
          'admin-123',
          false, // publishedOnly
          { page: 1, perPage: 25, orderBy: { field: 'orderIndex', direction: 'asc' } },
        );
        expect(result.items).toHaveLength(2);
      });

      it('should filter task variants for student based on assigned_if condition', async () => {
        const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
        const mockUser = UserFactory.build({ id: 'student-user', grade: '5' });
        mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
        // requirePermission: can_read (verifyAdministrationAccess) and can_create_run both pass
        mockAuthorizationService.requirePermission.mockResolvedValue(undefined);
        // hasPermission: can_list_users = false (not supervisory)
        mockAuthorizationService.hasPermission.mockResolvedValue(false);
        mockAdministrationRepository.getTaskVariantsByAdministrationId.mockResolvedValue({
          items: mockTaskVariants,
          totalItems: 2,
        });
        mockUserRepository.getById.mockResolvedValue(mockUser);
        // First variant: assigned and required, Second variant: not assigned
        mockTaskService.evaluateTaskVariantEligibility
          .mockReturnValueOnce({ isAssigned: true, isOptional: false }) // First variant: visible, required
          .mockReturnValueOnce({ isAssigned: false, isOptional: false }); // Second variant: not visible

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          userRepository: mockUserRepository,
          taskService: mockTaskService,
          authorizationService: mockAuthorizationService,
        });

        const result = await service.listTaskVariants(
          { userId: 'student-user', isSuperAdmin: false },
          'admin-123',
          defaultOptions,
        );

        // FGA permission checks: requirePermission for can_read and can_create_run, hasPermission for can_list_users (false)
        expect(mockAuthorizationService.requirePermission).toHaveBeenCalledWith(
          'student-user',
          'can_create_run',
          'administration:admin-123',
        );
        // Students only see published variants (publishedOnly: true)
        expect(mockAdministrationRepository.getTaskVariantsByAdministrationId).toHaveBeenCalledWith(
          'admin-123',
          true, // publishedOnly
          { page: 1, perPage: 25, orderBy: { field: 'orderIndex', direction: 'asc' } },
        );
        expect(mockUserRepository.getById).toHaveBeenCalledWith({ id: 'student-user' });
        // Called once per variant
        expect(mockTaskService.evaluateTaskVariantEligibility).toHaveBeenCalledTimes(2);
        expect(result.items).toHaveLength(1);
        expect(result.totalItems).toBe(1);
        // Verify optional flag is set (cast to access dynamically added property)
        expect((result.items[0]!.assignment as AssignmentWithOptional).optional).toBe(false);
      });

      it('should return empty list when student has no visible task variants (assigned_if fails for all)', async () => {
        const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
        const mockUser = UserFactory.build({ id: 'student-user', grade: '1' });
        mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
        // requirePermission: can_read (verifyAdministrationAccess) and can_create_run both pass
        mockAuthorizationService.requirePermission.mockResolvedValue(undefined);
        // hasPermission: can_list_users = false (not supervisory)
        mockAuthorizationService.hasPermission.mockResolvedValue(false);
        mockAdministrationRepository.getTaskVariantsByAdministrationId.mockResolvedValue({
          items: mockTaskVariants,
          totalItems: 2,
        });
        mockUserRepository.getById.mockResolvedValue(mockUser);
        // assigned_if fails for all variants
        mockTaskService.evaluateTaskVariantEligibility.mockReturnValue({ isAssigned: false, isOptional: false });

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          userRepository: mockUserRepository,
          taskService: mockTaskService,
          authorizationService: mockAuthorizationService,
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
        const mockUser = UserFactory.build({ id: 'student-user', grade: '5' });
        mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
        // requirePermission: can_read (verifyAdministrationAccess) and can_create_run both pass
        mockAuthorizationService.requirePermission.mockResolvedValue(undefined);
        // hasPermission: can_list_users = false (not supervisory)
        mockAuthorizationService.hasPermission.mockResolvedValue(false);
        mockAdministrationRepository.getTaskVariantsByAdministrationId.mockResolvedValue({
          items: mockTaskVariants,
          totalItems: 2,
        });
        mockUserRepository.getById.mockResolvedValue(mockUser);
        // assigned_if passes for all, optional_if also passes (making them optional)
        mockTaskService.evaluateTaskVariantEligibility.mockReturnValue({ isAssigned: true, isOptional: true });

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          userRepository: mockUserRepository,
          taskService: mockTaskService,
          authorizationService: mockAuthorizationService,
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
        mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
        // requirePermission: can_read (verifyAdministrationAccess) and can_create_run both pass
        mockAuthorizationService.requirePermission.mockResolvedValue(undefined);
        // hasPermission: can_list_users = false (not supervisory)
        mockAuthorizationService.hasPermission.mockResolvedValue(false);
        mockAdministrationRepository.getTaskVariantsByAdministrationId.mockResolvedValue({
          items: mockTaskVariants,
          totalItems: 2,
        });
        mockUserRepository.getById.mockResolvedValue(null);

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          userRepository: mockUserRepository,
          taskService: mockTaskService,
          authorizationService: mockAuthorizationService,
        });

        await expect(
          service.listTaskVariants({ userId: 'non-existent-user', isSuperAdmin: false }, 'admin-123', defaultOptions),
        ).rejects.toThrow('Failed to retrieve user data for eligibility check');
      });

      it('should pass conditions to evaluateTaskVariantEligibility for eligibility and optionality evaluation', async () => {
        const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
        const mockUser = UserFactory.build({ id: 'student-user', grade: '5' });
        const assignedIfCondition = { field: 'studentData.grade', op: 'EQUAL', value: 5 };
        const optionalIfCondition = { field: 'studentData.statusEll', op: 'EQUAL', value: 'active' };
        const variantWithConditions = createMockTaskVariant({
          variantId: 'variant-1',
          variantName: 'Test Variant',
          taskId: 'task-1',
          taskName: 'Test Task',
          conditionsAssignment: assignedIfCondition,
          conditionsRequirements: optionalIfCondition,
          variantOverrides: { description: null, updatedAt: null },
          taskOverrides: { description: null },
          assignmentOverrides: { updatedAt: null },
        });
        mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
        // requirePermission: can_read (verifyAdministrationAccess) and can_create_run both pass
        mockAuthorizationService.requirePermission.mockResolvedValue(undefined);
        // hasPermission: can_list_users = false (not supervisory)
        mockAuthorizationService.hasPermission.mockResolvedValue(false);
        mockAdministrationRepository.getTaskVariantsByAdministrationId.mockResolvedValue({
          items: [variantWithConditions],
          totalItems: 1,
        });
        mockUserRepository.getById.mockResolvedValue(mockUser);
        // assigned and optional
        mockTaskService.evaluateTaskVariantEligibility.mockReturnValue({ isAssigned: true, isOptional: true });

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          userRepository: mockUserRepository,
          taskService: mockTaskService,
          authorizationService: mockAuthorizationService,
        });

        const result = await service.listTaskVariants(
          { userId: 'student-user', isSuperAdmin: false },
          'admin-123',
          defaultOptions,
        );

        // Called once with user, assigned_if, and optional_if
        expect(mockTaskService.evaluateTaskVariantEligibility).toHaveBeenCalledWith(
          mockUser,
          assignedIfCondition,
          optionalIfCondition,
        );
        // Result should have optional=true - cast to access dynamically added property
        expect((result.items[0]!.assignment as AssignmentWithOptional).optional).toBe(true);
      });

      it('should handle null conditions (null assigned_if = visible, null optional_if = required)', async () => {
        const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
        const mockUser = UserFactory.build({ id: 'student-user', grade: '5' });
        const variantWithNullConditions = createMockTaskVariant({
          variantId: 'variant-1',
          variantName: 'Test Variant',
          taskId: 'task-1',
          taskName: 'Test Task',
          variantOverrides: { description: null, updatedAt: null },
          taskOverrides: { description: null },
          assignmentOverrides: { updatedAt: null },
        });
        mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
        // requirePermission: can_read (verifyAdministrationAccess) and can_create_run both pass
        mockAuthorizationService.requirePermission.mockResolvedValue(undefined);
        // hasPermission: can_list_users = false (not supervisory)
        mockAuthorizationService.hasPermission.mockResolvedValue(false);
        mockAdministrationRepository.getTaskVariantsByAdministrationId.mockResolvedValue({
          items: [variantWithNullConditions],
          totalItems: 1,
        });
        mockUserRepository.getById.mockResolvedValue(mockUser);
        // null assigned_if = assigned to all, null optional_if = required
        mockTaskService.evaluateTaskVariantEligibility.mockReturnValue({ isAssigned: true, isOptional: false });

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          userRepository: mockUserRepository,
          taskService: mockTaskService,
          authorizationService: mockAuthorizationService,
        });

        const result = await service.listTaskVariants(
          { userId: 'student-user', isSuperAdmin: false },
          'admin-123',
          defaultOptions,
        );

        // Called with both null conditions
        expect(mockTaskService.evaluateTaskVariantEligibility).toHaveBeenCalledWith(mockUser, null, null);
        // Variant should be visible (null assigned_if = assigned to all)
        expect(result.items).toHaveLength(1);
        // Null optional_if means required (optional=false)
        // Cast to access dynamically added property
        expect((result.items[0]!.assignment as AssignmentWithOptional).optional).toBe(false);
      });

      it('should exclude variant and not crash when eligibility evaluation throws error (malformed condition)', async () => {
        const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
        const mockUser = UserFactory.build({ id: 'student-user', grade: '5' });
        const variantWithMalformedCondition = createMockTaskVariant({
          variantId: 'variant-malformed',
          variantName: 'Malformed Variant',
          taskId: 'task-1',
          taskName: 'Test Task',
          orderIndex: 0,
          conditionsAssignment: { invalidField: 'bad data' }, // Malformed
          variantOverrides: { description: null, updatedAt: null },
          taskOverrides: { description: null },
          assignmentOverrides: { updatedAt: null },
        });
        const variantWithValidCondition = createMockTaskVariant({
          variantId: 'variant-valid',
          variantName: 'Valid Variant',
          taskId: 'task-2',
          taskName: 'Test Task 2',
          orderIndex: 1,
          variantOverrides: { description: null, updatedAt: null },
          taskOverrides: { description: null },
          assignmentOverrides: { updatedAt: null },
        });
        mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
        // requirePermission: can_read (verifyAdministrationAccess) and can_create_run both pass
        mockAuthorizationService.requirePermission.mockResolvedValue(undefined);
        // hasPermission: can_list_users = false (not supervisory)
        mockAuthorizationService.hasPermission.mockResolvedValue(false);
        mockAdministrationRepository.getTaskVariantsByAdministrationId.mockResolvedValue({
          items: [variantWithMalformedCondition, variantWithValidCondition],
          totalItems: 2,
        });
        mockUserRepository.getById.mockResolvedValue(mockUser);
        // First call throws (malformed conditions), second call succeeds
        mockTaskService.evaluateTaskVariantEligibility
          .mockImplementationOnce(() => {
            throw new Error('Invalid condition structure');
          })
          .mockReturnValueOnce({ isAssigned: true, isOptional: false });

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          userRepository: mockUserRepository,
          taskService: mockTaskService,
          authorizationService: mockAuthorizationService,
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

      it('should throw forbidden error for non-student supervised roles (can_list_users and can_create_run both denied)', async () => {
        const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
        mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
        // requirePermission: can_read passes, can_create_run rejects
        mockAuthorizationService.requirePermission
          .mockResolvedValueOnce(undefined) // can_read
          .mockRejectedValueOnce(
            new ApiError(ApiErrorMessage.FORBIDDEN, {
              statusCode: StatusCodes.FORBIDDEN,
              code: ApiErrorCode.AUTH_FORBIDDEN,
              context: { userId: 'guardian-user', relation: 'can_create_run', object: 'administration:admin-123' },
            }),
          ); // can_create_run
        // hasPermission: can_list_users = false (not supervisory)
        mockAuthorizationService.hasPermission.mockResolvedValue(false);

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          userRepository: mockUserRepository,
          taskService: mockTaskService,
          authorizationService: mockAuthorizationService,
        });

        await expect(
          service.listTaskVariants({ userId: 'guardian-user', isSuperAdmin: false }, 'admin-123', defaultOptions),
        ).rejects.toMatchObject({
          message: ApiErrorMessage.FORBIDDEN,
          statusCode: StatusCodes.FORBIDDEN,
          code: ApiErrorCode.AUTH_FORBIDDEN,
        });
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

        mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
        // requirePermission: can_read (verifyAdministrationAccess) passes
        mockAuthorizationService.requirePermission.mockResolvedValue(undefined);
        // hasPermission: can_list_users = true (supervisory role)
        mockAuthorizationService.hasPermission.mockResolvedValue(true);
        mockAdministrationRepository.getAgreementsByAdministrationId.mockResolvedValue({
          items: [{ agreement: mockAgreement, currentVersion: mockVersion }],
          totalItems: 1,
        });

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          authorizationService: mockAuthorizationService,
        });

        const result = await service.listAgreements(
          { userId: 'user-123', isSuperAdmin: false },
          mockAdmin.id,
          defaultAgreementOptions,
        );

        expect(mockAdministrationRepository.getById).toHaveBeenCalledWith({ id: mockAdmin.id });
        expect(mockAuthorizationService.requirePermission).toHaveBeenCalledWith(
          'user-123',
          'can_read',
          `administration:${mockAdmin.id}`,
        );
        expect(result.items).toHaveLength(1);
        expect(result.items[0]!.agreement.id).toBe(mockAgreement.id);
      });

      it('should return 404 when administration does not exist', async () => {
        mockAdministrationRepository.getById.mockResolvedValue(null);

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          authorizationService: mockAuthorizationService,
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
        mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
        // FGA: can_read permission denied via requirePermission
        mockAuthorizationService.requirePermission.mockRejectedValue(
          new ApiError(ApiErrorMessage.FORBIDDEN, {
            statusCode: StatusCodes.FORBIDDEN,
            code: ApiErrorCode.AUTH_FORBIDDEN,
            context: { userId: 'user-123', relation: 'can_read', object: `administration:${mockAdmin.id}` },
          }),
        );

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          authorizationService: mockAuthorizationService,
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

        mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
        mockAdministrationRepository.getAgreementsByAdministrationId.mockResolvedValue({
          items: [{ agreement: mockAgreement, currentVersion: mockVersion }],
          totalItems: 1,
        });

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          authorizationService: mockAuthorizationService,
        });

        const result = await service.listAgreements(
          { userId: 'admin-123', isSuperAdmin: true },
          mockAdmin.id,
          defaultAgreementOptions,
        );

        // Super admin bypasses FGA permission checks
        expect(mockAuthorizationService.requirePermission).not.toHaveBeenCalled();
        expect(mockAuthorizationService.hasPermission).not.toHaveBeenCalled();
        expect(result.items).toHaveLength(1);
      });
    });

    describe('data retrieval', () => {
      it('should pass correct parameters to repository', async () => {
        const mockAdmin = AdministrationFactory.build();
        mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
        mockAdministrationRepository.getAgreementsByAdministrationId.mockResolvedValue({ items: [], totalItems: 0 });

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          authorizationService: mockAuthorizationService,
        });

        await service.listAgreements({ userId: 'admin-123', isSuperAdmin: true }, mockAdmin.id, {
          page: 2,
          perPage: 10,
          sortBy: 'agreementType',
          sortOrder: 'desc',
          locale: 'es',
        });

        expect(mockAdministrationRepository.getAgreementsByAdministrationId).toHaveBeenCalledWith(mockAdmin.id, {
          page: 2,
          perPage: 10,
          orderBy: {
            field: 'agreementType',
            direction: 'desc',
          },
          locale: 'es',
        });
      });

      it('should return agreements with current version', async () => {
        const mockAdmin = AdministrationFactory.build();
        const mockAgreement = AgreementFactory.build({ name: 'Test Agreement', agreementType: 'tos' });
        const mockVersion = AgreementVersionFactory.build({ locale: 'en-US', githubFilename: 'TOS.md' });

        mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
        mockAdministrationRepository.getAgreementsByAdministrationId.mockResolvedValue({
          items: [{ agreement: mockAgreement, currentVersion: mockVersion }],
          totalItems: 1,
        });

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          authorizationService: mockAuthorizationService,
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

        mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
        mockAdministrationRepository.getAgreementsByAdministrationId.mockResolvedValue({
          items: [{ agreement: mockAgreement, currentVersion: null }],
          totalItems: 1,
        });

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          authorizationService: mockAuthorizationService,
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

        mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
        mockAdministrationRepository.getAgreementsByAdministrationId.mockResolvedValue({ items: [], totalItems: 0 });

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          authorizationService: mockAuthorizationService,
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
        mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
        mockAdministrationRepository.getAgreementsByAdministrationId.mockRejectedValue(
          new Error('Database connection lost'),
        );

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          authorizationService: mockAuthorizationService,
        });

        await expect(
          service.listAgreements({ userId: 'admin-123', isSuperAdmin: true }, mockAdmin.id, defaultAgreementOptions),
        ).rejects.toMatchObject({
          statusCode: 500,
          message: 'Failed to retrieve administration agreements',
        });
      });
    });

    describe('agreement type filtering for students', () => {
      it('should not filter agreements for super admin', async () => {
        const mockAdmin = AdministrationFactory.build();
        const tosAgreement = AgreementFactory.build({ agreementType: 'tos' });
        const assentAgreement = AgreementFactory.build({ agreementType: 'assent' });
        const consentAgreement = AgreementFactory.build({ agreementType: 'consent' });

        mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
        mockAdministrationRepository.getAgreementsByAdministrationId.mockResolvedValue({
          items: [
            { agreement: tosAgreement, currentVersion: null },
            { agreement: assentAgreement, currentVersion: null },
            { agreement: consentAgreement, currentVersion: null },
          ],
          totalItems: 3,
        });

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          authorizationService: mockAuthorizationService,
        });

        const result = await service.listAgreements(
          { userId: 'admin-123', isSuperAdmin: true },
          mockAdmin.id,
          defaultAgreementOptions,
        );

        expect(result.items).toHaveLength(3);
        // Super admin bypasses FGA permission checks
        expect(mockAuthorizationService.requirePermission).not.toHaveBeenCalled();
        expect(mockAuthorizationService.hasPermission).not.toHaveBeenCalled();
      });

      it('should not filter agreements for supervisory roles (can_list_users permission)', async () => {
        const mockAdmin = AdministrationFactory.build();
        const tosAgreement = AgreementFactory.build({ agreementType: 'tos' });
        const assentAgreement = AgreementFactory.build({ agreementType: 'assent' });
        const consentAgreement = AgreementFactory.build({ agreementType: 'consent' });

        mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
        // requirePermission: can_read (verifyAdministrationAccess) passes
        mockAuthorizationService.requirePermission.mockResolvedValue(undefined);
        // hasPermission: can_list_users = true (supervisory role)
        mockAuthorizationService.hasPermission.mockResolvedValue(true);
        mockAdministrationRepository.getAgreementsByAdministrationId.mockResolvedValue({
          items: [
            { agreement: tosAgreement, currentVersion: null },
            { agreement: assentAgreement, currentVersion: null },
            { agreement: consentAgreement, currentVersion: null },
          ],
          totalItems: 3,
        });

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          authorizationService: mockAuthorizationService,
        });

        const result = await service.listAgreements(
          { userId: 'teacher-123', isSuperAdmin: false },
          mockAdmin.id,
          defaultAgreementOptions,
        );

        expect(result.items).toHaveLength(3);
      });

      it('should not filter agreements when user has can_list_users permission (supervisory takes precedence over student)', async () => {
        const mockAdmin = AdministrationFactory.build();
        const tosAgreement = AgreementFactory.build({ agreementType: 'tos', name: 'TOS Agreement' });
        const assentAgreement = AgreementFactory.build({ agreementType: 'assent', name: 'Assent Agreement' });
        const consentAgreement = AgreementFactory.build({ agreementType: 'consent', name: 'Consent Agreement' });

        mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
        // requirePermission: can_read (verifyAdministrationAccess) passes
        mockAuthorizationService.requirePermission.mockResolvedValue(undefined);
        // hasPermission: can_list_users = true (supervisory role takes precedence)
        mockAuthorizationService.hasPermission.mockResolvedValue(true);
        mockAdministrationRepository.getAgreementsByAdministrationId.mockResolvedValue({
          items: [
            { agreement: tosAgreement, currentVersion: null },
            { agreement: assentAgreement, currentVersion: null },
            { agreement: consentAgreement, currentVersion: null },
          ],
          totalItems: 3,
        });

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          authorizationService: mockAuthorizationService,
        });

        const result = await service.listAgreements(
          { userId: 'multi-role-user', isSuperAdmin: false },
          mockAdmin.id,
          defaultAgreementOptions,
        );

        // Supervisory permission takes precedence, so user sees all agreements without filtering
        expect(result.items).toHaveLength(3);
        // User data should not be fetched since supervisory permission bypasses age check
        expect(mockUserRepository.getById).not.toHaveBeenCalled();
      });

      it('should show only assent agreements for minor student (by dob)', async () => {
        const mockAdmin = AdministrationFactory.build();
        const tosAgreement = AgreementFactory.build({ agreementType: 'tos', name: 'TOS Agreement' });
        const assentAgreement = AgreementFactory.build({ agreementType: 'assent', name: 'Assent Agreement' });
        const consentAgreement = AgreementFactory.build({ agreementType: 'consent', name: 'Consent Agreement' });

        // Student born 10 years ago (under 18)
        const tenYearsAgo = new Date();
        tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10);
        const dobString = tenYearsAgo.toISOString().split('T')[0]!;
        const mockUser = UserFactory.build({ dob: dobString, grade: null });

        mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
        // requirePermission: can_read (verifyAdministrationAccess) and can_create_run both pass
        mockAuthorizationService.requirePermission.mockResolvedValue(undefined);
        // hasPermission: can_list_users = false (not supervisory)
        mockAuthorizationService.hasPermission.mockResolvedValue(false);
        mockAdministrationRepository.getAgreementsByAdministrationId.mockResolvedValue({
          items: [
            { agreement: tosAgreement, currentVersion: null },
            { agreement: assentAgreement, currentVersion: null },
            { agreement: consentAgreement, currentVersion: null },
          ],
          totalItems: 3,
        });
        mockUserRepository.getById.mockResolvedValue(mockUser);

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          userRepository: mockUserRepository,
          authorizationService: mockAuthorizationService,
        });

        const result = await service.listAgreements(
          { userId: 'student-123', isSuperAdmin: false },
          mockAdmin.id,
          defaultAgreementOptions,
        );

        expect(result.items).toHaveLength(1);
        expect(result.items[0]!.agreement.name).toBe('Assent Agreement');
        expect(result.totalItems).toBe(1);
      });

      it('should show only consent agreements for adult student (by dob)', async () => {
        const mockAdmin = AdministrationFactory.build();
        const tosAgreement = AgreementFactory.build({ agreementType: 'tos', name: 'TOS Agreement' });
        const assentAgreement = AgreementFactory.build({ agreementType: 'assent', name: 'Assent Agreement' });
        const consentAgreement = AgreementFactory.build({ agreementType: 'consent', name: 'Consent Agreement' });

        // Student born 20 years ago (over 18)
        const twentyYearsAgo = new Date();
        twentyYearsAgo.setFullYear(twentyYearsAgo.getFullYear() - 20);
        const dobString = twentyYearsAgo.toISOString().split('T')[0]!;
        const mockUser = UserFactory.build({ dob: dobString, grade: null });

        mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
        // requirePermission: can_read (verifyAdministrationAccess) and can_create_run both pass
        mockAuthorizationService.requirePermission.mockResolvedValue(undefined);
        // hasPermission: can_list_users = false (not supervisory)
        mockAuthorizationService.hasPermission.mockResolvedValue(false);
        mockAdministrationRepository.getAgreementsByAdministrationId.mockResolvedValue({
          items: [
            { agreement: tosAgreement, currentVersion: null },
            { agreement: assentAgreement, currentVersion: null },
            { agreement: consentAgreement, currentVersion: null },
          ],
          totalItems: 3,
        });
        mockUserRepository.getById.mockResolvedValue(mockUser);

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          userRepository: mockUserRepository,
          authorizationService: mockAuthorizationService,
        });

        const result = await service.listAgreements(
          { userId: 'adult-student-123', isSuperAdmin: false },
          mockAdmin.id,
          defaultAgreementOptions,
        );

        expect(result.items).toHaveLength(1);
        expect(result.items[0]!.agreement.name).toBe('Consent Agreement');
      });

      it('should show assent for minor when age estimated from grade (grade 11 = age 16)', async () => {
        const mockAdmin = AdministrationFactory.build();
        const assentAgreement = AgreementFactory.build({ agreementType: 'assent', name: 'Assent Agreement' });
        const consentAgreement = AgreementFactory.build({ agreementType: 'consent', name: 'Consent Agreement' });

        // Student with no dob but grade 11 (typical age 16)
        const mockUser = UserFactory.build({ dob: null, grade: '11' });

        mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
        // requirePermission: can_read (verifyAdministrationAccess) and can_create_run both pass
        mockAuthorizationService.requirePermission.mockResolvedValue(undefined);
        // hasPermission: can_list_users = false (not supervisory)
        mockAuthorizationService.hasPermission.mockResolvedValue(false);
        mockAdministrationRepository.getAgreementsByAdministrationId.mockResolvedValue({
          items: [
            { agreement: assentAgreement, currentVersion: null },
            { agreement: consentAgreement, currentVersion: null },
          ],
          totalItems: 2,
        });
        mockUserRepository.getById.mockResolvedValue(mockUser);

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          userRepository: mockUserRepository,
          authorizationService: mockAuthorizationService,
        });

        const result = await service.listAgreements(
          { userId: 'student-123', isSuperAdmin: false },
          mockAdmin.id,
          defaultAgreementOptions,
        );

        expect(result.items).toHaveLength(1);
        expect(result.items[0]!.agreement.name).toBe('Assent Agreement');
      });

      it('should show assent for grade 12 (conservative estimate: age 17, still minor)', async () => {
        const mockAdmin = AdministrationFactory.build();
        const assentAgreement = AgreementFactory.build({ agreementType: 'assent', name: 'Assent Agreement' });
        const consentAgreement = AgreementFactory.build({ agreementType: 'consent', name: 'Consent Agreement' });

        // Student with no dob but grade 12 - conservative age estimate is 17 (under majority age)
        const mockUser = UserFactory.build({ dob: null, grade: '12' });

        mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
        // requirePermission: can_read (verifyAdministrationAccess) and can_create_run both pass
        mockAuthorizationService.requirePermission.mockResolvedValue(undefined);
        // hasPermission: can_list_users = false (not supervisory)
        mockAuthorizationService.hasPermission.mockResolvedValue(false);
        mockAdministrationRepository.getAgreementsByAdministrationId.mockResolvedValue({
          items: [
            { agreement: assentAgreement, currentVersion: null },
            { agreement: consentAgreement, currentVersion: null },
          ],
          totalItems: 2,
        });
        mockUserRepository.getById.mockResolvedValue(mockUser);

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          userRepository: mockUserRepository,
          authorizationService: mockAuthorizationService,
        });

        const result = await service.listAgreements(
          { userId: 'student-123', isSuperAdmin: false },
          mockAdmin.id,
          defaultAgreementOptions,
        );

        // Grade 12 maps to age 17 (conservative), still a minor
        expect(result.items).toHaveLength(1);
        expect(result.items[0]!.agreement.name).toBe('Assent Agreement');
      });

      it('should show consent for grade 13 (conservative estimate: age 18, adult)', async () => {
        const mockAdmin = AdministrationFactory.build();
        const assentAgreement = AgreementFactory.build({ agreementType: 'assent', name: 'Assent Agreement' });
        const consentAgreement = AgreementFactory.build({ agreementType: 'consent', name: 'Consent Agreement' });

        // Student with no dob but grade 13 - conservative age estimate is 18 (majority age)
        const mockUser = UserFactory.build({ dob: null, grade: '13' });

        mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
        // requirePermission: can_read (verifyAdministrationAccess) and can_create_run both pass
        mockAuthorizationService.requirePermission.mockResolvedValue(undefined);
        // hasPermission: can_list_users = false (not supervisory)
        mockAuthorizationService.hasPermission.mockResolvedValue(false);
        mockAdministrationRepository.getAgreementsByAdministrationId.mockResolvedValue({
          items: [
            { agreement: assentAgreement, currentVersion: null },
            { agreement: consentAgreement, currentVersion: null },
          ],
          totalItems: 2,
        });
        mockUserRepository.getById.mockResolvedValue(mockUser);

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          userRepository: mockUserRepository,
          authorizationService: mockAuthorizationService,
        });

        const result = await service.listAgreements(
          { userId: 'student-123', isSuperAdmin: false },
          mockAdmin.id,
          defaultAgreementOptions,
        );

        expect(result.items).toHaveLength(1);
        expect(result.items[0]!.agreement.name).toBe('Consent Agreement');
      });

      it('should show assent when age cannot be determined (conservative: treat as minor)', async () => {
        const mockAdmin = AdministrationFactory.build();
        const assentAgreement = AgreementFactory.build({ agreementType: 'assent', name: 'Assent Agreement' });
        const consentAgreement = AgreementFactory.build({ agreementType: 'consent', name: 'Consent Agreement' });

        // Student with neither dob nor grade - conservative approach: treat as minor
        const mockUser = UserFactory.build({ dob: null, grade: null });

        mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
        // requirePermission: can_read (verifyAdministrationAccess) and can_create_run both pass
        mockAuthorizationService.requirePermission.mockResolvedValue(undefined);
        // hasPermission: can_list_users = false (not supervisory)
        mockAuthorizationService.hasPermission.mockResolvedValue(false);
        mockAdministrationRepository.getAgreementsByAdministrationId.mockResolvedValue({
          items: [
            { agreement: assentAgreement, currentVersion: null },
            { agreement: consentAgreement, currentVersion: null },
          ],
          totalItems: 2,
        });
        mockUserRepository.getById.mockResolvedValue(mockUser);

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          userRepository: mockUserRepository,
          authorizationService: mockAuthorizationService,
        });

        const result = await service.listAgreements(
          { userId: 'student-123', isSuperAdmin: false },
          mockAdmin.id,
          defaultAgreementOptions,
        );

        expect(result.items).toHaveLength(1);
        expect(result.items[0]!.agreement.name).toBe('Assent Agreement');
      });

      it('should never show TOS agreements to students regardless of age', async () => {
        const mockAdmin = AdministrationFactory.build();
        const tosAgreement = AgreementFactory.build({ agreementType: 'tos', name: 'TOS Agreement' });

        // Adult student
        const twentyYearsAgo = new Date();
        twentyYearsAgo.setFullYear(twentyYearsAgo.getFullYear() - 20);
        const dobString = twentyYearsAgo.toISOString().split('T')[0]!;
        const mockUser = UserFactory.build({ dob: dobString, grade: null });

        mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
        // requirePermission: can_read (verifyAdministrationAccess) and can_create_run both pass
        mockAuthorizationService.requirePermission.mockResolvedValue(undefined);
        // hasPermission: can_list_users = false (not supervisory)
        mockAuthorizationService.hasPermission.mockResolvedValue(false);
        mockAdministrationRepository.getAgreementsByAdministrationId.mockResolvedValue({
          items: [{ agreement: tosAgreement, currentVersion: null }],
          totalItems: 1,
        });
        mockUserRepository.getById.mockResolvedValue(mockUser);

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          userRepository: mockUserRepository,
          authorizationService: mockAuthorizationService,
        });

        const result = await service.listAgreements(
          { userId: 'adult-student-123', isSuperAdmin: false },
          mockAdmin.id,
          defaultAgreementOptions,
        );

        expect(result.items).toHaveLength(0);
        expect(result.totalItems).toBe(0);
      });

      it('should throw error when user not found during filtering', async () => {
        const mockAdmin = AdministrationFactory.build();
        const assentAgreement = AgreementFactory.build({ agreementType: 'assent' });

        mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
        // requirePermission: can_read (verifyAdministrationAccess) and can_create_run both pass
        mockAuthorizationService.requirePermission.mockResolvedValue(undefined);
        // hasPermission: can_list_users = false (not supervisory)
        mockAuthorizationService.hasPermission.mockResolvedValue(false);
        mockAdministrationRepository.getAgreementsByAdministrationId.mockResolvedValue({
          items: [{ agreement: assentAgreement, currentVersion: null }],
          totalItems: 1,
        });
        mockUserRepository.getById.mockResolvedValue(null);

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          userRepository: mockUserRepository,
          authorizationService: mockAuthorizationService,
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

      it('should return 403 Forbidden for non-student supervised roles (can_list_users and can_create_run both denied)', async () => {
        const mockAdmin = AdministrationFactory.build();

        mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
        // requirePermission: can_read passes, can_create_run rejects
        mockAuthorizationService.requirePermission
          .mockResolvedValueOnce(undefined) // can_read
          .mockRejectedValueOnce(
            new ApiError(ApiErrorMessage.FORBIDDEN, {
              statusCode: StatusCodes.FORBIDDEN,
              code: ApiErrorCode.AUTH_FORBIDDEN,
              context: { userId: 'guardian-123', relation: 'can_create_run', object: `administration:${mockAdmin.id}` },
            }),
          ); // can_create_run
        // hasPermission: can_list_users = false (not supervisory)
        mockAuthorizationService.hasPermission.mockResolvedValue(false);
        mockAdministrationRepository.getAgreementsByAdministrationId.mockResolvedValue({ items: [], totalItems: 0 });

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          authorizationService: mockAuthorizationService,
        });

        await expect(
          service.listAgreements(
            { userId: 'guardian-123', isSuperAdmin: false },
            mockAdmin.id,
            defaultAgreementOptions,
          ),
        ).rejects.toMatchObject({
          statusCode: 403,
        });
      });

      it('should return 403 Forbidden when user has can_read but neither can_list_users nor can_create_run', async () => {
        const mockAdmin = AdministrationFactory.build();

        mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
        // requirePermission: can_read passes, can_create_run rejects
        mockAuthorizationService.requirePermission
          .mockResolvedValueOnce(undefined) // can_read
          .mockRejectedValueOnce(
            new ApiError(ApiErrorMessage.FORBIDDEN, {
              statusCode: StatusCodes.FORBIDDEN,
              code: ApiErrorCode.AUTH_FORBIDDEN,
              context: { userId: 'parent-123', relation: 'can_create_run', object: `administration:${mockAdmin.id}` },
            }),
          ); // can_create_run
        // hasPermission: can_list_users = false (not supervisory)
        mockAuthorizationService.hasPermission.mockResolvedValue(false);
        mockAdministrationRepository.getAgreementsByAdministrationId.mockResolvedValue({ items: [], totalItems: 0 });

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          authorizationService: mockAuthorizationService,
        });

        await expect(
          service.listAgreements({ userId: 'parent-123', isSuperAdmin: false }, mockAdmin.id, defaultAgreementOptions),
        ).rejects.toMatchObject({
          statusCode: 403,
        });
      });
    });
  });

  describe('deleteById', () => {
    it('should delete administration for super admin when no runs exist', async () => {
      const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
      mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
      mockRunRepository.getByAdministrationId.mockResolvedValue(null);
      mockAdministrationRepository.delete.mockResolvedValue(undefined);

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
        runRepository: mockRunRepository,
        authorizationService: mockAuthorizationService,
      });

      await service.deleteById({ userId: 'super-admin-user', isSuperAdmin: true }, 'admin-123');

      expect(mockAdministrationRepository.getById).toHaveBeenCalledWith({ id: 'admin-123' });
      // Super admin bypasses FGA permission checks
      expect(mockAuthorizationService.requirePermission).not.toHaveBeenCalled();
      expect(mockRunRepository.getByAdministrationId).toHaveBeenCalledWith('admin-123');
      expect(mockAdministrationRepository.delete).toHaveBeenCalledWith({ id: 'admin-123' });
    });

    it('should delete administration for authorized non-super admin with can_delete permission', async () => {
      const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
      mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
      // FGA: can_delete permission granted via requirePermission
      mockAuthorizationService.requirePermission.mockResolvedValue(undefined);
      mockRunRepository.getByAdministrationId.mockResolvedValue(null);
      mockAdministrationRepository.delete.mockResolvedValue(undefined);

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
        runRepository: mockRunRepository,
        authorizationService: mockAuthorizationService,
      });

      await service.deleteById({ userId: 'admin-user', isSuperAdmin: false }, 'admin-123');

      expect(mockAdministrationRepository.getById).toHaveBeenCalledWith({ id: 'admin-123' });
      // Should check can_delete permission via FGA requirePermission
      expect(mockAuthorizationService.requirePermission).toHaveBeenCalledWith(
        'admin-user',
        'can_delete',
        'administration:admin-123',
      );
      expect(mockRunRepository.getByAdministrationId).toHaveBeenCalledWith('admin-123');
      expect(mockAdministrationRepository.delete).toHaveBeenCalledWith({ id: 'admin-123' });
    });

    it('should throw not-found error when administration does not exist', async () => {
      mockAdministrationRepository.getById.mockResolvedValue(null);

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
        runRepository: mockRunRepository,
        authorizationService: mockAuthorizationService,
      });

      await expect(
        service.deleteById({ userId: 'admin-user', isSuperAdmin: true }, 'non-existent-id'),
      ).rejects.toMatchObject({
        statusCode: 404,
        message: ApiErrorMessage.NOT_FOUND,
      });
      expect(mockRunRepository.getByAdministrationId).not.toHaveBeenCalled();
      expect(mockAdministrationRepository.delete).not.toHaveBeenCalled();
    });

    it('should throw forbidden error when non-super admin lacks can_delete permission', async () => {
      const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
      mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
      // FGA: can_delete permission denied via requirePermission
      mockAuthorizationService.requirePermission.mockRejectedValue(
        new ApiError(ApiErrorMessage.FORBIDDEN, {
          statusCode: StatusCodes.FORBIDDEN,
          code: ApiErrorCode.AUTH_FORBIDDEN,
          context: { userId: 'teacher-user', relation: 'can_delete', object: 'administration:admin-123' },
        }),
      );

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
        runRepository: mockRunRepository,
        authorizationService: mockAuthorizationService,
      });

      await expect(
        service.deleteById({ userId: 'teacher-user', isSuperAdmin: false }, 'admin-123'),
      ).rejects.toMatchObject({
        statusCode: 403,
        message: ApiErrorMessage.FORBIDDEN,
      });
      expect(mockRunRepository.getByAdministrationId).not.toHaveBeenCalled();
      expect(mockAdministrationRepository.delete).not.toHaveBeenCalled();
    });

    it('should throw conflict error when runs exist for the administration', async () => {
      const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
      mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
      mockRunRepository.getByAdministrationId.mockResolvedValue(RunFactory.build({ id: 'run-123' }));

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
        runRepository: mockRunRepository,
        authorizationService: mockAuthorizationService,
      });

      await expect(service.deleteById({ userId: 'admin-user', isSuperAdmin: true }, 'admin-123')).rejects.toMatchObject(
        {
          statusCode: 409,
          message: 'Cannot delete administration with existing assessment runs',
        },
      );
      expect(mockAdministrationRepository.delete).not.toHaveBeenCalled();
    });

    it('should throw internal error on unexpected database failure', async () => {
      const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
      mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
      mockRunRepository.getByAdministrationId.mockResolvedValue(null);
      mockAdministrationRepository.delete.mockRejectedValue(new Error('Database connection lost'));

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
        runRepository: mockRunRepository,
        authorizationService: mockAuthorizationService,
      });

      await expect(service.deleteById({ userId: 'admin-user', isSuperAdmin: true }, 'admin-123')).rejects.toMatchObject(
        {
          statusCode: 500,
          message: 'Failed to delete administration',
        },
      );
    });
  });
});
