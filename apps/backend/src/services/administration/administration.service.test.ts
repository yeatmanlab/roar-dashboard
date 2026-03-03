import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StatusCodes } from 'http-status-codes';
import { AdministrationService } from './administration.service';
import { AdministrationFactory } from '../../test-support/factories/administration.factory';
import { OrgFactory } from '../../test-support/factories/org.factory';
import { ClassFactory } from '../../test-support/factories/class.factory';
import { GroupFactory } from '../../test-support/factories/group.factory';
import { UserFactory } from '../../test-support/factories/user.factory';
import { TaskFactory } from '../../test-support/factories/task.factory';
import { TaskVariantFactory } from '../../test-support/factories/task-variant.factory';
import { AdministrationTaskVariantFactory } from '../../test-support/factories/administration-task-variant.factory';
import { AgreementFactory } from '../../test-support/factories/agreement.factory';
import { AgreementVersionFactory } from '../../test-support/factories/agreement-version.factory';
import { RunFactory } from '../../test-support/factories/run.factory';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { ApiErrorMessage } from '../../enums/api-error-message.enum';
import { UserRole } from '../../enums/user-role.enum';
import type { AssignmentWithOptional, TaskVariantWithAssignment } from '../../repositories/administration.repository';
import {
  createMockAdministrationRepository,
  createMockAdministrationTaskVariantRepository,
  createMockUserRepository,
} from '../../test-support/repositories';
import { createMockRunsService, createMockTaskService } from '../../test-support/services';

describe('AdministrationService', () => {
  let mockAdministrationRepository: ReturnType<typeof createMockAdministrationRepository>;
  let mockAdministrationTaskVariantRepository: ReturnType<typeof createMockAdministrationTaskVariantRepository>;
  let mockUserRepository: ReturnType<typeof createMockUserRepository>;
  let mockRunsService: ReturnType<typeof createMockRunsService>;
  let mockTaskService: ReturnType<typeof createMockTaskService>;

  beforeEach(() => {
    vi.resetAllMocks();
    mockAdministrationRepository = createMockAdministrationRepository();
    mockAdministrationTaskVariantRepository = createMockAdministrationTaskVariantRepository();
    mockUserRepository = createMockUserRepository();
    mockRunsService = createMockRunsService();
    mockTaskService = createMockTaskService();
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
      expect(mockAdministrationRepository.listAuthorized).not.toHaveBeenCalled();
      expect(result.items).toHaveLength(3);
      expect(result.totalItems).toBe(3);
    });

    it('should use listAuthorized for non-super admin users', async () => {
      const mockAdmins = AdministrationFactory.buildList(3);

      mockAdministrationRepository.listAuthorized.mockResolvedValue({
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

      expect(mockAdministrationRepository.listAuthorized).toHaveBeenCalledWith(
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
      expect(mockAdministrationRepository.getAll).not.toHaveBeenCalled();
      expect(result.items).toHaveLength(3);
      expect(result.totalItems).toBe(3);
    });

    it('should pass pagination options to repository', async () => {
      mockAdministrationRepository.listAuthorized.mockResolvedValue({ items: [], totalItems: 0 });

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

      expect(mockAdministrationRepository.listAuthorized).toHaveBeenCalledWith(expect.any(Object), {
        page: 3,
        perPage: 50,
        orderBy: { field: 'dateStart', direction: 'asc' },
      });
    });

    it('should return empty results when user has no accessible administrations', async () => {
      mockAdministrationRepository.listAuthorized.mockResolvedValue({ items: [], totalItems: 0 });

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

      expect(mockAdministrationRepository.listAuthorized).toHaveBeenCalled();
      expect(result.items).toEqual([]);
      expect(result.totalItems).toBe(0);
    });

    it('should map API sort field "name" to database column "name"', async () => {
      mockAdministrationRepository.listAuthorized.mockResolvedValue({ items: [], totalItems: 0 });

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

      expect(mockAdministrationRepository.listAuthorized).toHaveBeenCalledWith(expect.any(Object), {
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

      it('should pass status filter to listAuthorized for regular users', async () => {
        const mockAdmins = AdministrationFactory.buildList(2);
        mockAdministrationRepository.listAuthorized.mockResolvedValue({ items: mockAdmins, totalItems: 2 });

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
        });

        await service.list(
          { userId: 'user-123', isSuperAdmin: false },
          { page: 1, perPage: 25, sortBy: 'createdAt', sortOrder: 'desc', status: 'past' },
        );

        expect(mockAdministrationRepository.listAuthorized).toHaveBeenCalledWith(
          expect.objectContaining({ userId: 'user-123' }),
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
        mockRunsService.getRunStatsByAdministrationIds.mockResolvedValue(runStats);

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          runsService: mockRunsService,
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
        mockAdministrationRepository.listAuthorized.mockResolvedValue({ items: mockAdmins, totalItems: 2 });

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          runsService: mockRunsService,
        });

        const result = await service.list(
          { userId: 'user-123', isSuperAdmin: false },
          { page: 1, perPage: 25, sortBy: 'createdAt', sortOrder: 'desc', embed: ['stats'] },
        );

        expect(mockAdministrationRepository.getAssignedUserCountsByAdministrationIds).not.toHaveBeenCalled();
        expect(mockRunsService.getRunStatsByAdministrationIds).not.toHaveBeenCalled();
        expect(result.items[0]).not.toHaveProperty('stats');
      });

      it('should not fetch stats when embed option is not provided', async () => {
        const mockAdmins = AdministrationFactory.buildList(2);
        mockAdministrationRepository.listAll.mockResolvedValue({ items: mockAdmins, totalItems: 2 });

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          runsService: mockRunsService,
        });

        const result = await service.list(
          { userId: 'admin-123', isSuperAdmin: true },
          { page: 1, perPage: 25, sortBy: 'createdAt', sortOrder: 'desc' },
        );

        expect(mockAdministrationRepository.getAssignedUserCountsByAdministrationIds).not.toHaveBeenCalled();
        expect(mockRunsService.getRunStatsByAdministrationIds).not.toHaveBeenCalled();
        expect(result.items[0]).not.toHaveProperty('stats');
      });

      it('should not fetch stats when embed is empty array', async () => {
        const mockAdmins = AdministrationFactory.buildList(2);
        mockAdministrationRepository.listAll.mockResolvedValue({ items: mockAdmins, totalItems: 2 });

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          runsService: mockRunsService,
        });

        const result = await service.list(
          { userId: 'admin-123', isSuperAdmin: true },
          { page: 1, perPage: 25, sortBy: 'createdAt', sortOrder: 'desc', embed: [] },
        );

        expect(mockAdministrationRepository.getAssignedUserCountsByAdministrationIds).not.toHaveBeenCalled();
        expect(mockRunsService.getRunStatsByAdministrationIds).not.toHaveBeenCalled();
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
        mockRunsService.getRunStatsByAdministrationIds.mockResolvedValue(runStats);

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          runsService: mockRunsService,
        });

        const result = await service.list(
          { userId: 'admin-123', isSuperAdmin: true },
          { page: 1, perPage: 25, sortBy: 'createdAt', sortOrder: 'desc', embed: ['stats'] },
        );

        expect(mockAdministrationRepository.getAssignedUserCountsByAdministrationIds).toHaveBeenCalledWith([
          'admin-1',
          'admin-2',
        ]);
        expect(mockRunsService.getRunStatsByAdministrationIds).toHaveBeenCalledWith(['admin-1', 'admin-2']);
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
        mockRunsService.getRunStatsByAdministrationIds.mockResolvedValue(runStats);

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          runsService: mockRunsService,
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
        mockRunsService.getRunStatsByAdministrationIds.mockImplementation(async () => {
          callOrder.push('runs-start');
          await new Promise((r) => setTimeout(r, 10));
          callOrder.push('runs-end');
          return new Map([['admin-1', { started: 5, completed: 2 }]]);
        });

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          runsService: mockRunsService,
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
          runsService: mockRunsService,
        });

        const result = await service.list(
          { userId: 'admin-123', isSuperAdmin: true },
          { page: 1, perPage: 25, sortBy: 'createdAt', sortOrder: 'desc', embed: ['stats'] },
        );

        expect(mockAdministrationRepository.getAssignedUserCountsByAdministrationIds).not.toHaveBeenCalled();
        expect(mockRunsService.getRunStatsByAdministrationIds).not.toHaveBeenCalled();
        expect(result.items).toEqual([]);
      });

      it('should throw ApiError when assigned counts query fails', async () => {
        const mockAdmins = [AdministrationFactory.build({ id: 'admin-1' })];
        mockAdministrationRepository.listAll.mockResolvedValue({ items: mockAdmins, totalItems: 1 });

        const dbError = new Error('Database connection failed');
        mockAdministrationRepository.getAssignedUserCountsByAdministrationIds.mockRejectedValue(dbError);
        mockRunsService.getRunStatsByAdministrationIds.mockResolvedValue(
          new Map([['admin-1', { started: 5, completed: 2 }]]),
        );

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          runsService: mockRunsService,
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
        mockRunsService.getRunStatsByAdministrationIds.mockRejectedValue(dbError);

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          runsService: mockRunsService,
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
        mockRunsService.getRunStatsByAdministrationIds.mockResolvedValue(runStats);
        mockAdministrationTaskVariantRepository.getByAdministrationIds.mockResolvedValue(tasksMap);

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          administrationTaskVariantRepository: mockAdministrationTaskVariantRepository,
          runsService: mockRunsService,
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
      });

      const result = await service.getById({ userId: 'admin-user', isSuperAdmin: true }, 'admin-123');

      expect(mockAdministrationRepository.getById).toHaveBeenCalledWith({ id: 'admin-123' });
      expect(mockAdministrationRepository.getAuthorizedById).not.toHaveBeenCalled();
      expect(result).toEqual(mockAdmin);
    });

    it('should use getAuthorized for non-super admin users', async () => {
      const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
      mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
      mockAdministrationRepository.getAuthorizedById.mockResolvedValue(mockAdmin);

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
      });

      const result = await service.getById({ userId: 'user-123', isSuperAdmin: false }, 'admin-123');

      expect(mockAdministrationRepository.getById).toHaveBeenCalledWith({ id: 'admin-123' });
      expect(mockAdministrationRepository.getAuthorizedById).toHaveBeenCalledWith(
        {
          userId: 'user-123',
          allowedRoles: expect.arrayContaining(['site_administrator', 'administrator', 'teacher', 'student']),
        },
        'admin-123',
      );
      expect(result).toEqual(mockAdmin);
    });

    it('should throw not-found error when administration does not exist', async () => {
      mockAdministrationRepository.getById.mockResolvedValue(null);

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
      });

      await expect(service.getById({ userId: 'admin-user', isSuperAdmin: true }, 'non-existent-id')).rejects.toThrow(
        'Administration not found',
      );
    });

    it('should throw forbidden error when non-super admin has no access to existing administration', async () => {
      const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
      mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
      mockAdministrationRepository.getAuthorizedById.mockResolvedValue(null);

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
      });

      await expect(service.getById({ userId: 'user-123', isSuperAdmin: false }, 'admin-123')).rejects.toThrow(
        'You do not have permission to perform this action',
      );
    });

    it('should throw not-found error for non-super admin when administration does not exist', async () => {
      mockAdministrationRepository.getById.mockResolvedValue(null);

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
      });

      await expect(service.getById({ userId: 'user-123', isSuperAdmin: false }, 'non-existent-id')).rejects.toThrow(
        'Administration not found',
      );
      expect(mockAdministrationRepository.getAuthorizedById).not.toHaveBeenCalled();
    });

    it('should throw ApiError when database query fails', async () => {
      const dbError = new Error('Connection refused');
      mockAdministrationRepository.getById.mockRejectedValue(dbError);

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
      mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
      mockAdministrationRepository.getDistrictsByAdministrationId.mockResolvedValue({
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

      expect(mockAdministrationRepository.getById).toHaveBeenCalledWith({ id: 'admin-123' });
      expect(mockAdministrationRepository.getAuthorizedById).not.toHaveBeenCalled();
      expect(mockAdministrationRepository.getDistrictsByAdministrationId).toHaveBeenCalledWith('admin-123', {
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
      mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
      mockAdministrationRepository.getAuthorizedById.mockResolvedValue(mockAdmin);
      // User has a supervisory role (teacher)
      mockAdministrationRepository.getUserRolesForAdministration.mockResolvedValue(['teacher']);
      mockAdministrationRepository.getAuthorizedDistrictsByAdministrationId.mockResolvedValue({
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

      expect(mockAdministrationRepository.getById).toHaveBeenCalledWith({ id: 'admin-123' });
      expect(mockAdministrationRepository.getAuthorizedById).toHaveBeenCalledWith(
        {
          userId: 'user-123',
          allowedRoles: expect.arrayContaining(['site_administrator', 'administrator', 'teacher', 'student']),
        },
        'admin-123',
      );
      // Should use authorized method for non-super admin with supervisory role
      expect(mockAdministrationRepository.getAuthorizedDistrictsByAdministrationId).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-123' }),
        'admin-123',
        expect.any(Object),
      );
      expect(mockAdministrationRepository.getDistrictsByAdministrationId).not.toHaveBeenCalled();
      expect(result.items).toHaveLength(1);
    });

    it('should pass pagination and sorting options to repository', async () => {
      const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
      mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
      mockAdministrationRepository.getDistrictsByAdministrationId.mockResolvedValue({ items: [], totalItems: 0 });

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
      });

      await service.listDistricts({ userId: 'admin-user', isSuperAdmin: true }, 'admin-123', {
        page: 3,
        perPage: 50,
        sortBy: 'name',
        sortOrder: 'desc',
      });

      expect(mockAdministrationRepository.getDistrictsByAdministrationId).toHaveBeenCalledWith('admin-123', {
        page: 3,
        perPage: 50,
        orderBy: { field: 'name', direction: 'desc' },
      });
    });

    it('should return empty results when administration has no districts', async () => {
      const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
      mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
      mockAdministrationRepository.getDistrictsByAdministrationId.mockResolvedValue({ items: [], totalItems: 0 });

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
      mockAdministrationRepository.getById.mockResolvedValue(null);

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
      });

      await expect(
        service.listDistricts({ userId: 'admin-user', isSuperAdmin: true }, 'non-existent-id', defaultOptions),
      ).rejects.toThrow('Administration not found');
      expect(mockAdministrationRepository.getDistrictsByAdministrationId).not.toHaveBeenCalled();
    });

    it('should throw forbidden error when non-super admin has no access to existing administration', async () => {
      const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
      mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
      mockAdministrationRepository.getAuthorizedById.mockResolvedValue(null);

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
      });

      await expect(
        service.listDistricts({ userId: 'user-123', isSuperAdmin: false }, 'admin-123', defaultOptions),
      ).rejects.toThrow('You do not have permission to perform this action');
      expect(mockAdministrationRepository.getDistrictsByAdministrationId).not.toHaveBeenCalled();
    });

    it('should throw not-found error for non-super admin when administration does not exist', async () => {
      mockAdministrationRepository.getById.mockResolvedValue(null);

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
      });

      await expect(
        service.listDistricts({ userId: 'user-123', isSuperAdmin: false }, 'non-existent-id', defaultOptions),
      ).rejects.toThrow('Administration not found');
      expect(mockAdministrationRepository.getAuthorizedById).not.toHaveBeenCalled();
      expect(mockAdministrationRepository.getDistrictsByAdministrationId).not.toHaveBeenCalled();
    });

    it('should throw ApiError when getById database query fails', async () => {
      const dbError = new Error('Connection refused');
      mockAdministrationRepository.getById.mockRejectedValue(dbError);

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
      });

      await expect(
        service.listDistricts({ userId: 'admin-user', isSuperAdmin: true }, 'admin-123', defaultOptions),
      ).rejects.toThrow('Failed to retrieve administration districts');
    });

    it('should throw ApiError when getDistrictsByAdministrationId query fails', async () => {
      const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
      mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
      mockAdministrationRepository.getDistrictsByAdministrationId.mockRejectedValue(new Error('Database timeout'));

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
        mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
        mockAdministrationRepository.getAuthorizedById.mockResolvedValue(mockAdmin);
        // Edge case: user passed verifyAdministrationAccess but has no roles (empty array)
        mockAdministrationRepository.getUserRolesForAdministration.mockResolvedValue([]);

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
        });

        await expect(
          service.listDistricts({ userId: 'user-with-no-roles', isSuperAdmin: false }, 'admin-123', defaultOptions),
        ).rejects.toThrow(ApiErrorMessage.FORBIDDEN);
        expect(mockAdministrationRepository.getDistrictsByAdministrationId).not.toHaveBeenCalled();
        expect(mockAdministrationRepository.getAuthorizedDistrictsByAdministrationId).not.toHaveBeenCalled();
      });

      it('should throw forbidden error when user only has supervised roles', async () => {
        const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
        mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
        mockAdministrationRepository.getAuthorizedById.mockResolvedValue(mockAdmin);
        // User only has 'student' role, which is a supervised role
        mockAdministrationRepository.getUserRolesForAdministration.mockResolvedValue(['student']);

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
        });

        await expect(
          service.listDistricts({ userId: 'student-user', isSuperAdmin: false }, 'admin-123', defaultOptions),
        ).rejects.toThrow(ApiErrorMessage.FORBIDDEN);
        expect(mockAdministrationRepository.getDistrictsByAdministrationId).not.toHaveBeenCalled();
        expect(mockAdministrationRepository.getAuthorizedDistrictsByAdministrationId).not.toHaveBeenCalled();
      });

      it('should throw forbidden error when user has guardian role', async () => {
        const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
        mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
        mockAdministrationRepository.getAuthorizedById.mockResolvedValue(mockAdmin);
        mockAdministrationRepository.getUserRolesForAdministration.mockResolvedValue(['guardian']);

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
        });

        await expect(
          service.listDistricts({ userId: 'guardian-user', isSuperAdmin: false }, 'admin-123', defaultOptions),
        ).rejects.toThrow(ApiErrorMessage.FORBIDDEN);
      });

      it('should throw forbidden error when user has parent role', async () => {
        const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
        mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
        mockAdministrationRepository.getAuthorizedById.mockResolvedValue(mockAdmin);
        mockAdministrationRepository.getUserRolesForAdministration.mockResolvedValue(['parent']);

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
        });

        await expect(
          service.listDistricts({ userId: 'parent-user', isSuperAdmin: false }, 'admin-123', defaultOptions),
        ).rejects.toThrow(ApiErrorMessage.FORBIDDEN);
      });

      it('should throw forbidden error when user has relative role', async () => {
        const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
        mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
        mockAdministrationRepository.getAuthorizedById.mockResolvedValue(mockAdmin);
        mockAdministrationRepository.getUserRolesForAdministration.mockResolvedValue(['relative']);

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
        mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
        mockAdministrationRepository.getAuthorizedById.mockResolvedValue(mockAdmin);
        mockAdministrationRepository.getUserRolesForAdministration.mockResolvedValue(['teacher']);
        mockAdministrationRepository.getAuthorizedDistrictsByAdministrationId.mockResolvedValue({
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

        expect(mockAdministrationRepository.getAuthorizedDistrictsByAdministrationId).toHaveBeenCalledWith(
          expect.objectContaining({ userId: 'teacher-user' }),
          'admin-123',
          expect.any(Object),
        );
        expect(mockAdministrationRepository.getDistrictsByAdministrationId).not.toHaveBeenCalled();
        expect(result.items).toHaveLength(1);
      });

      it('should use authorized method for administrator (supervisory role)', async () => {
        const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
        const mockDistricts = [OrgFactory.build({ id: 'district-1', orgType: 'district' })];
        mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
        mockAdministrationRepository.getAuthorizedById.mockResolvedValue(mockAdmin);
        mockAdministrationRepository.getUserRolesForAdministration.mockResolvedValue(['administrator']);
        mockAdministrationRepository.getAuthorizedDistrictsByAdministrationId.mockResolvedValue({
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

        expect(mockAdministrationRepository.getAuthorizedDistrictsByAdministrationId).toHaveBeenCalled();
        expect(mockAdministrationRepository.getDistrictsByAdministrationId).not.toHaveBeenCalled();
        expect(result.items).toHaveLength(1);
      });

      it('should allow access when user has both supervised and supervisory roles', async () => {
        const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
        const mockDistricts = [OrgFactory.build({ id: 'district-1', orgType: 'district' })];
        mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
        mockAdministrationRepository.getAuthorizedById.mockResolvedValue(mockAdmin);
        // User has both student (supervised) and teacher (supervisory) roles
        mockAdministrationRepository.getUserRolesForAdministration.mockResolvedValue(['student', 'teacher']);
        mockAdministrationRepository.getAuthorizedDistrictsByAdministrationId.mockResolvedValue({
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
        expect(mockAdministrationRepository.getAuthorizedDistrictsByAdministrationId).toHaveBeenCalled();
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
      mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
      mockAdministrationRepository.getSchoolsByAdministrationId.mockResolvedValue({
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

      expect(mockAdministrationRepository.getById).toHaveBeenCalledWith({ id: 'admin-123' });
      expect(mockAdministrationRepository.getAuthorizedById).not.toHaveBeenCalled();
      expect(mockAdministrationRepository.getSchoolsByAdministrationId).toHaveBeenCalledWith('admin-123', {
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
      mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
      mockAdministrationRepository.getAuthorizedById.mockResolvedValue(mockAdmin);
      // User has a supervisory role (teacher)
      mockAdministrationRepository.getUserRolesForAdministration.mockResolvedValue(['teacher']);
      mockAdministrationRepository.getAuthorizedSchoolsByAdministrationId.mockResolvedValue({
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

      expect(mockAdministrationRepository.getById).toHaveBeenCalledWith({ id: 'admin-123' });
      expect(mockAdministrationRepository.getAuthorizedById).toHaveBeenCalledWith(
        {
          userId: 'user-123',
          allowedRoles: expect.arrayContaining(['site_administrator', 'administrator', 'teacher', 'student']),
        },
        'admin-123',
      );
      // Should use authorized method for non-super admin with supervisory role
      expect(mockAdministrationRepository.getAuthorizedSchoolsByAdministrationId).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-123' }),
        'admin-123',
        expect.any(Object),
      );
      expect(mockAdministrationRepository.getSchoolsByAdministrationId).not.toHaveBeenCalled();
      expect(result.items).toHaveLength(1);
    });

    it('should pass pagination and sorting options to repository', async () => {
      const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
      mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
      mockAdministrationRepository.getSchoolsByAdministrationId.mockResolvedValue({ items: [], totalItems: 0 });

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
      });

      await service.listSchools({ userId: 'admin-user', isSuperAdmin: true }, 'admin-123', {
        page: 3,
        perPage: 50,
        sortBy: 'name',
        sortOrder: 'desc',
      });

      expect(mockAdministrationRepository.getSchoolsByAdministrationId).toHaveBeenCalledWith('admin-123', {
        page: 3,
        perPage: 50,
        orderBy: { field: 'name', direction: 'desc' },
      });
    });

    it('should return empty results when administration has no schools', async () => {
      const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
      mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
      mockAdministrationRepository.getSchoolsByAdministrationId.mockResolvedValue({ items: [], totalItems: 0 });

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
      mockAdministrationRepository.getById.mockResolvedValue(null);

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
      });

      await expect(
        service.listSchools({ userId: 'admin-user', isSuperAdmin: true }, 'non-existent-id', defaultOptions),
      ).rejects.toThrow('Administration not found');
      expect(mockAdministrationRepository.getSchoolsByAdministrationId).not.toHaveBeenCalled();
    });

    it('should throw forbidden error when non-super admin has no access to existing administration', async () => {
      const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
      mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
      mockAdministrationRepository.getAuthorizedById.mockResolvedValue(null);

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
      });

      await expect(
        service.listSchools({ userId: 'user-123', isSuperAdmin: false }, 'admin-123', defaultOptions),
      ).rejects.toThrow('You do not have permission to perform this action');
      expect(mockAdministrationRepository.getSchoolsByAdministrationId).not.toHaveBeenCalled();
    });

    it('should throw not-found error for non-super admin when administration does not exist', async () => {
      mockAdministrationRepository.getById.mockResolvedValue(null);

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
      });

      await expect(
        service.listSchools({ userId: 'user-123', isSuperAdmin: false }, 'non-existent-id', defaultOptions),
      ).rejects.toThrow('Administration not found');
      expect(mockAdministrationRepository.getAuthorizedById).not.toHaveBeenCalled();
      expect(mockAdministrationRepository.getSchoolsByAdministrationId).not.toHaveBeenCalled();
    });

    it('should throw ApiError when getById database query fails', async () => {
      const dbError = new Error('Connection refused');
      mockAdministrationRepository.getById.mockRejectedValue(dbError);

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
      });

      await expect(
        service.listSchools({ userId: 'admin-user', isSuperAdmin: true }, 'admin-123', defaultOptions),
      ).rejects.toThrow('Failed to retrieve administration schools');
    });

    it('should throw ApiError when getSchoolsByAdministrationId query fails', async () => {
      const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
      mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
      mockAdministrationRepository.getSchoolsByAdministrationId.mockRejectedValue(new Error('Database timeout'));

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
        mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
        mockAdministrationRepository.getAuthorizedById.mockResolvedValue(mockAdmin);
        // Edge case: user passed verifyAdministrationAccess but has no roles (empty array)
        mockAdministrationRepository.getUserRolesForAdministration.mockResolvedValue([]);

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
        });

        await expect(
          service.listSchools({ userId: 'user-with-no-roles', isSuperAdmin: false }, 'admin-123', defaultOptions),
        ).rejects.toThrow(ApiErrorMessage.FORBIDDEN);
        expect(mockAdministrationRepository.getSchoolsByAdministrationId).not.toHaveBeenCalled();
        expect(mockAdministrationRepository.getAuthorizedSchoolsByAdministrationId).not.toHaveBeenCalled();
      });

      it('should throw forbidden error when user only has supervised roles', async () => {
        const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
        mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
        mockAdministrationRepository.getAuthorizedById.mockResolvedValue(mockAdmin);
        // User only has 'student' role, which is a supervised role
        mockAdministrationRepository.getUserRolesForAdministration.mockResolvedValue(['student']);

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
        });

        await expect(
          service.listSchools({ userId: 'student-user', isSuperAdmin: false }, 'admin-123', defaultOptions),
        ).rejects.toThrow(ApiErrorMessage.FORBIDDEN);
        expect(mockAdministrationRepository.getSchoolsByAdministrationId).not.toHaveBeenCalled();
        expect(mockAdministrationRepository.getAuthorizedSchoolsByAdministrationId).not.toHaveBeenCalled();
      });

      it('should throw forbidden error when user has guardian role', async () => {
        const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
        mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
        mockAdministrationRepository.getAuthorizedById.mockResolvedValue(mockAdmin);
        mockAdministrationRepository.getUserRolesForAdministration.mockResolvedValue(['guardian']);

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
        });

        await expect(
          service.listSchools({ userId: 'guardian-user', isSuperAdmin: false }, 'admin-123', defaultOptions),
        ).rejects.toThrow(ApiErrorMessage.FORBIDDEN);
      });

      it('should throw forbidden error when user has parent role', async () => {
        const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
        mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
        mockAdministrationRepository.getAuthorizedById.mockResolvedValue(mockAdmin);
        mockAdministrationRepository.getUserRolesForAdministration.mockResolvedValue(['parent']);

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
        });

        await expect(
          service.listSchools({ userId: 'parent-user', isSuperAdmin: false }, 'admin-123', defaultOptions),
        ).rejects.toThrow(ApiErrorMessage.FORBIDDEN);
      });

      it('should throw forbidden error when user has relative role', async () => {
        const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
        mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
        mockAdministrationRepository.getAuthorizedById.mockResolvedValue(mockAdmin);
        mockAdministrationRepository.getUserRolesForAdministration.mockResolvedValue(['relative']);

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
        mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
        mockAdministrationRepository.getAuthorizedById.mockResolvedValue(mockAdmin);
        mockAdministrationRepository.getUserRolesForAdministration.mockResolvedValue(['teacher']);
        mockAdministrationRepository.getAuthorizedSchoolsByAdministrationId.mockResolvedValue({
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

        expect(mockAdministrationRepository.getAuthorizedSchoolsByAdministrationId).toHaveBeenCalledWith(
          expect.objectContaining({ userId: 'teacher-user' }),
          'admin-123',
          expect.any(Object),
        );
        expect(mockAdministrationRepository.getSchoolsByAdministrationId).not.toHaveBeenCalled();
        expect(result.items).toHaveLength(1);
      });

      it('should use authorized method for administrator (supervisory role)', async () => {
        const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
        const mockSchools = [OrgFactory.build({ id: 'school-1', orgType: 'school' })];
        mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
        mockAdministrationRepository.getAuthorizedById.mockResolvedValue(mockAdmin);
        mockAdministrationRepository.getUserRolesForAdministration.mockResolvedValue(['administrator']);
        mockAdministrationRepository.getAuthorizedSchoolsByAdministrationId.mockResolvedValue({
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

        expect(mockAdministrationRepository.getAuthorizedSchoolsByAdministrationId).toHaveBeenCalled();
        expect(mockAdministrationRepository.getSchoolsByAdministrationId).not.toHaveBeenCalled();
        expect(result.items).toHaveLength(1);
      });

      it('should allow access when user has both supervised and supervisory roles', async () => {
        const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
        const mockSchools = [OrgFactory.build({ id: 'school-1', orgType: 'school' })];
        mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
        mockAdministrationRepository.getAuthorizedById.mockResolvedValue(mockAdmin);
        // User has both student (supervised) and teacher (supervisory) roles
        mockAdministrationRepository.getUserRolesForAdministration.mockResolvedValue(['student', 'teacher']);
        mockAdministrationRepository.getAuthorizedSchoolsByAdministrationId.mockResolvedValue({
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
        expect(mockAdministrationRepository.getAuthorizedSchoolsByAdministrationId).toHaveBeenCalled();
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
      mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
      mockAdministrationRepository.getClassesByAdministrationId.mockResolvedValue({
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

      expect(mockAdministrationRepository.getById).toHaveBeenCalledWith({ id: 'admin-123' });
      expect(mockAdministrationRepository.getAuthorizedById).not.toHaveBeenCalled();
      expect(mockAdministrationRepository.getClassesByAdministrationId).toHaveBeenCalledWith('admin-123', {
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
      mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
      mockAdministrationRepository.getAuthorizedById.mockResolvedValue(mockAdmin);
      // User has a supervisory role (teacher)
      mockAdministrationRepository.getUserRolesForAdministration.mockResolvedValue(['teacher']);
      mockAdministrationRepository.getAuthorizedClassesByAdministrationId.mockResolvedValue({
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

      expect(mockAdministrationRepository.getById).toHaveBeenCalledWith({ id: 'admin-123' });
      expect(mockAdministrationRepository.getAuthorizedById).toHaveBeenCalledWith(
        {
          userId: 'user-123',
          allowedRoles: expect.arrayContaining(['site_administrator', 'administrator', 'teacher', 'student']),
        },
        'admin-123',
      );
      // Should use authorized method for non-super admin with supervisory role
      expect(mockAdministrationRepository.getAuthorizedClassesByAdministrationId).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-123' }),
        'admin-123',
        expect.any(Object),
      );
      expect(mockAdministrationRepository.getClassesByAdministrationId).not.toHaveBeenCalled();
      expect(result.items).toHaveLength(1);
    });

    it('should pass pagination and sorting options to repository', async () => {
      const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
      mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
      mockAdministrationRepository.getClassesByAdministrationId.mockResolvedValue({ items: [], totalItems: 0 });

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
      });

      await service.listClasses({ userId: 'admin-user', isSuperAdmin: true }, 'admin-123', {
        page: 3,
        perPage: 50,
        sortBy: 'name',
        sortOrder: 'desc',
      });

      expect(mockAdministrationRepository.getClassesByAdministrationId).toHaveBeenCalledWith('admin-123', {
        page: 3,
        perPage: 50,
        orderBy: { field: 'name', direction: 'desc' },
      });
    });

    it('should return empty results when administration has no classes', async () => {
      const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
      mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
      mockAdministrationRepository.getClassesByAdministrationId.mockResolvedValue({ items: [], totalItems: 0 });

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
      mockAdministrationRepository.getById.mockResolvedValue(null);

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
      });

      await expect(
        service.listClasses({ userId: 'admin-user', isSuperAdmin: true }, 'non-existent-id', defaultOptions),
      ).rejects.toThrow('Administration not found');
      expect(mockAdministrationRepository.getClassesByAdministrationId).not.toHaveBeenCalled();
    });

    it('should throw forbidden error when non-super admin has no access to existing administration', async () => {
      const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
      mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
      mockAdministrationRepository.getAuthorizedById.mockResolvedValue(null);

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
      });

      await expect(
        service.listClasses({ userId: 'user-123', isSuperAdmin: false }, 'admin-123', defaultOptions),
      ).rejects.toThrow('You do not have permission to perform this action');
      expect(mockAdministrationRepository.getClassesByAdministrationId).not.toHaveBeenCalled();
    });

    it('should throw not-found error for non-super admin when administration does not exist', async () => {
      mockAdministrationRepository.getById.mockResolvedValue(null);

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
      });

      await expect(
        service.listClasses({ userId: 'user-123', isSuperAdmin: false }, 'non-existent-id', defaultOptions),
      ).rejects.toThrow('Administration not found');
      expect(mockAdministrationRepository.getAuthorizedById).not.toHaveBeenCalled();
      expect(mockAdministrationRepository.getClassesByAdministrationId).not.toHaveBeenCalled();
    });

    it('should throw ApiError when getById database query fails', async () => {
      const dbError = new Error('Connection refused');
      mockAdministrationRepository.getById.mockRejectedValue(dbError);

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
      });

      await expect(
        service.listClasses({ userId: 'admin-user', isSuperAdmin: true }, 'admin-123', defaultOptions),
      ).rejects.toThrow('Failed to retrieve administration classes');
    });

    it('should throw ApiError when getClassesByAdministrationId query fails', async () => {
      const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
      mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
      mockAdministrationRepository.getClassesByAdministrationId.mockRejectedValue(new Error('Database timeout'));

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
        mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
        mockAdministrationRepository.getAuthorizedById.mockResolvedValue(mockAdmin);
        // Edge case: user passed verifyAdministrationAccess but has no roles (empty array)
        mockAdministrationRepository.getUserRolesForAdministration.mockResolvedValue([]);

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
        });

        await expect(
          service.listClasses({ userId: 'user-with-no-roles', isSuperAdmin: false }, 'admin-123', defaultOptions),
        ).rejects.toThrow(ApiErrorMessage.FORBIDDEN);
        expect(mockAdministrationRepository.getClassesByAdministrationId).not.toHaveBeenCalled();
        expect(mockAdministrationRepository.getAuthorizedClassesByAdministrationId).not.toHaveBeenCalled();
      });

      it('should throw forbidden error when user only has supervised roles', async () => {
        const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
        mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
        mockAdministrationRepository.getAuthorizedById.mockResolvedValue(mockAdmin);
        // User only has 'student' role, which is a supervised role
        mockAdministrationRepository.getUserRolesForAdministration.mockResolvedValue(['student']);

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
        });

        await expect(
          service.listClasses({ userId: 'student-user', isSuperAdmin: false }, 'admin-123', defaultOptions),
        ).rejects.toThrow(ApiErrorMessage.FORBIDDEN);
        expect(mockAdministrationRepository.getClassesByAdministrationId).not.toHaveBeenCalled();
        expect(mockAdministrationRepository.getAuthorizedClassesByAdministrationId).not.toHaveBeenCalled();
      });

      it('should throw forbidden error when user has guardian role', async () => {
        const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
        mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
        mockAdministrationRepository.getAuthorizedById.mockResolvedValue(mockAdmin);
        mockAdministrationRepository.getUserRolesForAdministration.mockResolvedValue(['guardian']);

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
        });

        await expect(
          service.listClasses({ userId: 'guardian-user', isSuperAdmin: false }, 'admin-123', defaultOptions),
        ).rejects.toThrow(ApiErrorMessage.FORBIDDEN);
      });

      it('should throw forbidden error when user has parent role', async () => {
        const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
        mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
        mockAdministrationRepository.getAuthorizedById.mockResolvedValue(mockAdmin);
        mockAdministrationRepository.getUserRolesForAdministration.mockResolvedValue(['parent']);

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
        });

        await expect(
          service.listClasses({ userId: 'parent-user', isSuperAdmin: false }, 'admin-123', defaultOptions),
        ).rejects.toThrow(ApiErrorMessage.FORBIDDEN);
      });

      it('should throw forbidden error when user has relative role', async () => {
        const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
        mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
        mockAdministrationRepository.getAuthorizedById.mockResolvedValue(mockAdmin);
        mockAdministrationRepository.getUserRolesForAdministration.mockResolvedValue(['relative']);

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
        mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
        mockAdministrationRepository.getAuthorizedById.mockResolvedValue(mockAdmin);
        mockAdministrationRepository.getUserRolesForAdministration.mockResolvedValue(['teacher']);
        mockAdministrationRepository.getAuthorizedClassesByAdministrationId.mockResolvedValue({
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

        expect(mockAdministrationRepository.getAuthorizedClassesByAdministrationId).toHaveBeenCalledWith(
          expect.objectContaining({ userId: 'teacher-user' }),
          'admin-123',
          expect.any(Object),
        );
        expect(mockAdministrationRepository.getClassesByAdministrationId).not.toHaveBeenCalled();
        expect(result.items).toHaveLength(1);
      });

      it('should use authorized method for administrator (supervisory role)', async () => {
        const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
        const mockClasses = [ClassFactory.build({ id: 'class-1' })];
        mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
        mockAdministrationRepository.getAuthorizedById.mockResolvedValue(mockAdmin);
        mockAdministrationRepository.getUserRolesForAdministration.mockResolvedValue(['administrator']);
        mockAdministrationRepository.getAuthorizedClassesByAdministrationId.mockResolvedValue({
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

        expect(mockAdministrationRepository.getAuthorizedClassesByAdministrationId).toHaveBeenCalled();
        expect(mockAdministrationRepository.getClassesByAdministrationId).not.toHaveBeenCalled();
        expect(result.items).toHaveLength(1);
      });

      it('should allow access when user has both supervised and supervisory roles', async () => {
        const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
        const mockClasses = [ClassFactory.build({ id: 'class-1' })];
        mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
        mockAdministrationRepository.getAuthorizedById.mockResolvedValue(mockAdmin);
        // User has both student (supervised) and teacher (supervisory) roles
        mockAdministrationRepository.getUserRolesForAdministration.mockResolvedValue(['student', 'teacher']);
        mockAdministrationRepository.getAuthorizedClassesByAdministrationId.mockResolvedValue({
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
        expect(mockAdministrationRepository.getAuthorizedClassesByAdministrationId).toHaveBeenCalled();
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
      mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
      mockAdministrationRepository.getGroupsByAdministrationId.mockResolvedValue({
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

      expect(mockAdministrationRepository.getById).toHaveBeenCalledWith({ id: 'admin-123' });
      expect(mockAdministrationRepository.getAuthorizedById).not.toHaveBeenCalled();
      expect(mockAdministrationRepository.getGroupsByAdministrationId).toHaveBeenCalledWith('admin-123', {
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
      mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
      mockAdministrationRepository.getAuthorizedById.mockResolvedValue(mockAdmin);
      // User has a supervisory role (teacher)
      mockAdministrationRepository.getUserRolesForAdministration.mockResolvedValue(['teacher']);
      mockAdministrationRepository.getAuthorizedGroupsByAdministrationId.mockResolvedValue({
        items: mockGroups,
        totalItems: 1,
      });

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
      });

      const result = await service.listGroups({ userId: 'user-123', isSuperAdmin: false }, 'admin-123', defaultOptions);

      expect(mockAdministrationRepository.getById).toHaveBeenCalledWith({ id: 'admin-123' });
      expect(mockAdministrationRepository.getAuthorizedById).toHaveBeenCalledWith(
        {
          userId: 'user-123',
          allowedRoles: expect.arrayContaining(['site_administrator', 'administrator', 'teacher', 'student']),
        },
        'admin-123',
      );
      // Should use authorized method for non-super admin with supervisory role
      expect(mockAdministrationRepository.getAuthorizedGroupsByAdministrationId).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-123' }),
        'admin-123',
        expect.any(Object),
      );
      expect(mockAdministrationRepository.getGroupsByAdministrationId).not.toHaveBeenCalled();
      expect(result.items).toHaveLength(1);
    });

    it('should pass pagination and sorting options to repository', async () => {
      const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
      mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
      mockAdministrationRepository.getGroupsByAdministrationId.mockResolvedValue({ items: [], totalItems: 0 });

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
      });

      await service.listGroups({ userId: 'admin-user', isSuperAdmin: true }, 'admin-123', {
        page: 3,
        perPage: 50,
        sortBy: 'name',
        sortOrder: 'desc',
      });

      expect(mockAdministrationRepository.getGroupsByAdministrationId).toHaveBeenCalledWith('admin-123', {
        page: 3,
        perPage: 50,
        orderBy: { field: 'name', direction: 'desc' },
      });
    });

    it('should return empty results when administration has no groups', async () => {
      const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
      mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
      mockAdministrationRepository.getGroupsByAdministrationId.mockResolvedValue({ items: [], totalItems: 0 });

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
      mockAdministrationRepository.getById.mockResolvedValue(null);

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
      });

      await expect(
        service.listGroups({ userId: 'admin-user', isSuperAdmin: true }, 'non-existent-id', defaultOptions),
      ).rejects.toThrow('Administration not found');
      expect(mockAdministrationRepository.getGroupsByAdministrationId).not.toHaveBeenCalled();
    });

    it('should throw forbidden error when non-super admin has no access to existing administration', async () => {
      const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
      mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
      mockAdministrationRepository.getAuthorizedById.mockResolvedValue(null);

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
      });

      await expect(
        service.listGroups({ userId: 'user-123', isSuperAdmin: false }, 'admin-123', defaultOptions),
      ).rejects.toThrow('You do not have permission to perform this action');
      expect(mockAdministrationRepository.getGroupsByAdministrationId).not.toHaveBeenCalled();
    });

    it('should throw not-found error for non-super admin when administration does not exist', async () => {
      mockAdministrationRepository.getById.mockResolvedValue(null);

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
      });

      await expect(
        service.listGroups({ userId: 'user-123', isSuperAdmin: false }, 'non-existent-id', defaultOptions),
      ).rejects.toThrow('Administration not found');
      expect(mockAdministrationRepository.getAuthorizedById).not.toHaveBeenCalled();
      expect(mockAdministrationRepository.getGroupsByAdministrationId).not.toHaveBeenCalled();
    });

    it('should throw ApiError when getById database query fails', async () => {
      const dbError = new Error('Connection refused');
      mockAdministrationRepository.getById.mockRejectedValue(dbError);

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
      });

      await expect(
        service.listGroups({ userId: 'admin-user', isSuperAdmin: true }, 'admin-123', defaultOptions),
      ).rejects.toThrow('Failed to retrieve administration groups');
    });

    it('should throw ApiError when getGroupsByAdministrationId query fails', async () => {
      const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
      mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
      mockAdministrationRepository.getGroupsByAdministrationId.mockRejectedValue(new Error('Database timeout'));

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
        mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
        mockAdministrationRepository.getAuthorizedById.mockResolvedValue(mockAdmin);
        // Edge case: user passed verifyAdministrationAccess but has no roles (empty array)
        mockAdministrationRepository.getUserRolesForAdministration.mockResolvedValue([]);

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
        });

        await expect(
          service.listGroups({ userId: 'user-with-no-roles', isSuperAdmin: false }, 'admin-123', defaultOptions),
        ).rejects.toThrow(ApiErrorMessage.FORBIDDEN);
        expect(mockAdministrationRepository.getGroupsByAdministrationId).not.toHaveBeenCalled();
        expect(mockAdministrationRepository.getAuthorizedGroupsByAdministrationId).not.toHaveBeenCalled();
      });

      it('should throw forbidden error when user only has supervised roles', async () => {
        const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
        mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
        mockAdministrationRepository.getAuthorizedById.mockResolvedValue(mockAdmin);
        // User only has 'student' role, which is a supervised role
        mockAdministrationRepository.getUserRolesForAdministration.mockResolvedValue(['student']);

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
        });

        await expect(
          service.listGroups({ userId: 'student-user', isSuperAdmin: false }, 'admin-123', defaultOptions),
        ).rejects.toThrow(ApiErrorMessage.FORBIDDEN);
        expect(mockAdministrationRepository.getGroupsByAdministrationId).not.toHaveBeenCalled();
        expect(mockAdministrationRepository.getAuthorizedGroupsByAdministrationId).not.toHaveBeenCalled();
      });

      it('should throw forbidden error when user has guardian role', async () => {
        const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
        mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
        mockAdministrationRepository.getAuthorizedById.mockResolvedValue(mockAdmin);
        mockAdministrationRepository.getUserRolesForAdministration.mockResolvedValue(['guardian']);

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
        });

        await expect(
          service.listGroups({ userId: 'guardian-user', isSuperAdmin: false }, 'admin-123', defaultOptions),
        ).rejects.toThrow(ApiErrorMessage.FORBIDDEN);
      });

      it('should throw forbidden error when user has parent role', async () => {
        const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
        mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
        mockAdministrationRepository.getAuthorizedById.mockResolvedValue(mockAdmin);
        mockAdministrationRepository.getUserRolesForAdministration.mockResolvedValue(['parent']);

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
        });

        await expect(
          service.listGroups({ userId: 'parent-user', isSuperAdmin: false }, 'admin-123', defaultOptions),
        ).rejects.toThrow(ApiErrorMessage.FORBIDDEN);
      });

      it('should throw forbidden error when user has relative role', async () => {
        const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
        mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
        mockAdministrationRepository.getAuthorizedById.mockResolvedValue(mockAdmin);
        mockAdministrationRepository.getUserRolesForAdministration.mockResolvedValue(['relative']);

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
        mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
        mockAdministrationRepository.getAuthorizedById.mockResolvedValue(mockAdmin);
        mockAdministrationRepository.getUserRolesForAdministration.mockResolvedValue(['teacher']);
        mockAdministrationRepository.getAuthorizedGroupsByAdministrationId.mockResolvedValue({
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

        expect(mockAdministrationRepository.getAuthorizedGroupsByAdministrationId).toHaveBeenCalledWith(
          expect.objectContaining({ userId: 'teacher-user' }),
          'admin-123',
          expect.any(Object),
        );
        expect(mockAdministrationRepository.getGroupsByAdministrationId).not.toHaveBeenCalled();
        expect(result.items).toHaveLength(1);
      });

      it('should use authorized method for administrator (supervisory role)', async () => {
        const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
        const mockGroups = [GroupFactory.build({ id: 'group-1' })];
        mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
        mockAdministrationRepository.getAuthorizedById.mockResolvedValue(mockAdmin);
        mockAdministrationRepository.getUserRolesForAdministration.mockResolvedValue(['administrator']);
        mockAdministrationRepository.getAuthorizedGroupsByAdministrationId.mockResolvedValue({
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

        expect(mockAdministrationRepository.getAuthorizedGroupsByAdministrationId).toHaveBeenCalled();
        expect(mockAdministrationRepository.getGroupsByAdministrationId).not.toHaveBeenCalled();
        expect(result.items).toHaveLength(1);
      });

      it('should allow access when user has both supervised and supervisory roles', async () => {
        const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
        const mockGroups = [GroupFactory.build({ id: 'group-1' })];
        mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
        mockAdministrationRepository.getAuthorizedById.mockResolvedValue(mockAdmin);
        // User has both student (supervised) and teacher (supervisory) roles
        mockAdministrationRepository.getUserRolesForAdministration.mockResolvedValue(['student', 'teacher']);
        mockAdministrationRepository.getAuthorizedGroupsByAdministrationId.mockResolvedValue({
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
        expect(mockAdministrationRepository.getAuthorizedGroupsByAdministrationId).toHaveBeenCalled();
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
      });

      const result = await service.listTaskVariants(
        { userId: 'admin-user', isSuperAdmin: true },
        'admin-123',
        defaultOptions,
      );

      expect(mockAdministrationRepository.getById).toHaveBeenCalledWith({ id: 'admin-123' });
      expect(mockAdministrationRepository.getAuthorizedById).not.toHaveBeenCalled();
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
      mockAdministrationRepository.getAuthorizedById.mockResolvedValue(mockAdmin);
      mockAdministrationRepository.getTaskVariantsByAdministrationId.mockResolvedValue({
        items: mockTaskVariants,
        totalItems: 2,
      });
      // Supervisory roles see all task variants without eligibility filtering
      mockAdministrationRepository.getUserRolesForAdministration.mockResolvedValue(['teacher']);

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

      expect(mockAdministrationRepository.getById).toHaveBeenCalledWith({ id: 'admin-123' });
      expect(mockAdministrationRepository.getAuthorizedById).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-123' }),
        'admin-123',
      );
      // Role check is performed to determine if eligibility filtering applies
      expect(mockAdministrationRepository.getUserRolesForAdministration).toHaveBeenCalledWith('user-123', 'admin-123');
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
      });

      await expect(
        service.listTaskVariants({ userId: 'admin-user', isSuperAdmin: true }, 'non-existent-id', defaultOptions),
      ).rejects.toThrow('Administration not found');
      expect(mockAdministrationRepository.getTaskVariantsByAdministrationId).not.toHaveBeenCalled();
    });

    it('should throw forbidden error when non-super admin has no access to existing administration', async () => {
      const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
      mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
      mockAdministrationRepository.getAuthorizedById.mockResolvedValue(null);

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
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
        mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
        mockAdministrationRepository.getAuthorizedById.mockResolvedValue(mockAdmin);
        mockAdministrationRepository.getTaskVariantsByAdministrationId.mockResolvedValue({
          items: mockTaskVariants,
          totalItems: 2,
        });
        mockAdministrationRepository.getUserRolesForAdministration.mockResolvedValue(['teacher']);

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

        expect(mockAdministrationRepository.getUserRolesForAdministration).toHaveBeenCalledWith(
          'teacher-user',
          'admin-123',
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

      it('should allow administrator to list all task variants (supervisory role - no filtering)', async () => {
        const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
        mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
        mockAdministrationRepository.getAuthorizedById.mockResolvedValue(mockAdmin);
        mockAdministrationRepository.getTaskVariantsByAdministrationId.mockResolvedValue({
          items: mockTaskVariants,
          totalItems: 2,
        });
        mockAdministrationRepository.getUserRolesForAdministration.mockResolvedValue(['administrator']);

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

        expect(mockAdministrationRepository.getUserRolesForAdministration).toHaveBeenCalledWith(
          'admin-user',
          'admin-123',
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
        mockAdministrationRepository.getAuthorizedById.mockResolvedValue(mockAdmin);
        mockAdministrationRepository.getTaskVariantsByAdministrationId.mockResolvedValue({
          items: mockTaskVariants,
          totalItems: 2,
        });
        mockAdministrationRepository.getUserRolesForAdministration.mockResolvedValue(['student']);
        mockUserRepository.getById.mockResolvedValue(mockUser);
        // First variant: assigned and required, Second variant: not assigned
        mockTaskService.evaluateTaskVariantEligibility
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

        expect(mockAdministrationRepository.getUserRolesForAdministration).toHaveBeenCalledWith(
          'student-user',
          'admin-123',
        );
        // Supervised roles (students) only see published variants (publishedOnly: true)
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
        mockAdministrationRepository.getAuthorizedById.mockResolvedValue(mockAdmin);
        mockAdministrationRepository.getTaskVariantsByAdministrationId.mockResolvedValue({
          items: mockTaskVariants,
          totalItems: 2,
        });
        mockAdministrationRepository.getUserRolesForAdministration.mockResolvedValue(['student']);
        mockUserRepository.getById.mockResolvedValue(mockUser);
        // assigned_if fails for all variants
        mockTaskService.evaluateTaskVariantEligibility.mockReturnValue({ isAssigned: false, isOptional: false });

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
        const mockUser = UserFactory.build({ id: 'student-user', grade: '5' });
        mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
        mockAdministrationRepository.getAuthorizedById.mockResolvedValue(mockAdmin);
        mockAdministrationRepository.getTaskVariantsByAdministrationId.mockResolvedValue({
          items: mockTaskVariants,
          totalItems: 2,
        });
        mockAdministrationRepository.getUserRolesForAdministration.mockResolvedValue(['student']);
        mockUserRepository.getById.mockResolvedValue(mockUser);
        // assigned_if passes for all, optional_if also passes (making them optional)
        mockTaskService.evaluateTaskVariantEligibility.mockReturnValue({ isAssigned: true, isOptional: true });

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
        mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
        mockAdministrationRepository.getAuthorizedById.mockResolvedValue(mockAdmin);
        mockAdministrationRepository.getTaskVariantsByAdministrationId.mockResolvedValue({
          items: mockTaskVariants,
          totalItems: 2,
        });
        mockAdministrationRepository.getUserRolesForAdministration.mockResolvedValue(['student']);
        mockUserRepository.getById.mockResolvedValue(null);

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
        mockAdministrationRepository.getAuthorizedById.mockResolvedValue(mockAdmin);
        mockAdministrationRepository.getTaskVariantsByAdministrationId.mockResolvedValue({
          items: [variantWithConditions],
          totalItems: 1,
        });
        mockAdministrationRepository.getUserRolesForAdministration.mockResolvedValue(['student']);
        mockUserRepository.getById.mockResolvedValue(mockUser);
        // assigned and optional
        mockTaskService.evaluateTaskVariantEligibility.mockReturnValue({ isAssigned: true, isOptional: true });

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
        mockAdministrationRepository.getAuthorizedById.mockResolvedValue(mockAdmin);
        mockAdministrationRepository.getTaskVariantsByAdministrationId.mockResolvedValue({
          items: [variantWithNullConditions],
          totalItems: 1,
        });
        mockAdministrationRepository.getUserRolesForAdministration.mockResolvedValue(['student']);
        mockUserRepository.getById.mockResolvedValue(mockUser);
        // null assigned_if = assigned to all, null optional_if = required
        mockTaskService.evaluateTaskVariantEligibility.mockReturnValue({ isAssigned: true, isOptional: false });

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
        mockAdministrationRepository.getAuthorizedById.mockResolvedValue(mockAdmin);
        mockAdministrationRepository.getTaskVariantsByAdministrationId.mockResolvedValue({
          items: [variantWithMalformedCondition, variantWithValidCondition],
          totalItems: 2,
        });
        mockAdministrationRepository.getUserRolesForAdministration.mockResolvedValue(['student']);
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

      it('should throw forbidden error for non-student supervised roles (guardian)', async () => {
        const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
        mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
        mockAdministrationRepository.getAuthorizedById.mockResolvedValue(mockAdmin);
        // User has guardian role (supervised, but not student)
        mockAdministrationRepository.getUserRolesForAdministration.mockResolvedValue([UserRole.GUARDIAN]);

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          userRepository: mockUserRepository,
          taskService: mockTaskService,
        });

        await expect(
          service.listTaskVariants({ userId: 'guardian-user', isSuperAdmin: false }, 'admin-123', defaultOptions),
        ).rejects.toMatchObject({
          message: ApiErrorMessage.FORBIDDEN,
          statusCode: StatusCodes.FORBIDDEN,
          code: ApiErrorCode.AUTH_FORBIDDEN,
        });
      });

      it('should throw forbidden error for non-student supervised roles (parent)', async () => {
        const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
        mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
        mockAdministrationRepository.getAuthorizedById.mockResolvedValue(mockAdmin);
        // User has parent role (supervised, but not student)
        mockAdministrationRepository.getUserRolesForAdministration.mockResolvedValue([UserRole.PARENT]);

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          userRepository: mockUserRepository,
          taskService: mockTaskService,
        });

        await expect(
          service.listTaskVariants({ userId: 'parent-user', isSuperAdmin: false }, 'admin-123', defaultOptions),
        ).rejects.toMatchObject({
          message: ApiErrorMessage.FORBIDDEN,
          statusCode: StatusCodes.FORBIDDEN,
          code: ApiErrorCode.AUTH_FORBIDDEN,
        });
      });

      it('should throw forbidden error for non-student supervised roles (relative)', async () => {
        const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
        mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
        mockAdministrationRepository.getAuthorizedById.mockResolvedValue(mockAdmin);
        // User has relative role (supervised, but not student)
        mockAdministrationRepository.getUserRolesForAdministration.mockResolvedValue([UserRole.RELATIVE]);

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          userRepository: mockUserRepository,
          taskService: mockTaskService,
        });

        await expect(
          service.listTaskVariants({ userId: 'relative-user', isSuperAdmin: false }, 'admin-123', defaultOptions),
        ).rejects.toMatchObject({
          message: ApiErrorMessage.FORBIDDEN,
          statusCode: StatusCodes.FORBIDDEN,
          code: ApiErrorCode.AUTH_FORBIDDEN,
        });
      });

      it('should throw forbidden error when user has no roles for administration', async () => {
        const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
        mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
        mockAdministrationRepository.getAuthorizedById.mockResolvedValue(mockAdmin);
        // User has no roles for this administration (empty array)
        mockAdministrationRepository.getUserRolesForAdministration.mockResolvedValue([]);

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          userRepository: mockUserRepository,
          taskService: mockTaskService,
        });

        await expect(
          service.listTaskVariants({ userId: 'no-roles-user', isSuperAdmin: false }, 'admin-123', defaultOptions),
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
        mockAdministrationRepository.getAuthorizedById.mockResolvedValue(mockAdmin);
        mockAdministrationRepository.getUserRolesForAdministration.mockResolvedValue(['teacher']);
        mockAdministrationRepository.getAgreementsByAdministrationId.mockResolvedValue({
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

        expect(mockAdministrationRepository.getById).toHaveBeenCalledWith({ id: mockAdmin.id });
        expect(result.items).toHaveLength(1);
        expect(result.items[0]!.agreement.id).toBe(mockAgreement.id);
      });

      it('should return 404 when administration does not exist', async () => {
        mockAdministrationRepository.getById.mockResolvedValue(null);

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
        mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
        mockAdministrationRepository.getAuthorizedById.mockResolvedValue(null);

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

        mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
        mockAdministrationRepository.getAgreementsByAdministrationId.mockResolvedValue({
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

        expect(mockAdministrationRepository.getAuthorizedById).not.toHaveBeenCalled();
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
        });

        const result = await service.listAgreements(
          { userId: 'admin-123', isSuperAdmin: true },
          mockAdmin.id,
          defaultAgreementOptions,
        );

        expect(result.items).toHaveLength(3);
        expect(mockAdministrationRepository.getUserRolesForAdministration).not.toHaveBeenCalled();
      });

      it('should not filter agreements for supervisory roles (teacher)', async () => {
        const mockAdmin = AdministrationFactory.build();
        const tosAgreement = AgreementFactory.build({ agreementType: 'tos' });
        const assentAgreement = AgreementFactory.build({ agreementType: 'assent' });
        const consentAgreement = AgreementFactory.build({ agreementType: 'consent' });

        mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
        mockAdministrationRepository.getAuthorizedById.mockResolvedValue(mockAdmin);
        mockAdministrationRepository.getUserRolesForAdministration.mockResolvedValue(['teacher']);
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
        });

        const result = await service.listAgreements(
          { userId: 'teacher-123', isSuperAdmin: false },
          mockAdmin.id,
          defaultAgreementOptions,
        );

        expect(result.items).toHaveLength(3);
      });

      it('should not filter agreements when user has both student and supervisory roles (supervisory takes precedence)', async () => {
        const mockAdmin = AdministrationFactory.build();
        const tosAgreement = AgreementFactory.build({ agreementType: 'tos', name: 'TOS Agreement' });
        const assentAgreement = AgreementFactory.build({ agreementType: 'assent', name: 'Assent Agreement' });
        const consentAgreement = AgreementFactory.build({ agreementType: 'consent', name: 'Consent Agreement' });

        mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
        mockAdministrationRepository.getAuthorizedById.mockResolvedValue(mockAdmin);
        // User has both student and teacher roles - supervisory role (teacher) takes precedence
        mockAdministrationRepository.getUserRolesForAdministration.mockResolvedValue(['student', 'teacher']);
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
        });

        const result = await service.listAgreements(
          { userId: 'multi-role-user', isSuperAdmin: false },
          mockAdmin.id,
          defaultAgreementOptions,
        );

        // Supervisory role takes precedence, so user sees all agreements without filtering
        expect(result.items).toHaveLength(3);
        // User data should not be fetched since supervisory role bypasses age check
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
        mockAdministrationRepository.getAuthorizedById.mockResolvedValue(mockAdmin);
        mockAdministrationRepository.getUserRolesForAdministration.mockResolvedValue(['student']);
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
        mockAdministrationRepository.getAuthorizedById.mockResolvedValue(mockAdmin);
        mockAdministrationRepository.getUserRolesForAdministration.mockResolvedValue(['student']);
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
        mockAdministrationRepository.getAuthorizedById.mockResolvedValue(mockAdmin);
        mockAdministrationRepository.getUserRolesForAdministration.mockResolvedValue(['student']);
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
        mockAdministrationRepository.getAuthorizedById.mockResolvedValue(mockAdmin);
        mockAdministrationRepository.getUserRolesForAdministration.mockResolvedValue(['student']);
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
        mockAdministrationRepository.getAuthorizedById.mockResolvedValue(mockAdmin);
        mockAdministrationRepository.getUserRolesForAdministration.mockResolvedValue(['student']);
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
        mockAdministrationRepository.getAuthorizedById.mockResolvedValue(mockAdmin);
        mockAdministrationRepository.getUserRolesForAdministration.mockResolvedValue(['student']);
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
        mockAdministrationRepository.getAuthorizedById.mockResolvedValue(mockAdmin);
        mockAdministrationRepository.getUserRolesForAdministration.mockResolvedValue(['student']);
        mockAdministrationRepository.getAgreementsByAdministrationId.mockResolvedValue({
          items: [{ agreement: tosAgreement, currentVersion: null }],
          totalItems: 1,
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

        expect(result.items).toHaveLength(0);
        expect(result.totalItems).toBe(0);
      });

      it('should throw error when user not found during filtering', async () => {
        const mockAdmin = AdministrationFactory.build();
        const assentAgreement = AgreementFactory.build({ agreementType: 'assent' });

        mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
        mockAdministrationRepository.getAuthorizedById.mockResolvedValue(mockAdmin);
        mockAdministrationRepository.getUserRolesForAdministration.mockResolvedValue(['student']);
        mockAdministrationRepository.getAgreementsByAdministrationId.mockResolvedValue({
          items: [{ agreement: assentAgreement, currentVersion: null }],
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

      it('should return 403 Forbidden for guardian role', async () => {
        const mockAdmin = AdministrationFactory.build();

        mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
        mockAdministrationRepository.getAuthorizedById.mockResolvedValue(mockAdmin);
        mockAdministrationRepository.getUserRolesForAdministration.mockResolvedValue(['guardian']);
        mockAdministrationRepository.getAgreementsByAdministrationId.mockResolvedValue({ items: [], totalItems: 0 });

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
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

      it('should return 403 Forbidden for parent role', async () => {
        const mockAdmin = AdministrationFactory.build();

        mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
        mockAdministrationRepository.getAuthorizedById.mockResolvedValue(mockAdmin);
        mockAdministrationRepository.getUserRolesForAdministration.mockResolvedValue(['parent']);
        mockAdministrationRepository.getAgreementsByAdministrationId.mockResolvedValue({ items: [], totalItems: 0 });

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
        });

        await expect(
          service.listAgreements({ userId: 'parent-123', isSuperAdmin: false }, mockAdmin.id, defaultAgreementOptions),
        ).rejects.toMatchObject({
          statusCode: 403,
        });
      });

      it('should return 403 Forbidden for relative role', async () => {
        const mockAdmin = AdministrationFactory.build();

        mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
        mockAdministrationRepository.getAuthorizedById.mockResolvedValue(mockAdmin);
        mockAdministrationRepository.getUserRolesForAdministration.mockResolvedValue(['relative']);
        mockAdministrationRepository.getAgreementsByAdministrationId.mockResolvedValue({ items: [], totalItems: 0 });

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
        });

        await expect(
          service.listAgreements(
            { userId: 'relative-123', isSuperAdmin: false },
            mockAdmin.id,
            defaultAgreementOptions,
          ),
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
      mockRunsService.getByAdministrationId.mockResolvedValue(null);
      mockAdministrationRepository.delete.mockResolvedValue(undefined);

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
        runsService: mockRunsService,
      });

      await service.deleteById({ userId: 'super-admin-user', isSuperAdmin: true }, 'admin-123');

      expect(mockAdministrationRepository.getById).toHaveBeenCalledWith({ id: 'admin-123' });
      expect(mockRunsService.getByAdministrationId).toHaveBeenCalledWith('admin-123');
      expect(mockAdministrationRepository.delete).toHaveBeenCalledWith({ id: 'admin-123' });
    });

    it('should delete administration for authorized non-super admin with DELETE permission', async () => {
      const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
      mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
      mockAdministrationRepository.getAuthorizedById.mockResolvedValue(mockAdmin);
      mockRunsService.getByAdministrationId.mockResolvedValue(null);
      mockAdministrationRepository.delete.mockResolvedValue(undefined);

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
        runsService: mockRunsService,
      });

      await service.deleteById({ userId: 'admin-user', isSuperAdmin: false }, 'admin-123');

      expect(mockAdministrationRepository.getById).toHaveBeenCalledWith({ id: 'admin-123' });
      // Should check DELETE permission (site_administrator, administrator only)
      expect(mockAdministrationRepository.getAuthorizedById).toHaveBeenCalledWith(
        {
          userId: 'admin-user',
          allowedRoles: expect.arrayContaining(['site_administrator', 'administrator']),
        },
        'admin-123',
      );
      expect(mockRunsService.getByAdministrationId).toHaveBeenCalledWith('admin-123');
      expect(mockAdministrationRepository.delete).toHaveBeenCalledWith({ id: 'admin-123' });
    });

    it('should throw not-found error when administration does not exist', async () => {
      mockAdministrationRepository.getById.mockResolvedValue(null);

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
        runsService: mockRunsService,
      });

      await expect(
        service.deleteById({ userId: 'admin-user', isSuperAdmin: true }, 'non-existent-id'),
      ).rejects.toMatchObject({
        statusCode: 404,
        message: 'Administration not found',
      });
      expect(mockRunsService.getByAdministrationId).not.toHaveBeenCalled();
      expect(mockAdministrationRepository.delete).not.toHaveBeenCalled();
    });

    it('should throw forbidden error when non-super admin lacks DELETE permission', async () => {
      const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
      mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
      mockAdministrationRepository.getAuthorizedById.mockResolvedValue(null);

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
        runsService: mockRunsService,
      });

      await expect(
        service.deleteById({ userId: 'teacher-user', isSuperAdmin: false }, 'admin-123'),
      ).rejects.toMatchObject({
        statusCode: 403,
        message: ApiErrorMessage.FORBIDDEN,
      });
      expect(mockRunsService.getByAdministrationId).not.toHaveBeenCalled();
      expect(mockAdministrationRepository.delete).not.toHaveBeenCalled();
    });

    it('should throw conflict error when runs exist for the administration', async () => {
      const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });
      mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
      mockRunsService.getByAdministrationId.mockResolvedValue(RunFactory.build({ id: 'run-123' }));

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
        runsService: mockRunsService,
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
      mockRunsService.getByAdministrationId.mockResolvedValue(null);
      mockAdministrationRepository.delete.mockRejectedValue(new Error('Database connection lost'));

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
        runsService: mockRunsService,
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
