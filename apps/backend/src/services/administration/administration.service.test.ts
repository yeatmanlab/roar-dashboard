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
import type {
  AssignmentWithOptional,
  TaskVariantWithAssignment,
  TreeNode,
} from '../../repositories/administration.repository';
import { TaskVariantStatus } from '../../enums/task-variant-status.enum';
import {
  createMockAdministrationRepository,
  createMockAdministrationTaskVariantRepository,
  createMockReportRepository,
  createMockRunRepository,
  createMockUserRepository,
  createMockDistrictRepository,
  createMockSchoolRepository,
  createMockClassRepository,
  createMockGroupRepository,
  createMockTaskVariantRepository,
  createMockAgreementRepository,
} from '../../test-support/repositories';
import { createMockAuthorizationService, createMockTaskService } from '../../test-support/services';
import type { MockAuthorizationService } from '../../test-support/services';
import { OrgFactory } from '../../test-support/factories/org.factory';
import { ClassFactory } from '../../test-support/factories/class.factory';
import { GroupFactory } from '../../test-support/factories/group.factory';

describe('AdministrationService', () => {
  let mockAdministrationRepository: ReturnType<typeof createMockAdministrationRepository>;
  let mockAdministrationTaskVariantRepository: ReturnType<typeof createMockAdministrationTaskVariantRepository>;
  let mockReportRepository: ReturnType<typeof createMockReportRepository>;
  let mockUserRepository: ReturnType<typeof createMockUserRepository>;
  let mockRunRepository: ReturnType<typeof createMockRunRepository>;
  let mockTaskService: ReturnType<typeof createMockTaskService>;
  let mockAuthorizationService: MockAuthorizationService;

  beforeEach(() => {
    vi.resetAllMocks();
    mockAdministrationRepository = createMockAdministrationRepository();
    mockAdministrationTaskVariantRepository = createMockAdministrationTaskVariantRepository();
    mockReportRepository = createMockReportRepository();
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

  describe('getUserAdministrations', () => {
    it('should delegate to list() when user requests their own administrations (self-access)', async () => {
      const mockAdmins = AdministrationFactory.buildList(2);

      mockAuthorizationService.listAccessibleObjects.mockResolvedValue(mockAdmins.map((a) => `administration:${a.id}`));
      mockAdministrationRepository.getByIds.mockResolvedValue({
        items: mockAdmins,
        totalItems: 2,
      });

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
        authorizationService: mockAuthorizationService,
      });

      const result = await service.getUserAdministrations({ userId: 'user-123', isSuperAdmin: false }, 'user-123', {
        page: 1,
        perPage: 25,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      // Should only call FGA once (for the requester, not separately for target)
      expect(mockAuthorizationService.listAccessibleObjects).toHaveBeenCalledTimes(1);
      expect(mockAuthorizationService.listAccessibleObjects).toHaveBeenCalledWith(
        'user-123',
        'can_list',
        'administration',
      );
      expect(result.items).toHaveLength(2);
      expect(result.totalItems).toBe(2);
    });

    it('should return administrations for super admin without filtering by requester permissions', async () => {
      const mockAdmins = AdministrationFactory.buildList(3);
      const mockUser = UserFactory.build({ id: 'target-user-123' });

      mockUserRepository.getById.mockResolvedValue(mockUser);
      mockAuthorizationService.listAccessibleObjects.mockResolvedValue(mockAdmins.map((a) => `administration:${a.id}`));
      mockAdministrationRepository.getByIds.mockResolvedValue({
        items: mockAdmins,
        totalItems: 3,
      });

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
        userRepository: mockUserRepository,
        authorizationService: mockAuthorizationService,
      });

      const result = await service.getUserAdministrations(
        { userId: 'super-admin', isSuperAdmin: true },
        'target-user-123',
        { page: 1, perPage: 25, sortBy: 'createdAt', sortOrder: 'desc' },
      );

      expect(mockAuthorizationService.listAccessibleObjects).toHaveBeenCalledWith(
        'target-user-123',
        'can_list',
        'administration',
      );
      expect(mockAdministrationRepository.getByIds).toHaveBeenCalledWith(
        mockAdmins.map((a) => a.id),
        expect.objectContaining({ page: 1, perPage: 25 }),
      );
      expect(result.items).toHaveLength(3);
      expect(result.totalItems).toBe(3);
    });

    it('should filter administrations by intersection of target and requester permissions for non-super-admin', async () => {
      const mockAdmins = ['admin-2', 'admin-3'].map((id) => AdministrationFactory.build({ id }));
      const mockUser = UserFactory.build({ id: 'target-user-123' });

      mockUserRepository.getById.mockResolvedValue(mockUser);
      mockAuthorizationService.listAccessibleObjects
        .mockResolvedValueOnce(['admin-1', 'admin-2', 'admin-3'].map((id) => `administration:${id}`))
        .mockResolvedValueOnce(['admin-2', 'admin-3', 'admin-4'].map((id) => `administration:${id}`));

      mockAdministrationRepository.getByIds.mockResolvedValue({
        items: mockAdmins,
        totalItems: 2,
      });

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
        userRepository: mockUserRepository,
        authorizationService: mockAuthorizationService,
      });

      const result = await service.getUserAdministrations(
        { userId: 'requester-user-456', isSuperAdmin: false },
        'target-user-123',
        { page: 1, perPage: 25, sortBy: 'createdAt', sortOrder: 'desc' },
      );

      expect(mockAuthorizationService.listAccessibleObjects).toHaveBeenCalledTimes(2);
      expect(mockAuthorizationService.listAccessibleObjects).toHaveBeenNthCalledWith(
        1,
        'target-user-123',
        'can_list',
        'administration',
      );
      expect(mockAuthorizationService.listAccessibleObjects).toHaveBeenNthCalledWith(
        2,
        'requester-user-456',
        'can_list',
        'administration',
      );
      expect(mockAdministrationRepository.getByIds).toHaveBeenCalledWith(
        ['admin-2', 'admin-3'],
        expect.objectContaining({ page: 1, perPage: 25 }),
      );
      expect(result.items).toHaveLength(2);
      expect(result.totalItems).toBe(2);
    });

    it('should return empty result when target user has no accessible administrations', async () => {
      const mockUser = UserFactory.build({ id: 'target-user-123' });

      mockUserRepository.getById.mockResolvedValue(mockUser);
      mockAuthorizationService.listAccessibleObjects.mockResolvedValue([]);

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
        userRepository: mockUserRepository,
        authorizationService: mockAuthorizationService,
      });

      const result = await service.getUserAdministrations(
        { userId: 'requester-user', isSuperAdmin: false },
        'target-user-123',
        { page: 1, perPage: 25, sortBy: 'createdAt', sortOrder: 'desc' },
      );

      expect(mockAuthorizationService.listAccessibleObjects).toHaveBeenCalledWith(
        'target-user-123',
        'can_list',
        'administration',
      );
      expect(mockAdministrationRepository.getByIds).not.toHaveBeenCalled();
      expect(result.items).toEqual([]);
      expect(result.totalItems).toBe(0);
    });

    it('should throw 404 when target user does not exist', async () => {
      mockUserRepository.getById.mockResolvedValue(null);

      const service = AdministrationService({
        userRepository: mockUserRepository,
        authorizationService: mockAuthorizationService,
      });

      await expect(
        service.getUserAdministrations({ userId: 'requester-user-456', isSuperAdmin: false }, 'non-existent-user', {
          page: 1,
          perPage: 25,
          sortBy: 'createdAt',
          sortOrder: 'desc',
        }),
      ).rejects.toMatchObject({
        statusCode: 404,
        message: ApiErrorMessage.NOT_FOUND,
        code: ApiErrorCode.RESOURCE_NOT_FOUND,
      });

      expect(mockUserRepository.getById).toHaveBeenCalledWith({ id: 'non-existent-user' });
      expect(mockAuthorizationService.listAccessibleObjects).not.toHaveBeenCalled();
    });

    it('should throw 403 when non-super-admin has no common administrations with target user', async () => {
      const mockUser = UserFactory.build({ id: 'target-user-123' });

      mockUserRepository.getById.mockResolvedValue(mockUser);
      mockAuthorizationService.listAccessibleObjects
        .mockResolvedValueOnce(['admin-1', 'admin-2'].map((id) => `administration:${id}`))
        .mockResolvedValueOnce(['admin-3', 'admin-4'].map((id) => `administration:${id}`));

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
        userRepository: mockUserRepository,
        authorizationService: mockAuthorizationService,
      });

      await expect(
        service.getUserAdministrations({ userId: 'requester-user-456', isSuperAdmin: false }, 'target-user-123', {
          page: 1,
          perPage: 25,
          sortBy: 'createdAt',
          sortOrder: 'desc',
        }),
      ).rejects.toMatchObject({
        statusCode: 403,
        message: ApiErrorMessage.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
      });

      expect(mockAuthorizationService.listAccessibleObjects).toHaveBeenCalledTimes(2);
      expect(mockAdministrationRepository.getByIds).not.toHaveBeenCalled();
    });

    it('should include stats embed for super admin when requested', async () => {
      const mockAdmin = AdministrationFactory.build({ id: 'admin-1' });
      const mockUser = UserFactory.build({ id: 'target-user-123' });

      mockUserRepository.getById.mockResolvedValue(mockUser);
      mockAuthorizationService.listAccessibleObjects.mockResolvedValue([`administration:${mockAdmin.id}`]);
      mockAdministrationRepository.getByIds.mockResolvedValue({
        items: [mockAdmin],
        totalItems: 1,
      });
      mockAdministrationRepository.getAssignedUserCountsByAdministrationIds.mockResolvedValue(
        new Map([[mockAdmin.id, 10]]),
      );
      mockRunRepository.getRunStatsByAdministrationIds.mockResolvedValue(
        new Map([[mockAdmin.id, { started: 5, completed: 3 }]]),
      );

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
        runRepository: mockRunRepository,
        userRepository: mockUserRepository,
        authorizationService: mockAuthorizationService,
      });

      const result = await service.getUserAdministrations(
        { userId: 'super-admin', isSuperAdmin: true },
        'target-user-123',
        { page: 1, perPage: 25, sortBy: 'createdAt', sortOrder: 'desc', embed: ['stats'] },
      );

      expect(mockAdministrationRepository.getAssignedUserCountsByAdministrationIds).toHaveBeenCalledWith([
        mockAdmin.id,
      ]);
      expect(mockRunRepository.getRunStatsByAdministrationIds).toHaveBeenCalledWith([mockAdmin.id]);
      expect(result.items[0]).toHaveProperty('stats');
      expect(result.items[0]!.stats).toEqual({ assigned: 10, started: 5, completed: 3 });
    });

    it('should not include stats embed for non-super-admin even when requested', async () => {
      const mockAdmin = AdministrationFactory.build({ id: 'admin-1' });
      const mockUser = UserFactory.build({ id: 'target-user-123' });

      mockUserRepository.getById.mockResolvedValue(mockUser);
      mockAuthorizationService.listAccessibleObjects
        .mockResolvedValueOnce([`administration:${mockAdmin.id}`])
        .mockResolvedValueOnce([`administration:${mockAdmin.id}`]);

      mockAdministrationRepository.getByIds.mockResolvedValue({
        items: [mockAdmin],
        totalItems: 1,
      });

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
        runRepository: mockRunRepository,
        userRepository: mockUserRepository,
        authorizationService: mockAuthorizationService,
      });

      const result = await service.getUserAdministrations(
        { userId: 'requester-user-456', isSuperAdmin: false },
        'target-user-123',
        { page: 1, perPage: 25, sortBy: 'createdAt', sortOrder: 'desc', embed: ['stats'] },
      );

      expect(mockAdministrationRepository.getAssignedUserCountsByAdministrationIds).not.toHaveBeenCalled();
      expect(mockRunRepository.getRunStatsByAdministrationIds).not.toHaveBeenCalled();
      expect(result.items[0]).not.toHaveProperty('stats');
    });

    it('should include tasks embed when requested', async () => {
      const mockAdmin = AdministrationFactory.build({ id: 'admin-1' });
      const mockUser = UserFactory.build({ id: 'target-user-123' });

      mockUserRepository.getById.mockResolvedValue(mockUser);
      mockAuthorizationService.listAccessibleObjects.mockResolvedValue([`administration:${mockAdmin.id}`]);
      mockAdministrationRepository.getByIds.mockResolvedValue({
        items: [mockAdmin],
        totalItems: 1,
      });
      mockAdministrationTaskVariantRepository.getByAdministrationIds.mockResolvedValue(
        new Map([
          [
            mockAdmin.id,
            [{ taskId: 'task-1', taskName: 'Task 1', variantId: 'variant-1', variantName: 'Variant 1', orderIndex: 0 }],
          ],
        ]),
      );

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
        administrationTaskVariantRepository: mockAdministrationTaskVariantRepository,
        userRepository: mockUserRepository,
        authorizationService: mockAuthorizationService,
      });

      const result = await service.getUserAdministrations(
        { userId: 'super-admin', isSuperAdmin: true },
        'target-user-123',
        { page: 1, perPage: 25, sortBy: 'createdAt', sortOrder: 'desc', embed: ['tasks'] },
      );

      expect(mockAdministrationTaskVariantRepository.getByAdministrationIds).toHaveBeenCalledWith([mockAdmin.id]);
      expect(result.items[0]).toHaveProperty('tasks');
      expect(result.items[0]!.tasks).toEqual([
        { taskId: 'task-1', taskName: 'Task 1', variantId: 'variant-1', variantName: 'Variant 1', orderIndex: 0 },
      ]);
    });

    it('should include both stats and tasks embeds when requested by super admin', async () => {
      const mockAdmin = AdministrationFactory.build({ id: 'admin-1' });
      const mockUser = UserFactory.build({ id: 'target-user-123' });

      mockUserRepository.getById.mockResolvedValue(mockUser);
      mockAuthorizationService.listAccessibleObjects.mockResolvedValue([`administration:${mockAdmin.id}`]);
      mockAdministrationRepository.getByIds.mockResolvedValue({
        items: [mockAdmin],
        totalItems: 1,
      });
      mockAdministrationRepository.getAssignedUserCountsByAdministrationIds.mockResolvedValue(
        new Map([[mockAdmin.id, 10]]),
      );
      mockRunRepository.getRunStatsByAdministrationIds.mockResolvedValue(
        new Map([[mockAdmin.id, { started: 5, completed: 3 }]]),
      );
      mockAdministrationTaskVariantRepository.getByAdministrationIds.mockResolvedValue(
        new Map([
          [
            mockAdmin.id,
            [{ taskId: 'task-1', taskName: 'Task 1', variantId: 'variant-1', variantName: 'Variant 1', orderIndex: 0 }],
          ],
        ]),
      );

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
        runRepository: mockRunRepository,
        administrationTaskVariantRepository: mockAdministrationTaskVariantRepository,
        userRepository: mockUserRepository,
        authorizationService: mockAuthorizationService,
      });

      const result = await service.getUserAdministrations(
        { userId: 'super-admin', isSuperAdmin: true },
        'target-user-123',
        { page: 1, perPage: 25, sortBy: 'createdAt', sortOrder: 'desc', embed: ['stats', 'tasks'] },
      );

      expect(result.items[0]).toHaveProperty('stats');
      expect(result.items[0]).toHaveProperty('tasks');
      expect(result.items[0]!.stats).toEqual({ assigned: 10, started: 5, completed: 3 });
      expect(result.items[0]!.tasks).toEqual([
        { taskId: 'task-1', taskName: 'Task 1', variantId: 'variant-1', variantName: 'Variant 1', orderIndex: 0 },
      ]);
    });

    it('should apply status filter when provided', async () => {
      const mockAdmins = AdministrationFactory.buildList(2);
      const mockUser = UserFactory.build({ id: 'target-user-123' });

      mockUserRepository.getById.mockResolvedValue(mockUser);
      mockAuthorizationService.listAccessibleObjects.mockResolvedValue(mockAdmins.map((a) => `administration:${a.id}`));
      mockAdministrationRepository.getByIds.mockResolvedValue({
        items: mockAdmins,
        totalItems: 2,
      });

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
        userRepository: mockUserRepository,
        authorizationService: mockAuthorizationService,
      });

      await service.getUserAdministrations({ userId: 'super-admin', isSuperAdmin: true }, 'target-user-123', {
        page: 1,
        perPage: 25,
        sortBy: 'createdAt',
        sortOrder: 'desc',
        status: 'active',
      });

      expect(mockAdministrationRepository.getByIds).toHaveBeenCalledWith(
        mockAdmins.map((a) => a.id),
        expect.objectContaining({ status: 'active' }),
      );
    });

    it('should throw internal error on database failure', async () => {
      const mockUser = UserFactory.build({ id: 'target-user-123' });

      mockUserRepository.getById.mockResolvedValue(mockUser);
      mockAuthorizationService.listAccessibleObjects.mockRejectedValue(new Error('Database connection lost'));

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
        userRepository: mockUserRepository,
        authorizationService: mockAuthorizationService,
      });

      await expect(
        service.getUserAdministrations({ userId: 'super-admin', isSuperAdmin: true }, 'target-user-123', {
          page: 1,
          perPage: 25,
          sortBy: 'createdAt',
          sortOrder: 'desc',
        }),
      ).rejects.toMatchObject({
        statusCode: 500,
        message: ApiErrorMessage.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
      });
    });
  });

  describe('getTree', () => {
    const superAdminAuth = { userId: 'super-admin', isSuperAdmin: true };
    const regularUserAuth = { userId: 'regular-user', isSuperAdmin: false };
    const testAdminId = 'admin-tree-123';
    const defaultOptions = { page: 1, perPage: 25, embed: [] as 'stats'[] };
    const mockAdmin = AdministrationFactory.build({ id: testAdminId });

    const mockTreeNodes: TreeNode[] = [
      { id: 'district-1', name: 'District A', entityType: 'district', hasChildren: true },
      { id: 'school-1', name: 'School B', entityType: 'school', hasChildren: true },
      { id: 'class-1', name: 'Class C', entityType: 'class', hasChildren: false },
      { id: 'group-1', name: 'Group A', entityType: 'group', hasChildren: false },
    ];

    function createService() {
      return AdministrationService({
        administrationRepository: mockAdministrationRepository,
        reportRepository: mockReportRepository,
        authorizationService: mockAuthorizationService,
      });
    }

    it('should throw 400 when parentEntityId is provided without parentEntityType', async () => {
      const service = createService();

      await expect(
        service.getTree(superAdminAuth, testAdminId, {
          ...defaultOptions,
          parentEntityId: 'some-id',
        }),
      ).rejects.toMatchObject({
        statusCode: StatusCodes.BAD_REQUEST,
        code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
      });
    });

    it('should throw 400 when parentEntityType is provided without parentEntityId', async () => {
      const service = createService();

      await expect(
        service.getTree(superAdminAuth, testAdminId, {
          ...defaultOptions,
          parentEntityType: 'district',
        }),
      ).rejects.toMatchObject({
        statusCode: StatusCodes.BAD_REQUEST,
        code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
      });
    });

    it('should call verifyAdministrationAccess to check existence and authorization', async () => {
      mockAdministrationRepository.getById.mockResolvedValue(null);

      const service = createService();

      await expect(service.getTree(superAdminAuth, testAdminId, defaultOptions)).rejects.toMatchObject({
        statusCode: StatusCodes.NOT_FOUND,
      });
    });

    it('should skip FGA calls for super admins and pass undefined accessibleIds', async () => {
      mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
      mockAdministrationRepository.getTreeNodes.mockResolvedValue({
        items: mockTreeNodes,
        totalItems: 4,
      });

      const service = createService();
      const result = await service.getTree(superAdminAuth, testAdminId, defaultOptions);

      expect(mockAuthorizationService.listAccessibleObjects).not.toHaveBeenCalled();
      expect(mockAdministrationRepository.getTreeNodes).toHaveBeenCalledWith(
        testAdminId,
        undefined,
        undefined,
        { page: 1, perPage: 25 },
        undefined,
      );
      expect(result.items).toHaveLength(4);
      expect(result.totalItems).toBe(4);
    });

    it('should call FGA for non-super-admin users and pass accessible IDs', async () => {
      mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
      mockAdministrationRepository.getTreeNodes.mockResolvedValue({
        items: mockTreeNodes,
        totalItems: 4,
      });

      // Mock FGA responses for all 4 entity types
      mockAuthorizationService.listAccessibleObjects
        .mockResolvedValueOnce(['district:district-1', 'district:district-2']) // districts
        .mockResolvedValueOnce(['school:school-1']) // schools
        .mockResolvedValueOnce(['class:class-1', 'class:class-2']) // classes
        .mockResolvedValueOnce(['group:group-1']); // groups

      const service = createService();
      await service.getTree(regularUserAuth, testAdminId, defaultOptions);

      expect(mockAuthorizationService.listAccessibleObjects).toHaveBeenCalledTimes(4);
      expect(mockAdministrationRepository.getTreeNodes).toHaveBeenCalledWith(
        testAdminId,
        undefined,
        undefined,
        { page: 1, perPage: 25 },
        {
          districtIds: ['district-1', 'district-2'],
          schoolIds: ['school-1'],
          classIds: ['class-1', 'class-2'],
          groupIds: ['group-1'],
        },
      );
    });

    it('should pass parentEntityType and parentEntityId to repository', async () => {
      mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
      mockAdministrationRepository.getTreeNodes.mockResolvedValue({ items: [], totalItems: 0 });

      const service = createService();
      await service.getTree(superAdminAuth, testAdminId, {
        ...defaultOptions,
        parentEntityType: 'district',
        parentEntityId: 'district-1',
      });

      expect(mockAdministrationRepository.getTreeNodes).toHaveBeenCalledWith(
        testAdminId,
        'district',
        'district-1',
        { page: 1, perPage: 25 },
        undefined,
      );
    });

    it('should return nodes without stats when embed=stats is not requested', async () => {
      mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
      mockAdministrationRepository.getTreeNodes.mockResolvedValue({
        items: mockTreeNodes,
        totalItems: 4,
      });

      const service = createService();
      const result = await service.getTree(superAdminAuth, testAdminId, defaultOptions);

      expect(result.items[0]).not.toHaveProperty('stats');
      expect(mockReportRepository.getTaskMetadata).not.toHaveBeenCalled();
    });

    it('should attach real stats when embed=stats is requested', async () => {
      mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
      mockAdministrationRepository.getTreeNodes.mockResolvedValue({
        items: mockTreeNodes,
        totalItems: 4,
      });

      // Mock task metadata
      mockReportRepository.getTaskMetadata.mockResolvedValue([
        {
          taskId: 'task-1',
          taskVariantId: 'tv-1',
          taskSlug: 'swr',
          taskName: 'SWR',
          orderIndex: 0,
          conditionsAssignment: null,
          conditionsRequirements: null,
        },
      ]);

      // Mock bulk stats — return student-level counts for district-1 and school-1, zero for others
      const statsMap = new Map();
      statsMap.set('district-1', {
        totalStudents: 50,
        taskStatusCounts: [
          { taskId: 'task-1', status: 'assigned-required', count: 20 },
          { taskId: 'task-1', status: 'started-required', count: 15 },
          { taskId: 'task-1', status: 'completed-required', count: 10 },
        ],
        studentCounts: {
          studentsWithRequiredTasks: 45,
          studentsAssigned: 20,
          studentsStarted: 15,
          studentsCompleted: 10,
        },
      });
      statsMap.set('school-1', {
        totalStudents: 30,
        taskStatusCounts: [
          { taskId: 'task-1', status: 'assigned-required', count: 12 },
          { taskId: 'task-1', status: 'completed-required', count: 8 },
        ],
        studentCounts: {
          studentsWithRequiredTasks: 20,
          studentsAssigned: 12,
          studentsStarted: 0,
          studentsCompleted: 8,
        },
      });
      statsMap.set('class-1', {
        totalStudents: 0,
        taskStatusCounts: [],
        studentCounts: { studentsWithRequiredTasks: 0, studentsAssigned: 0, studentsStarted: 0, studentsCompleted: 0 },
      });
      statsMap.set('group-1', {
        totalStudents: 0,
        taskStatusCounts: [],
        studentCounts: { studentsWithRequiredTasks: 0, studentsAssigned: 0, studentsStarted: 0, studentsCompleted: 0 },
      });
      mockReportRepository.getProgressOverviewCountsBulk.mockResolvedValue(statsMap);

      const service = createService();
      const result = await service.getTree(superAdminAuth, testAdminId, {
        ...defaultOptions,
        embed: ['stats'],
      });

      // district-1: student-level counts from bulk result
      expect(result.items[0]!.stats).toEqual({
        assignment: { studentsWithRequiredTasks: 45, studentsAssigned: 20, studentsStarted: 15, studentsCompleted: 10 },
      });
      // school-1: student-level counts from bulk result
      expect(result.items[1]!.stats).toEqual({
        assignment: { studentsWithRequiredTasks: 20, studentsAssigned: 12, studentsStarted: 0, studentsCompleted: 8 },
      });
      // class-1: zeroed
      expect(result.items[2]!.stats).toEqual({
        assignment: { studentsWithRequiredTasks: 0, studentsAssigned: 0, studentsStarted: 0, studentsCompleted: 0 },
      });

      // Verify bulk method was called with correct scopes
      expect(mockReportRepository.getProgressOverviewCountsBulk).toHaveBeenCalledWith(
        testAdminId,
        [
          { scopeType: 'district', scopeId: 'district-1' },
          { scopeType: 'school', scopeId: 'school-1' },
          { scopeType: 'class', scopeId: 'class-1' },
          { scopeType: 'group', scopeId: 'group-1' },
        ],
        expect.any(Array),
      );
    });

    it('should return zeroed stats when no task metadata exists', async () => {
      mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
      mockAdministrationRepository.getTreeNodes.mockResolvedValue({
        items: mockTreeNodes,
        totalItems: 4,
      });

      // No tasks configured for the administration
      mockReportRepository.getTaskMetadata.mockResolvedValue([]);

      const service = createService();
      const result = await service.getTree(superAdminAuth, testAdminId, {
        ...defaultOptions,
        embed: ['stats'],
      });

      expect(result.items[0]!.stats).toEqual({
        assignment: { studentsWithRequiredTasks: 0, studentsAssigned: 0, studentsStarted: 0, studentsCompleted: 0 },
      });
      expect(mockReportRepository.getProgressOverviewCountsBulk).not.toHaveBeenCalled();
    });

    it('should return zeroed stats for nodes missing from the bulk stats map', async () => {
      mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
      mockAdministrationRepository.getTreeNodes.mockResolvedValue({
        items: mockTreeNodes,
        totalItems: 4,
      });

      mockReportRepository.getTaskMetadata.mockResolvedValue([
        {
          taskId: 'task-1',
          taskVariantId: 'tv-1',
          taskSlug: 'swr',
          taskName: 'SWR',
          orderIndex: 0,
          conditionsAssignment: null,
          conditionsRequirements: null,
        },
      ]);

      // Bulk stats only returns results for district-1 — other scopes are missing
      const statsMap = new Map();
      statsMap.set('district-1', {
        totalStudents: 50,
        taskStatusCounts: [],
        studentCounts: {
          studentsWithRequiredTasks: 40,
          studentsAssigned: 20,
          studentsStarted: 12,
          studentsCompleted: 8,
        },
      });
      mockReportRepository.getProgressOverviewCountsBulk.mockResolvedValue(statsMap);

      const service = createService();
      const result = await service.getTree(superAdminAuth, testAdminId, {
        ...defaultOptions,
        embed: ['stats'],
      });

      // district-1 has real stats
      expect(result.items[0]!.stats).toEqual({
        assignment: { studentsWithRequiredTasks: 40, studentsAssigned: 20, studentsStarted: 12, studentsCompleted: 8 },
      });
      // school-1, class-1, group-1 are missing from statsMap → zeroed
      expect(result.items[1]!.stats).toEqual({
        assignment: { studentsWithRequiredTasks: 0, studentsAssigned: 0, studentsStarted: 0, studentsCompleted: 0 },
      });
      expect(result.items[2]!.stats).toEqual({
        assignment: { studentsWithRequiredTasks: 0, studentsAssigned: 0, studentsStarted: 0, studentsCompleted: 0 },
      });
      expect(result.items[3]!.stats).toEqual({
        assignment: { studentsWithRequiredTasks: 0, studentsAssigned: 0, studentsStarted: 0, studentsCompleted: 0 },
      });
    });

    it('should not attach stats when result is empty even if embed=stats', async () => {
      mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
      mockAdministrationRepository.getTreeNodes.mockResolvedValue({ items: [], totalItems: 0 });

      const service = createService();
      const result = await service.getTree(superAdminAuth, testAdminId, {
        ...defaultOptions,
        embed: ['stats'],
      });

      expect(result.items).toHaveLength(0);
      expect(mockReportRepository.getTaskMetadata).not.toHaveBeenCalled();
    });

    it('should pass accessible IDs together with parentEntityType for non-super-admin drill-down', async () => {
      mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
      mockAdministrationRepository.getTreeNodes.mockResolvedValue({ items: [], totalItems: 0 });

      mockAuthorizationService.listAccessibleObjects
        .mockResolvedValueOnce(['district:d1']) // districts
        .mockResolvedValueOnce(['school:s1']) // schools
        .mockResolvedValueOnce(['class:c1']) // classes
        .mockResolvedValueOnce(['group:g1']); // groups

      const service = createService();
      await service.getTree(regularUserAuth, testAdminId, {
        ...defaultOptions,
        parentEntityType: 'district',
        parentEntityId: 'd1',
      });

      expect(mockAdministrationRepository.getTreeNodes).toHaveBeenCalledWith(
        testAdminId,
        'district',
        'd1',
        { page: 1, perPage: 25 },
        {
          districtIds: ['d1'],
          schoolIds: ['s1'],
          classIds: ['c1'],
          groupIds: ['g1'],
        },
      );
    });

    it('should return result without stats when embed option is undefined', async () => {
      mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
      mockAdministrationRepository.getTreeNodes.mockResolvedValue({
        items: mockTreeNodes,
        totalItems: 4,
      });

      const service = createService();
      const result = await service.getTree(superAdminAuth, testAdminId, {
        page: 1,
        perPage: 25,
      });

      expect(result.items).toHaveLength(4);
      expect(result.items[0]).not.toHaveProperty('stats');
    });

    it('should wrap FGA failures as 500 ApiError', async () => {
      mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
      mockAuthorizationService.listAccessibleObjects.mockRejectedValue(new Error('FGA down'));

      const service = createService();

      await expect(service.getTree(regularUserAuth, testAdminId, defaultOptions)).rejects.toMatchObject({
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: 'database/query-failed',
      });
    });

    it('should wrap unexpected repository errors as 500 ApiError', async () => {
      mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
      mockAdministrationRepository.getTreeNodes.mockRejectedValue(new Error('DB error'));

      const service = createService();

      await expect(service.getTree(superAdminAuth, testAdminId, defaultOptions)).rejects.toMatchObject({
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        message: ApiErrorMessage.INTERNAL_SERVER_ERROR,
      });
    });

    it('should re-throw ApiError from verifyAdministrationAccess when FGA denies access', async () => {
      mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
      // FGA: can_read permission denied via requirePermission
      mockAuthorizationService.requirePermission.mockRejectedValue(
        new ApiError(ApiErrorMessage.FORBIDDEN, {
          statusCode: StatusCodes.FORBIDDEN,
          code: ApiErrorCode.AUTH_FORBIDDEN,
        }),
      );

      const service = createService();

      await expect(service.getTree(regularUserAuth, testAdminId, defaultOptions)).rejects.toMatchObject({
        statusCode: StatusCodes.FORBIDDEN,
      });
    });
  });

  describe('create', () => {
    const mockAuthContext = { userId: 'user-123', isSuperAdmin: false };
    const superAdminAuthContext = { userId: 'super-admin-123', isSuperAdmin: true };
    const validRequest = {
      name: 'Test Administration',
      namePublic: 'Public Test Name',
      description: 'Test description',
      dateStart: '2024-01-01T00:00:00Z',
      dateEnd: '2024-12-31T23:59:59Z',
      isOrdered: false,
      orgs: ['org-1', 'org-2'],
      classes: ['class-1'],
      groups: ['group-1'],
      taskVariants: [
        {
          taskVariantId: 'tv-1',
          orderIndex: 0,
        },
      ],
      agreements: ['agreement-1'],
    };

    it('should throw forbidden error when non-super admin attempts to create', async () => {
      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
        userRepository: mockUserRepository,
      });

      await expect(service.create(mockAuthContext, validRequest)).rejects.toMatchObject({
        statusCode: StatusCodes.FORBIDDEN,
        message: ApiErrorMessage.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
      });

      // Should not make any repository calls
      expect(mockAdministrationRepository.createWithAssignments).not.toHaveBeenCalled();
    });

    it('should create administration successfully with valid data', async () => {
      // Arrange
      const mockCreatedAdmin = AdministrationFactory.build();
      const mockDistrict = OrgFactory.build({ id: 'org-1', orgType: 'district' });
      const mockSchool = OrgFactory.build({ id: 'org-2', orgType: 'school' });
      const mockClass = ClassFactory.build({ id: 'class-1' });
      const mockGroup = GroupFactory.build({ id: 'group-1' });
      const mockTaskVariant = TaskVariantFactory.build({ id: 'tv-1' });
      const mockAgreement = AgreementFactory.build({ id: 'agreement-1' });

      // Mock all repository calls
      mockAdministrationRepository.existsByName.mockResolvedValue(false);
      mockAdministrationRepository.createWithAssignments.mockResolvedValue(mockCreatedAdmin);

      // Mock district and school repositories
      const mockDistrictRepo = createMockDistrictRepository();
      const mockSchoolRepo = createMockSchoolRepository();
      const mockClassRepo = createMockClassRepository();
      const mockGroupRepo = createMockGroupRepository();
      const mockTaskVariantRepo = createMockTaskVariantRepository();
      const mockAgreementRepo = createMockAgreementRepository();

      mockDistrictRepo.listByIds.mockResolvedValue({ items: [mockDistrict], totalItems: 1 });
      mockSchoolRepo.listByIds.mockResolvedValue({ items: [mockSchool], totalItems: 1 });
      mockClassRepo.getByIds.mockResolvedValue({ items: [mockClass], totalItems: 1 });
      mockGroupRepo.getByIds.mockResolvedValue({ items: [mockGroup], totalItems: 1 });
      mockTaskVariantRepo.getByIds.mockResolvedValue({ items: [mockTaskVariant], totalItems: 1 });
      mockAgreementRepo.getByIds.mockResolvedValue({ items: [mockAgreement], totalItems: 1 });

      // Create service with all repositories
      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
        userRepository: mockUserRepository,
        districtRepository: mockDistrictRepo,
        schoolRepository: mockSchoolRepo,
        classRepository: mockClassRepo,
        groupRepository: mockGroupRepo,
        taskVariantRepository: mockTaskVariantRepo,
        agreementRepository: mockAgreementRepo,
      });

      // Act
      const result = await service.create(superAdminAuthContext, validRequest);

      // Assert
      expect(result).toBe(mockCreatedAdmin);
      expect(mockAdministrationRepository.createWithAssignments).toHaveBeenCalledWith(
        expect.objectContaining({
          administration: expect.objectContaining({
            name: validRequest.name,
            namePublic: validRequest.namePublic,
            dateStart: new Date(validRequest.dateStart),
            dateEnd: new Date(validRequest.dateEnd),
            isOrdered: validRequest.isOrdered,
            createdBy: superAdminAuthContext.userId,
          }),
          orgIds: validRequest.orgs,
          classIds: validRequest.classes,
          groupIds: validRequest.groups,
          taskVariants: validRequest.taskVariants.map((tv) => ({
            taskVariantId: tv.taskVariantId,
            orderIndex: tv.orderIndex,
            conditionsAssignment: null,
            conditionsRequirements: null,
          })),
          agreementIds: validRequest.agreements,
        }),
      );
    });

    it('should create administration successfully when orgs array contains only school IDs', async () => {
      // Arrange
      const mockCreatedAdmin = AdministrationFactory.build();
      const mockSchool = OrgFactory.build({ id: 'school-1', orgType: 'school' });
      const mockClass = ClassFactory.build({ id: 'class-1' });
      const mockGroup = GroupFactory.build({ id: 'group-1' });
      const mockTaskVariant = TaskVariantFactory.build({ id: 'tv-1' });
      const mockAgreement = AgreementFactory.build({ id: 'agreement-1' });

      // Request with only school IDs in orgs array
      const schoolOnlyRequest = {
        ...validRequest,
        orgs: ['school-1'],
      };

      // Mock all repository calls
      mockAdministrationRepository.existsByName.mockResolvedValue(false);
      mockAdministrationRepository.createWithAssignments.mockResolvedValue(mockCreatedAdmin);

      const mockDistrictRepo = createMockDistrictRepository();
      const mockSchoolRepo = createMockSchoolRepository();
      const mockClassRepo = createMockClassRepository();
      const mockGroupRepo = createMockGroupRepository();
      const mockTaskVariantRepo = createMockTaskVariantRepository();
      const mockAgreementRepo = createMockAgreementRepository();

      // District returns empty (no districts found), school returns the school
      mockDistrictRepo.listByIds.mockResolvedValue({ items: [], totalItems: 0 });
      mockSchoolRepo.listByIds.mockResolvedValue({ items: [mockSchool], totalItems: 1 });
      mockClassRepo.getByIds.mockResolvedValue({ items: [mockClass], totalItems: 1 });
      mockGroupRepo.getByIds.mockResolvedValue({ items: [mockGroup], totalItems: 1 });
      mockTaskVariantRepo.getByIds.mockResolvedValue({ items: [mockTaskVariant], totalItems: 1 });
      mockAgreementRepo.getByIds.mockResolvedValue({ items: [mockAgreement], totalItems: 1 });

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
        userRepository: mockUserRepository,
        districtRepository: mockDistrictRepo,
        schoolRepository: mockSchoolRepo,
        classRepository: mockClassRepo,
        groupRepository: mockGroupRepo,
        taskVariantRepository: mockTaskVariantRepo,
        agreementRepository: mockAgreementRepo,
      });

      // Act
      const result = await service.create(superAdminAuthContext, schoolOnlyRequest);

      // Assert
      expect(result).toBe(mockCreatedAdmin);
      expect(mockAdministrationRepository.createWithAssignments).toHaveBeenCalledWith(
        expect.objectContaining({
          orgIds: ['school-1'],
        }),
      );
    });

    it('should throw error when dateEnd is before dateStart', async () => {
      // Arrange
      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
        userRepository: mockUserRepository,
      });
      const invalidRequest = {
        ...validRequest,
        dateStart: '2024-12-31T23:59:59Z',
        dateEnd: '2024-01-01T00:00:00Z',
      };

      // Act & Assert
      await expect(service.create(superAdminAuthContext, invalidRequest)).rejects.toThrow(
        expect.objectContaining({
          message: ApiErrorMessage.REQUEST_VALIDATION_FAILED,
          statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
          code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
        }),
      );
    });

    it('should throw error when task variant order indices are not unique and isOrdered is true', async () => {
      // Arrange
      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
        userRepository: mockUserRepository,
      });
      const invalidRequest = {
        ...validRequest,
        isOrdered: true,
        taskVariants: [
          { taskVariantId: 'tv-1', orderIndex: 0 },
          { taskVariantId: 'tv-2', orderIndex: 0 },
        ],
      };

      // Act & Assert
      await expect(service.create(superAdminAuthContext, invalidRequest)).rejects.toThrow(
        expect.objectContaining({
          message: ApiErrorMessage.REQUEST_VALIDATION_FAILED,
          statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
          code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
        }),
      );
    });

    it('should throw error when no org, class, or group is assigned', async () => {
      // Arrange
      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
        userRepository: mockUserRepository,
      });
      const invalidRequest = {
        ...validRequest,
        orgs: [],
        classes: [],
        groups: [],
      };

      // Act & Assert
      await expect(service.create(superAdminAuthContext, invalidRequest)).rejects.toThrow(
        expect.objectContaining({
          message: ApiErrorMessage.REQUEST_VALIDATION_FAILED,
          statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
          code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
        }),
      );
    });

    it('should throw conflict error when administration name already exists', async () => {
      // Arrange
      mockAdministrationRepository.existsByName.mockResolvedValue(true);

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
        userRepository: mockUserRepository,
      });

      // Act & Assert
      await expect(service.create(superAdminAuthContext, validRequest)).rejects.toThrow(
        expect.objectContaining({
          message: ApiErrorMessage.CONFLICT,
          statusCode: StatusCodes.CONFLICT,
          code: ApiErrorCode.RESOURCE_CONFLICT,
        }),
      );
    });

    it('should throw error when referenced org does not exist', async () => {
      // Arrange
      mockAdministrationRepository.existsByName.mockResolvedValue(false);
      const mockDistrictRepo = createMockDistrictRepository();
      const mockSchoolRepo = createMockSchoolRepository();
      mockDistrictRepo.listByIds.mockResolvedValue({ items: [], totalItems: 0 });
      mockSchoolRepo.listByIds.mockResolvedValue({ items: [], totalItems: 0 });

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
        userRepository: mockUserRepository,
        districtRepository: mockDistrictRepo,
        schoolRepository: mockSchoolRepo,
      });

      // Act & Assert
      await expect(service.create(superAdminAuthContext, validRequest)).rejects.toThrow(
        expect.objectContaining({
          message: ApiErrorMessage.REQUEST_VALIDATION_FAILED,
          statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
          code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
        }),
      );
    });

    it('should throw error when referenced class does not exist', async () => {
      // Arrange
      mockAdministrationRepository.existsByName.mockResolvedValue(false);
      const mockDistrict = OrgFactory.build({ id: 'org-1', orgType: 'district' });
      const mockSchool = OrgFactory.build({ id: 'org-2', orgType: 'school' });

      const mockDistrictRepo = createMockDistrictRepository();
      const mockSchoolRepo = createMockSchoolRepository();
      const mockClassRepo = createMockClassRepository();
      mockDistrictRepo.listByIds.mockResolvedValue({ items: [mockDistrict], totalItems: 1 });
      mockSchoolRepo.listByIds.mockResolvedValue({ items: [mockSchool], totalItems: 1 });
      mockClassRepo.getByIds.mockResolvedValue({ items: [], totalItems: 0 });

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
        userRepository: mockUserRepository,
        districtRepository: mockDistrictRepo,
        schoolRepository: mockSchoolRepo,
        classRepository: mockClassRepo,
      });

      // Act & Assert
      await expect(service.create(superAdminAuthContext, validRequest)).rejects.toThrow(
        expect.objectContaining({
          message: ApiErrorMessage.REQUEST_VALIDATION_FAILED,
          statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
          code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
        }),
      );
    });

    it('should throw error when referenced task variant does not exist', async () => {
      // Arrange
      mockAdministrationRepository.existsByName.mockResolvedValue(false);
      const mockDistrict = OrgFactory.build({ id: 'org-1', orgType: 'district' });
      const mockSchool = OrgFactory.build({ id: 'org-2', orgType: 'school' });
      const mockClass = ClassFactory.build({ id: 'class-1' });
      const mockGroup = GroupFactory.build({ id: 'group-1' });
      const mockAgreement = AgreementFactory.build({ id: 'agreement-1' });

      const mockDistrictRepo = createMockDistrictRepository();
      const mockSchoolRepo = createMockSchoolRepository();
      const mockClassRepo = createMockClassRepository();
      const mockGroupRepo = createMockGroupRepository();
      const mockTaskVariantRepo = createMockTaskVariantRepository();
      const mockAgreementRepo = createMockAgreementRepository();
      mockDistrictRepo.listByIds.mockResolvedValue({ items: [mockDistrict], totalItems: 1 });
      mockSchoolRepo.listByIds.mockResolvedValue({ items: [mockSchool], totalItems: 1 });
      mockClassRepo.getByIds.mockResolvedValue({ items: [mockClass], totalItems: 1 });
      mockGroupRepo.getByIds.mockResolvedValue({ items: [mockGroup], totalItems: 1 });
      mockTaskVariantRepo.getByIds.mockResolvedValue({ items: [], totalItems: 0 });
      mockAgreementRepo.getByIds.mockResolvedValue({ items: [mockAgreement], totalItems: 1 });

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
        userRepository: mockUserRepository,
        districtRepository: mockDistrictRepo,
        schoolRepository: mockSchoolRepo,
        classRepository: mockClassRepo,
        groupRepository: mockGroupRepo,
        taskVariantRepository: mockTaskVariantRepo,
        agreementRepository: mockAgreementRepo,
      });

      // Act & Assert
      await expect(service.create(superAdminAuthContext, validRequest)).rejects.toThrow(
        expect.objectContaining({
          message: ApiErrorMessage.REQUEST_VALIDATION_FAILED,
          statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
          code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
        }),
      );
    });

    it('should throw error when task variant is not published', async () => {
      // Arrange
      mockAdministrationRepository.existsByName.mockResolvedValue(false);
      const mockDistrict = OrgFactory.build({ id: 'org-1', orgType: 'district' });
      const mockSchool = OrgFactory.build({ id: 'org-2', orgType: 'school' });
      const mockClass = ClassFactory.build({ id: 'class-1' });
      const mockGroup = GroupFactory.build({ id: 'group-1' });
      const mockDraftTaskVariant = TaskVariantFactory.build({ id: 'tv-1', status: TaskVariantStatus.DRAFT });
      const mockAgreement = AgreementFactory.build({ id: 'agreement-1' });

      const mockDistrictRepo = createMockDistrictRepository();
      const mockSchoolRepo = createMockSchoolRepository();
      const mockClassRepo = createMockClassRepository();
      const mockGroupRepo = createMockGroupRepository();
      const mockTaskVariantRepo = createMockTaskVariantRepository();
      const mockAgreementRepo = createMockAgreementRepository();
      mockDistrictRepo.listByIds.mockResolvedValue({ items: [mockDistrict], totalItems: 1 });
      mockSchoolRepo.listByIds.mockResolvedValue({ items: [mockSchool], totalItems: 1 });
      mockClassRepo.getByIds.mockResolvedValue({ items: [mockClass], totalItems: 1 });
      mockGroupRepo.getByIds.mockResolvedValue({ items: [mockGroup], totalItems: 1 });
      mockTaskVariantRepo.getByIds.mockResolvedValue({ items: [mockDraftTaskVariant], totalItems: 1 });
      mockAgreementRepo.getByIds.mockResolvedValue({ items: [mockAgreement], totalItems: 1 });

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
        userRepository: mockUserRepository,
        districtRepository: mockDistrictRepo,
        schoolRepository: mockSchoolRepo,
        classRepository: mockClassRepo,
        groupRepository: mockGroupRepo,
        taskVariantRepository: mockTaskVariantRepo,
        agreementRepository: mockAgreementRepo,
      });

      // Act & Assert
      await expect(service.create(superAdminAuthContext, validRequest)).rejects.toThrow(
        expect.objectContaining({
          message: ApiErrorMessage.REQUEST_VALIDATION_FAILED,
          statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
          code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
        }),
      );
    });

    it('should throw error when task variant is deprecated', async () => {
      // Arrange
      mockAdministrationRepository.existsByName.mockResolvedValue(false);
      const mockDistrict = OrgFactory.build({ id: 'org-1', orgType: 'district' });
      const mockSchool = OrgFactory.build({ id: 'org-2', orgType: 'school' });
      const mockClass = ClassFactory.build({ id: 'class-1' });
      const mockGroup = GroupFactory.build({ id: 'group-1' });
      const mockDeprecatedTaskVariant = TaskVariantFactory.build({ id: 'tv-1', status: TaskVariantStatus.DEPRECATED });
      const mockAgreement = AgreementFactory.build({ id: 'agreement-1' });

      const mockDistrictRepo = createMockDistrictRepository();
      const mockSchoolRepo = createMockSchoolRepository();
      const mockClassRepo = createMockClassRepository();
      const mockGroupRepo = createMockGroupRepository();
      const mockTaskVariantRepo = createMockTaskVariantRepository();
      const mockAgreementRepo = createMockAgreementRepository();
      mockDistrictRepo.listByIds.mockResolvedValue({ items: [mockDistrict], totalItems: 1 });
      mockSchoolRepo.listByIds.mockResolvedValue({ items: [mockSchool], totalItems: 1 });
      mockClassRepo.getByIds.mockResolvedValue({ items: [mockClass], totalItems: 1 });
      mockGroupRepo.getByIds.mockResolvedValue({ items: [mockGroup], totalItems: 1 });
      mockTaskVariantRepo.getByIds.mockResolvedValue({ items: [mockDeprecatedTaskVariant], totalItems: 1 });
      mockAgreementRepo.getByIds.mockResolvedValue({ items: [mockAgreement], totalItems: 1 });

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
        userRepository: mockUserRepository,
        districtRepository: mockDistrictRepo,
        schoolRepository: mockSchoolRepo,
        classRepository: mockClassRepo,
        groupRepository: mockGroupRepo,
        taskVariantRepository: mockTaskVariantRepo,
        agreementRepository: mockAgreementRepo,
      });

      // Act & Assert
      await expect(service.create(superAdminAuthContext, validRequest)).rejects.toThrow(
        expect.objectContaining({
          message: ApiErrorMessage.REQUEST_VALIDATION_FAILED,
          statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
          code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
        }),
      );
    });

    it('should handle database errors gracefully', async () => {
      // Arrange
      const mockDistrict = OrgFactory.build({ id: 'org-1', orgType: 'district' });
      const mockSchool = OrgFactory.build({ id: 'org-2', orgType: 'school' });
      const mockClass = ClassFactory.build({ id: 'class-1' });
      const mockGroup = GroupFactory.build({ id: 'group-1' });
      const mockTaskVariant = TaskVariantFactory.build({ id: 'tv-1' });
      const mockAgreement = AgreementFactory.build({ id: 'agreement-1' });

      const mockAdminRepo = createMockAdministrationRepository();
      const mockUserRepo = createMockUserRepository();
      const mockDistrictRepo = createMockDistrictRepository();
      const mockSchoolRepo = createMockSchoolRepository();
      const mockClassRepo = createMockClassRepository();
      const mockGroupRepo = createMockGroupRepository();
      const mockTaskVariantRepo = createMockTaskVariantRepository();
      const mockAgreementRepo = createMockAgreementRepository();
      mockAdminRepo.existsByName.mockResolvedValue(false);
      mockAdminRepo.createWithAssignments.mockRejectedValue(new Error('Database error'));
      mockDistrictRepo.listByIds.mockResolvedValue({ items: [mockDistrict], totalItems: 1 });
      mockSchoolRepo.listByIds.mockResolvedValue({ items: [mockSchool], totalItems: 1 });
      mockClassRepo.getByIds.mockResolvedValue({ items: [mockClass], totalItems: 1 });
      mockGroupRepo.getByIds.mockResolvedValue({ items: [mockGroup], totalItems: 1 });
      mockTaskVariantRepo.getByIds.mockResolvedValue({ items: [mockTaskVariant], totalItems: 1 });
      mockAgreementRepo.getByIds.mockResolvedValue({ items: [mockAgreement], totalItems: 1 });

      const service = AdministrationService({
        administrationRepository: mockAdminRepo,
        userRepository: mockUserRepo,
        districtRepository: mockDistrictRepo,
        schoolRepository: mockSchoolRepo,
        classRepository: mockClassRepo,
        groupRepository: mockGroupRepo,
        taskVariantRepository: mockTaskVariantRepo,
        agreementRepository: mockAgreementRepo,
      });

      // Act & Assert
      await expect(service.create(superAdminAuthContext, validRequest)).rejects.toThrow(
        expect.objectContaining({
          message: ApiErrorMessage.INTERNAL_SERVER_ERROR,
          statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
          code: ApiErrorCode.DATABASE_QUERY_FAILED,
        }),
      );
    });

    describe('FGA tuple creation', () => {
      it('should write FGA tuples after successful database creation', async () => {
        // Arrange
        const mockCreatedAdmin = AdministrationFactory.build({ id: 'created-admin-id' });
        const mockDistrict = OrgFactory.build({ id: 'org-1', orgType: 'district' });
        const mockSchool = OrgFactory.build({ id: 'org-2', orgType: 'school' });
        const mockClass = ClassFactory.build({ id: 'class-1' });
        const mockGroup = GroupFactory.build({ id: 'group-1' });
        const mockTaskVariant = TaskVariantFactory.build({ id: 'tv-1' });
        const mockAgreement = AgreementFactory.build({ id: 'agreement-1' });

        const mockAdminRepo = createMockAdministrationRepository();
        const mockDistrictRepo = createMockDistrictRepository();
        const mockSchoolRepo = createMockSchoolRepository();
        const mockClassRepo = createMockClassRepository();
        const mockGroupRepo = createMockGroupRepository();
        const mockTaskVariantRepo = createMockTaskVariantRepository();
        const mockAgreementRepo = createMockAgreementRepository();
        const mockAuthService = createMockAuthorizationService();

        mockAdminRepo.existsByName.mockResolvedValue(false);
        mockAdminRepo.createWithAssignments.mockResolvedValue(mockCreatedAdmin);
        mockDistrictRepo.listByIds.mockResolvedValue({ items: [mockDistrict], totalItems: 1 });
        mockSchoolRepo.listByIds.mockResolvedValue({ items: [mockSchool], totalItems: 1 });
        mockClassRepo.getByIds.mockResolvedValue({ items: [mockClass], totalItems: 1 });
        mockGroupRepo.getByIds.mockResolvedValue({ items: [mockGroup], totalItems: 1 });
        mockTaskVariantRepo.getByIds.mockResolvedValue({ items: [mockTaskVariant], totalItems: 1 });
        mockAgreementRepo.getByIds.mockResolvedValue({ items: [mockAgreement], totalItems: 1 });

        const service = AdministrationService({
          administrationRepository: mockAdminRepo,
          userRepository: mockUserRepository,
          districtRepository: mockDistrictRepo,
          schoolRepository: mockSchoolRepo,
          classRepository: mockClassRepo,
          groupRepository: mockGroupRepo,
          taskVariantRepository: mockTaskVariantRepo,
          agreementRepository: mockAgreementRepo,
          authorizationService: mockAuthService,
        });

        // Act
        await service.create(superAdminAuthContext, validRequest);

        // Assert - FGA tuples should be written with correct structure
        expect(mockAuthService.writeTuplesOrThrow).toHaveBeenCalledTimes(1);
        const writtenTuples = mockAuthService.writeTuplesOrThrow.mock.calls[0]![0];

        // Should have 4 tuples: 1 district, 1 school, 1 class, 1 group
        expect(writtenTuples).toHaveLength(4);

        // Verify district tuple
        expect(writtenTuples).toContainEqual({
          user: 'district:org-1',
          relation: 'assigned_district',
          object: 'administration:created-admin-id',
        });

        // Verify school tuple
        expect(writtenTuples).toContainEqual({
          user: 'school:org-2',
          relation: 'assigned_school',
          object: 'administration:created-admin-id',
        });

        // Verify class tuple
        expect(writtenTuples).toContainEqual({
          user: 'class:class-1',
          relation: 'assigned_class',
          object: 'administration:created-admin-id',
        });

        // Verify group tuple
        expect(writtenTuples).toContainEqual({
          user: 'group:group-1',
          relation: 'assigned_group',
          object: 'administration:created-admin-id',
        });
      });

      it('should delete administration when FGA tuple write fails (compensation)', async () => {
        // Arrange
        const mockCreatedAdmin = AdministrationFactory.build({ id: 'created-admin-id' });
        const mockDistrict = OrgFactory.build({ id: 'org-1', orgType: 'district' });
        const mockSchool = OrgFactory.build({ id: 'org-2', orgType: 'school' });
        const mockClass = ClassFactory.build({ id: 'class-1' });
        const mockGroup = GroupFactory.build({ id: 'group-1' });
        const mockTaskVariant = TaskVariantFactory.build({ id: 'tv-1' });
        const mockAgreement = AgreementFactory.build({ id: 'agreement-1' });

        const mockAdminRepo = createMockAdministrationRepository();
        const mockDistrictRepo = createMockDistrictRepository();
        const mockSchoolRepo = createMockSchoolRepository();
        const mockClassRepo = createMockClassRepository();
        const mockGroupRepo = createMockGroupRepository();
        const mockTaskVariantRepo = createMockTaskVariantRepository();
        const mockAgreementRepo = createMockAgreementRepository();
        const mockAuthService = createMockAuthorizationService();

        mockAdminRepo.existsByName.mockResolvedValue(false);
        mockAdminRepo.createWithAssignments.mockResolvedValue(mockCreatedAdmin);
        mockAdminRepo.delete.mockResolvedValue(undefined);
        mockDistrictRepo.listByIds.mockResolvedValue({ items: [mockDistrict], totalItems: 1 });
        mockSchoolRepo.listByIds.mockResolvedValue({ items: [mockSchool], totalItems: 1 });
        mockClassRepo.getByIds.mockResolvedValue({ items: [mockClass], totalItems: 1 });
        mockGroupRepo.getByIds.mockResolvedValue({ items: [mockGroup], totalItems: 1 });
        mockTaskVariantRepo.getByIds.mockResolvedValue({ items: [mockTaskVariant], totalItems: 1 });
        mockAgreementRepo.getByIds.mockResolvedValue({ items: [mockAgreement], totalItems: 1 });

        // FGA write fails
        const fgaError = new ApiError(ApiErrorMessage.EXTERNAL_SERVICE_UNAVAILABLE, {
          statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
          code: ApiErrorCode.EXTERNAL_SERVICE_FAILED,
        });
        mockAuthService.writeTuplesOrThrow.mockRejectedValue(fgaError);

        const service = AdministrationService({
          administrationRepository: mockAdminRepo,
          userRepository: mockUserRepository,
          districtRepository: mockDistrictRepo,
          schoolRepository: mockSchoolRepo,
          classRepository: mockClassRepo,
          groupRepository: mockGroupRepo,
          taskVariantRepository: mockTaskVariantRepo,
          agreementRepository: mockAgreementRepo,
          authorizationService: mockAuthService,
        });

        // Act & Assert
        await expect(service.create(superAdminAuthContext, validRequest)).rejects.toThrow(
          expect.objectContaining({
            message: ApiErrorMessage.EXTERNAL_SERVICE_UNAVAILABLE,
            statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
            code: ApiErrorCode.EXTERNAL_SERVICE_FAILED,
          }),
        );

        // Verify compensation: administration should be deleted
        expect(mockAdminRepo.delete).toHaveBeenCalledWith({ id: 'created-admin-id' });
      });

      it('should still throw FGA error even if compensation delete fails', async () => {
        // Arrange
        const mockCreatedAdmin = AdministrationFactory.build({ id: 'created-admin-id' });
        const mockDistrict = OrgFactory.build({ id: 'org-1', orgType: 'district' });
        const mockSchool = OrgFactory.build({ id: 'org-2', orgType: 'school' });
        const mockClass = ClassFactory.build({ id: 'class-1' });
        const mockGroup = GroupFactory.build({ id: 'group-1' });
        const mockTaskVariant = TaskVariantFactory.build({ id: 'tv-1' });
        const mockAgreement = AgreementFactory.build({ id: 'agreement-1' });

        const mockAdminRepo = createMockAdministrationRepository();
        const mockDistrictRepo = createMockDistrictRepository();
        const mockSchoolRepo = createMockSchoolRepository();
        const mockClassRepo = createMockClassRepository();
        const mockGroupRepo = createMockGroupRepository();
        const mockTaskVariantRepo = createMockTaskVariantRepository();
        const mockAgreementRepo = createMockAgreementRepository();
        const mockAuthService = createMockAuthorizationService();

        mockAdminRepo.existsByName.mockResolvedValue(false);
        mockAdminRepo.createWithAssignments.mockResolvedValue(mockCreatedAdmin);
        // Compensation delete also fails
        mockAdminRepo.delete.mockRejectedValue(new Error('Delete failed'));
        mockDistrictRepo.listByIds.mockResolvedValue({ items: [mockDistrict], totalItems: 1 });
        mockSchoolRepo.listByIds.mockResolvedValue({ items: [mockSchool], totalItems: 1 });
        mockClassRepo.getByIds.mockResolvedValue({ items: [mockClass], totalItems: 1 });
        mockGroupRepo.getByIds.mockResolvedValue({ items: [mockGroup], totalItems: 1 });
        mockTaskVariantRepo.getByIds.mockResolvedValue({ items: [mockTaskVariant], totalItems: 1 });
        mockAgreementRepo.getByIds.mockResolvedValue({ items: [mockAgreement], totalItems: 1 });

        // FGA write fails
        const fgaError = new ApiError(ApiErrorMessage.EXTERNAL_SERVICE_UNAVAILABLE, {
          statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
          code: ApiErrorCode.EXTERNAL_SERVICE_FAILED,
        });
        mockAuthService.writeTuplesOrThrow.mockRejectedValue(fgaError);

        const service = AdministrationService({
          administrationRepository: mockAdminRepo,
          userRepository: mockUserRepository,
          districtRepository: mockDistrictRepo,
          schoolRepository: mockSchoolRepo,
          classRepository: mockClassRepo,
          groupRepository: mockGroupRepo,
          taskVariantRepository: mockTaskVariantRepo,
          agreementRepository: mockAgreementRepo,
          authorizationService: mockAuthService,
        });

        // Act & Assert - should throw the original FGA error, not the delete error
        await expect(service.create(superAdminAuthContext, validRequest)).rejects.toThrow(
          expect.objectContaining({
            message: ApiErrorMessage.EXTERNAL_SERVICE_UNAVAILABLE,
            statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
            code: ApiErrorCode.EXTERNAL_SERVICE_FAILED,
          }),
        );

        // Verify compensation was attempted
        expect(mockAdminRepo.delete).toHaveBeenCalledWith({ id: 'created-admin-id' });
      });

      it('should not write FGA tuples if database creation fails', async () => {
        // Arrange
        const mockDistrict = OrgFactory.build({ id: 'org-1', orgType: 'district' });
        const mockSchool = OrgFactory.build({ id: 'org-2', orgType: 'school' });
        const mockClass = ClassFactory.build({ id: 'class-1' });
        const mockGroup = GroupFactory.build({ id: 'group-1' });
        const mockTaskVariant = TaskVariantFactory.build({ id: 'tv-1' });
        const mockAgreement = AgreementFactory.build({ id: 'agreement-1' });

        const mockAdminRepo = createMockAdministrationRepository();
        const mockDistrictRepo = createMockDistrictRepository();
        const mockSchoolRepo = createMockSchoolRepository();
        const mockClassRepo = createMockClassRepository();
        const mockGroupRepo = createMockGroupRepository();
        const mockTaskVariantRepo = createMockTaskVariantRepository();
        const mockAgreementRepo = createMockAgreementRepository();
        const mockAuthService = createMockAuthorizationService();

        mockAdminRepo.existsByName.mockResolvedValue(false);
        mockAdminRepo.createWithAssignments.mockRejectedValue(new Error('Database error'));
        mockDistrictRepo.listByIds.mockResolvedValue({ items: [mockDistrict], totalItems: 1 });
        mockSchoolRepo.listByIds.mockResolvedValue({ items: [mockSchool], totalItems: 1 });
        mockClassRepo.getByIds.mockResolvedValue({ items: [mockClass], totalItems: 1 });
        mockGroupRepo.getByIds.mockResolvedValue({ items: [mockGroup], totalItems: 1 });
        mockTaskVariantRepo.getByIds.mockResolvedValue({ items: [mockTaskVariant], totalItems: 1 });
        mockAgreementRepo.getByIds.mockResolvedValue({ items: [mockAgreement], totalItems: 1 });

        const service = AdministrationService({
          administrationRepository: mockAdminRepo,
          userRepository: mockUserRepository,
          districtRepository: mockDistrictRepo,
          schoolRepository: mockSchoolRepo,
          classRepository: mockClassRepo,
          groupRepository: mockGroupRepo,
          taskVariantRepository: mockTaskVariantRepo,
          agreementRepository: mockAgreementRepo,
          authorizationService: mockAuthService,
        });

        // Act & Assert
        await expect(service.create(superAdminAuthContext, validRequest)).rejects.toThrow();

        // FGA tuples should NOT be written since DB creation failed
        expect(mockAuthService.writeTuplesOrThrow).not.toHaveBeenCalled();
      });

      it('should handle empty orgs array (only classes and groups)', async () => {
        // Arrange
        const mockCreatedAdmin = AdministrationFactory.build({ id: 'created-admin-id' });
        const mockClass = ClassFactory.build({ id: 'class-1' });
        const mockGroup = GroupFactory.build({ id: 'group-1' });
        const mockTaskVariant = TaskVariantFactory.build({ id: 'tv-1' });
        const mockAgreement = AgreementFactory.build({ id: 'agreement-1' });

        const requestWithNoOrgs = {
          ...validRequest,
          orgs: [],
        };

        const mockAdminRepo = createMockAdministrationRepository();
        const mockDistrictRepo = createMockDistrictRepository();
        const mockSchoolRepo = createMockSchoolRepository();
        const mockClassRepo = createMockClassRepository();
        const mockGroupRepo = createMockGroupRepository();
        const mockTaskVariantRepo = createMockTaskVariantRepository();
        const mockAgreementRepo = createMockAgreementRepository();
        const mockAuthService = createMockAuthorizationService();

        mockAdminRepo.existsByName.mockResolvedValue(false);
        mockAdminRepo.createWithAssignments.mockResolvedValue(mockCreatedAdmin);
        mockClassRepo.getByIds.mockResolvedValue({ items: [mockClass], totalItems: 1 });
        mockGroupRepo.getByIds.mockResolvedValue({ items: [mockGroup], totalItems: 1 });
        mockTaskVariantRepo.getByIds.mockResolvedValue({ items: [mockTaskVariant], totalItems: 1 });
        mockAgreementRepo.getByIds.mockResolvedValue({ items: [mockAgreement], totalItems: 1 });

        const service = AdministrationService({
          administrationRepository: mockAdminRepo,
          userRepository: mockUserRepository,
          districtRepository: mockDistrictRepo,
          schoolRepository: mockSchoolRepo,
          classRepository: mockClassRepo,
          groupRepository: mockGroupRepo,
          taskVariantRepository: mockTaskVariantRepo,
          agreementRepository: mockAgreementRepo,
          authorizationService: mockAuthService,
        });

        // Act
        await service.create(superAdminAuthContext, requestWithNoOrgs);

        // Assert - should only have class and group tuples (no district/school)
        const writtenTuples = mockAuthService.writeTuplesOrThrow.mock.calls[0]![0];
        expect(writtenTuples).toHaveLength(2);
        expect(writtenTuples).toContainEqual({
          user: 'class:class-1',
          relation: 'assigned_class',
          object: 'administration:created-admin-id',
        });
        expect(writtenTuples).toContainEqual({
          user: 'group:group-1',
          relation: 'assigned_group',
          object: 'administration:created-admin-id',
        });
      });
    });
  });

  describe('getUserAdministration', () => {
    it('should only call requirePermission once when user requests their own administration (self-access)', async () => {
      const mockUser = UserFactory.build({ id: 'user-123', isSuperAdmin: false });
      const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });

      mockUserRepository.getById.mockResolvedValue(mockUser);
      mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
      mockAuthorizationService.requirePermission.mockResolvedValue(undefined);

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
        userRepository: mockUserRepository,
        authorizationService: mockAuthorizationService,
      });

      const result = await service.getUserAdministration(
        { userId: 'user-123', isSuperAdmin: false },
        'user-123',
        'admin-123',
      );

      expect(mockUserRepository.getById).toHaveBeenCalledWith({ id: 'user-123' });
      expect(mockAdministrationRepository.getById).toHaveBeenCalledWith({ id: 'admin-123' });
      expect(mockAuthorizationService.requirePermission).toHaveBeenCalledTimes(1);
      expect(mockAuthorizationService.requirePermission).toHaveBeenCalledWith(
        'user-123',
        'can_read',
        'administration:admin-123',
      );
      expect(result).toEqual(mockAdmin);
    });

    it("should return administration when super admin requests another user's administration", async () => {
      const mockUser = UserFactory.build({ id: 'target-user-123' });
      const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });

      mockUserRepository.getById.mockResolvedValue(mockUser);
      mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
        userRepository: mockUserRepository,
        authorizationService: mockAuthorizationService,
      });

      const result = await service.getUserAdministration(
        { userId: 'super-admin', isSuperAdmin: true },
        'target-user-123',
        'admin-123',
      );

      expect(mockUserRepository.getById).toHaveBeenCalledWith({ id: 'target-user-123' });
      expect(mockAdministrationRepository.getById).toHaveBeenCalledWith({ id: 'admin-123' });
      expect(mockAuthorizationService.requirePermission).toHaveBeenCalledTimes(1);
      expect(mockAuthorizationService.requirePermission).toHaveBeenCalledWith(
        'target-user-123',
        'can_read',
        'administration:admin-123',
      );
      expect(result).toEqual(mockAdmin);
    });

    it('should return administration when target user is super admin and non-super admin requester has access', async () => {
      const mockSuperAdminUser = UserFactory.build({ id: 'target-super-admin', isSuperAdmin: true });
      const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });

      mockUserRepository.getById.mockResolvedValue(mockSuperAdminUser);
      mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
      mockAuthorizationService.requirePermission.mockResolvedValue(undefined);

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
        userRepository: mockUserRepository,
        authorizationService: mockAuthorizationService,
      });

      const result = await service.getUserAdministration(
        { userId: 'requester-user-456', isSuperAdmin: false },
        'target-super-admin',
        'admin-123',
      );

      expect(mockUserRepository.getById).toHaveBeenCalledWith({ id: 'target-super-admin' });
      expect(mockAdministrationRepository.getById).toHaveBeenCalledWith({ id: 'admin-123' });
      expect(mockAuthorizationService.requirePermission).toHaveBeenCalledTimes(1);
      expect(mockAuthorizationService.requirePermission).toHaveBeenCalledWith(
        'requester-user-456',
        'can_read',
        'administration:admin-123',
      );
      expect(result).toEqual(mockAdmin);
    });

    it("should return administration when non-super-admin requests another user's administration and has access", async () => {
      const mockUser = UserFactory.build({ id: 'target-user-123' });
      const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });

      mockUserRepository.getById.mockResolvedValue(mockUser);
      mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
      mockAuthorizationService.requirePermission.mockResolvedValue(undefined);

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
        userRepository: mockUserRepository,
        authorizationService: mockAuthorizationService,
      });

      const result = await service.getUserAdministration(
        { userId: 'requester-user-456', isSuperAdmin: false },
        'target-user-123',
        'admin-123',
      );

      expect(mockUserRepository.getById).toHaveBeenCalledWith({ id: 'target-user-123' });
      expect(mockAdministrationRepository.getById).toHaveBeenCalledWith({ id: 'admin-123' });
      expect(mockAuthorizationService.requirePermission).toHaveBeenCalledTimes(2);
      expect(mockAuthorizationService.requirePermission).toHaveBeenCalledWith(
        'target-user-123',
        'can_read',
        'administration:admin-123',
      );
      expect(mockAuthorizationService.requirePermission).toHaveBeenCalledWith(
        'requester-user-456',
        'can_read',
        'administration:admin-123',
      );
      expect(result).toEqual(mockAdmin);
    });

    it('should throw not-found error when target user does not exist', async () => {
      mockUserRepository.getById.mockResolvedValue(null);

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
        userRepository: mockUserRepository,
        authorizationService: mockAuthorizationService,
      });

      await expect(
        service.getUserAdministration(
          { userId: 'requester-user-456', isSuperAdmin: false },
          'non-existent-user',
          'admin-123',
        ),
      ).rejects.toMatchObject({
        statusCode: StatusCodes.NOT_FOUND,
        message: ApiErrorMessage.NOT_FOUND,
        code: ApiErrorCode.RESOURCE_NOT_FOUND,
      });

      expect(mockUserRepository.getById).toHaveBeenCalledWith({ id: 'non-existent-user' });
      expect(mockAdministrationRepository.getById).not.toHaveBeenCalled();
    });

    it('should throw not-found error when administration does not exist', async () => {
      const mockUser = UserFactory.build({ id: 'target-user-123' });

      mockUserRepository.getById.mockResolvedValue(mockUser);
      mockAdministrationRepository.getById.mockResolvedValue(null);

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
        userRepository: mockUserRepository,
        authorizationService: mockAuthorizationService,
      });

      await expect(
        service.getUserAdministration(
          { userId: 'requester-user-456', isSuperAdmin: false },
          'target-user-123',
          'non-existent-admin',
        ),
      ).rejects.toMatchObject({
        statusCode: StatusCodes.NOT_FOUND,
        message: ApiErrorMessage.NOT_FOUND,
        code: ApiErrorCode.RESOURCE_NOT_FOUND,
      });

      expect(mockUserRepository.getById).toHaveBeenCalledWith({ id: 'target-user-123' });
      expect(mockAdministrationRepository.getById).toHaveBeenCalledWith({ id: 'non-existent-admin' });
    });

    it('should throw forbidden error when target user lacks access to administration', async () => {
      const mockUser = UserFactory.build({ id: 'target-user-123' });
      const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });

      mockUserRepository.getById.mockResolvedValue(mockUser);
      mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
      mockAuthorizationService.requirePermission.mockRejectedValue(
        new ApiError(ApiErrorMessage.FORBIDDEN, {
          statusCode: StatusCodes.FORBIDDEN,
          code: ApiErrorCode.AUTH_FORBIDDEN,
          context: { userId: 'target-user-123', relation: 'can_read', object: 'administration:admin-123' },
        }),
      );

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
        userRepository: mockUserRepository,
        authorizationService: mockAuthorizationService,
      });

      await expect(
        service.getUserAdministration(
          { userId: 'requester-user-456', isSuperAdmin: false },
          'target-user-123',
          'admin-123',
        ),
      ).rejects.toMatchObject({
        statusCode: StatusCodes.FORBIDDEN,
        message: ApiErrorMessage.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
      });

      expect(mockUserRepository.getById).toHaveBeenCalledWith({ id: 'target-user-123' });
      expect(mockAdministrationRepository.getById).toHaveBeenCalledWith({ id: 'admin-123' });
      expect(mockAuthorizationService.requirePermission).toHaveBeenCalledWith(
        'target-user-123',
        'can_read',
        'administration:admin-123',
      );
    });

    it('should throw forbidden error when requester lacks access to administration (target user has access)', async () => {
      const mockUser = UserFactory.build({ id: 'target-user-123' });
      const mockAdmin = AdministrationFactory.build({ id: 'admin-123' });

      mockUserRepository.getById.mockResolvedValue(mockUser);
      mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);
      mockAuthorizationService.requirePermission.mockResolvedValueOnce(undefined).mockRejectedValueOnce(
        new ApiError(ApiErrorMessage.FORBIDDEN, {
          statusCode: StatusCodes.FORBIDDEN,
          code: ApiErrorCode.AUTH_FORBIDDEN,
          context: { userId: 'requester-user-456', relation: 'can_read', object: 'administration:admin-123' },
        }),
      );

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
        userRepository: mockUserRepository,
        authorizationService: mockAuthorizationService,
      });

      await expect(
        service.getUserAdministration(
          { userId: 'requester-user-456', isSuperAdmin: false },
          'target-user-123',
          'admin-123',
        ),
      ).rejects.toMatchObject({
        statusCode: StatusCodes.FORBIDDEN,
        message: ApiErrorMessage.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
      });

      expect(mockAuthorizationService.requirePermission).toHaveBeenCalledTimes(2);
      expect(mockAuthorizationService.requirePermission).toHaveBeenCalledWith(
        'target-user-123',
        'can_read',
        'administration:admin-123',
      );
      expect(mockAuthorizationService.requirePermission).toHaveBeenCalledWith(
        'requester-user-456',
        'can_read',
        'administration:admin-123',
      );
    });

    it('should throw internal error when database query fails', async () => {
      const mockUser = UserFactory.build({ id: 'target-user-123' });

      mockUserRepository.getById.mockResolvedValue(mockUser);
      mockAdministrationRepository.getById.mockRejectedValue(new Error('Database connection lost'));

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
        userRepository: mockUserRepository,
        authorizationService: mockAuthorizationService,
      });

      await expect(
        service.getUserAdministration(
          { userId: 'requester-user-456', isSuperAdmin: false },
          'target-user-123',
          'admin-123',
        ),
      ).rejects.toMatchObject({
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        message: ApiErrorMessage.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
      });
    });
  });

  describe('update', () => {
    const superAdminAuthContext = { userId: 'super-admin-123', isSuperAdmin: true };
    const regularUserAuthContext = { userId: 'user-123', isSuperAdmin: false };
    const testAdminId = 'admin-123';

    const existingAdmin = AdministrationFactory.build({
      id: testAdminId,
      name: 'Original Name',
      namePublic: 'Original Public Name',
      description: 'Original description',
      dateStart: new Date('2024-01-01'),
      dateEnd: new Date('2024-12-31'),
      isOrdered: false,
    });

    const validUpdateRequest = {
      name: 'Updated Name',
      description: 'Updated description',
    };

    it('should throw forbidden error when non-super admin attempts to update', async () => {
      // Must return existing admin first (404 before 403 pattern)
      mockAdministrationRepository.getById.mockResolvedValue(existingAdmin);

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
      });

      await expect(service.update(regularUserAuthContext, testAdminId, validUpdateRequest)).rejects.toMatchObject({
        statusCode: StatusCodes.FORBIDDEN,
        message: ApiErrorMessage.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
      });

      expect(mockAdministrationRepository.updateWithAssignments).not.toHaveBeenCalled();
    });

    it('should throw not found error when administration does not exist (super admin)', async () => {
      mockAdministrationRepository.getById.mockResolvedValue(null);

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
      });

      await expect(service.update(superAdminAuthContext, 'non-existent-id', validUpdateRequest)).rejects.toMatchObject({
        statusCode: StatusCodes.NOT_FOUND,
        message: ApiErrorMessage.NOT_FOUND,
        code: ApiErrorCode.RESOURCE_NOT_FOUND,
      });
    });

    it('should throw not found error when administration does not exist (non-super admin, 404 before 403)', async () => {
      mockAdministrationRepository.getById.mockResolvedValue(null);

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
      });

      // Even for non-super-admin, 404 should be returned before 403
      await expect(service.update(regularUserAuthContext, 'non-existent-id', validUpdateRequest)).rejects.toMatchObject(
        {
          statusCode: StatusCodes.NOT_FOUND,
          message: ApiErrorMessage.NOT_FOUND,
          code: ApiErrorCode.RESOURCE_NOT_FOUND,
        },
      );
    });

    it('should update administration successfully with valid data', async () => {
      mockAdministrationRepository.getById.mockResolvedValue(existingAdmin);
      mockAdministrationRepository.existsByNameExcludingId.mockResolvedValue(false);
      mockAdministrationRepository.getAssignees.mockResolvedValue({
        districts: [{ id: 'district-1', name: 'District 1' }],
        schools: [],
        classes: [],
        groups: [],
      });
      mockAdministrationRepository.updateWithAssignments.mockResolvedValue({ id: testAdminId });

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
        authorizationService: mockAuthorizationService,
      });

      const result = await service.update(superAdminAuthContext, testAdminId, validUpdateRequest);

      expect(result).toEqual({ id: testAdminId });
      expect(mockAdministrationRepository.updateWithAssignments).toHaveBeenCalledWith(
        testAdminId,
        expect.objectContaining({
          administration: expect.objectContaining({
            name: 'Updated Name',
            description: 'Updated description',
          }),
        }),
      );
    });

    it('should throw conflict error when name already exists', async () => {
      mockAdministrationRepository.getById.mockResolvedValue(existingAdmin);
      mockAdministrationRepository.existsByNameExcludingId.mockResolvedValue(true);
      mockAdministrationRepository.getAssignees.mockResolvedValue({
        districts: [{ id: 'district-1', name: 'District 1' }],
        schools: [],
        classes: [],
        groups: [],
      });

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
      });

      await expect(
        service.update(superAdminAuthContext, testAdminId, { name: 'Duplicate Name' }),
      ).rejects.toMatchObject({
        statusCode: StatusCodes.CONFLICT,
        message: ApiErrorMessage.CONFLICT,
        code: ApiErrorCode.RESOURCE_CONFLICT,
      });
    });

    it('should throw validation error when dateEnd is before dateStart', async () => {
      mockAdministrationRepository.getById.mockResolvedValue(existingAdmin);
      mockAdministrationRepository.getAssignees.mockResolvedValue({
        districts: [{ id: 'district-1', name: 'District 1' }],
        schools: [],
        classes: [],
        groups: [],
      });

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
      });

      await expect(
        service.update(superAdminAuthContext, testAdminId, {
          dateStart: '2024-12-31T00:00:00Z',
          dateEnd: '2024-01-01T00:00:00Z',
        }),
      ).rejects.toMatchObject({
        statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
        code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
      });
    });

    it('should throw validation error when new dateEnd is before existing dateStart', async () => {
      mockAdministrationRepository.getById.mockResolvedValue(existingAdmin);
      mockAdministrationRepository.getAssignees.mockResolvedValue({
        districts: [{ id: 'district-1', name: 'District 1' }],
        schools: [],
        classes: [],
        groups: [],
      });

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
      });

      await expect(
        service.update(superAdminAuthContext, testAdminId, {
          dateEnd: '2023-01-01T00:00:00Z',
        }),
      ).rejects.toMatchObject({
        statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
        code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
      });
    });

    it('should throw validation error when orderIndex values are not unique for ordered administration', async () => {
      const orderedAdmin = AdministrationFactory.build({
        ...existingAdmin,
        isOrdered: true,
      });
      mockAdministrationRepository.getById.mockResolvedValue(orderedAdmin);
      mockAdministrationRepository.getAssignees.mockResolvedValue({
        districts: [{ id: 'district-1', name: 'District 1' }],
        schools: [],
        classes: [],
        groups: [],
      });

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
      });

      await expect(
        service.update(superAdminAuthContext, testAdminId, {
          taskVariants: [
            { taskVariantId: 'tv-1', orderIndex: 0 },
            { taskVariantId: 'tv-2', orderIndex: 0 },
          ],
        }),
      ).rejects.toMatchObject({
        statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
        code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
      });
    });

    it('should throw validation error when taskVariants contain duplicate taskVariantIds', async () => {
      mockAdministrationRepository.getById.mockResolvedValue(existingAdmin);

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
      });

      await expect(
        service.update(superAdminAuthContext, testAdminId, {
          taskVariants: [
            { taskVariantId: 'tv-1', orderIndex: 0 },
            { taskVariantId: 'tv-1', orderIndex: 1 },
          ],
        }),
      ).rejects.toMatchObject({
        statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
        code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
      });
    });

    it('should throw validation error when setting isOrdered=true and existing task variants have duplicate orderIndex', async () => {
      // Existing admin is not ordered
      mockAdministrationRepository.getById.mockResolvedValue(existingAdmin);
      // Existing task variants have duplicate orderIndex values
      // Only assignment.orderIndex is accessed by the service
      mockAdministrationRepository.getTaskVariantsByAdministrationId.mockResolvedValue({
        items: [{ assignment: { orderIndex: 0 } }, { assignment: { orderIndex: 0 } }] as never,
        totalItems: 2,
      });

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
      });

      // Setting isOrdered=true without providing taskVariants should validate existing task variants
      await expect(
        service.update(superAdminAuthContext, testAdminId, {
          isOrdered: true,
        }),
      ).rejects.toMatchObject({
        statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
        code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
      });
    });

    it('should allow setting isOrdered=true when existing task variants have unique orderIndex', async () => {
      mockAdministrationRepository.getById.mockResolvedValue(existingAdmin);
      // Only assignment.orderIndex is accessed by the service
      mockAdministrationRepository.getTaskVariantsByAdministrationId.mockResolvedValue({
        items: [{ assignment: { orderIndex: 0 } }, { assignment: { orderIndex: 1 } }] as never,
        totalItems: 2,
      });
      mockAdministrationRepository.getAssignees.mockResolvedValue({
        districts: [{ id: 'district-1', name: 'District 1' }],
        schools: [],
        classes: [],
        groups: [],
      });
      mockAdministrationRepository.existsByNameExcludingId.mockResolvedValue(false);
      mockAdministrationRepository.updateWithAssignments.mockResolvedValue({ id: testAdminId });

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
        authorizationService: mockAuthorizationService,
      });

      const result = await service.update(superAdminAuthContext, testAdminId, {
        isOrdered: true,
      });

      expect(result).toEqual({ id: testAdminId });
      expect(mockAdministrationRepository.getTaskVariantsByAdministrationId).toHaveBeenCalledWith(testAdminId, false, {
        page: 1,
        perPage: 1000,
      });
    });

    it('should skip existing task variant validation when taskVariants are provided in request', async () => {
      const orderedAdmin = AdministrationFactory.build({
        ...existingAdmin,
        isOrdered: true,
      });
      mockAdministrationRepository.getById.mockResolvedValue(orderedAdmin);
      mockAdministrationRepository.getAssignees.mockResolvedValue({
        districts: [{ id: 'district-1', name: 'District 1' }],
        schools: [],
        classes: [],
        groups: [],
      });
      mockAdministrationRepository.existsByNameExcludingId.mockResolvedValue(false);
      mockAdministrationRepository.updateWithAssignments.mockResolvedValue({ id: testAdminId });

      const mockTaskVariantRepo = createMockTaskVariantRepository();
      const publishedVariant1 = TaskVariantFactory.build({ id: 'tv-1', status: TaskVariantStatus.PUBLISHED });
      const publishedVariant2 = TaskVariantFactory.build({ id: 'tv-2', status: TaskVariantStatus.PUBLISHED });
      mockTaskVariantRepo.getByIds.mockResolvedValue({ items: [publishedVariant1, publishedVariant2], totalItems: 2 });

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
        taskVariantRepository: mockTaskVariantRepo,
        authorizationService: mockAuthorizationService,
      });

      // Providing taskVariants in request should use those for validation, not fetch existing
      const result = await service.update(superAdminAuthContext, testAdminId, {
        taskVariants: [
          { taskVariantId: 'tv-1', orderIndex: 0 },
          { taskVariantId: 'tv-2', orderIndex: 1 },
        ],
      });

      expect(result).toEqual({ id: testAdminId });
      // Should NOT call getTaskVariantsByAdministrationId when taskVariants are provided
      expect(mockAdministrationRepository.getTaskVariantsByAdministrationId).not.toHaveBeenCalled();
    });

    it('should throw validation error when no orgs, classes, or groups remain after update', async () => {
      mockAdministrationRepository.getById.mockResolvedValue(existingAdmin);
      mockAdministrationRepository.getAssignees.mockResolvedValue({
        districts: [{ id: 'district-1', name: 'District 1' }],
        schools: [],
        classes: [],
        groups: [],
      });

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
      });

      await expect(
        service.update(superAdminAuthContext, testAdminId, {
          orgs: [],
          classes: [],
          groups: [],
        }),
      ).rejects.toMatchObject({
        statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
        code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
      });
    });

    it('should throw validation error when task variants array is empty', async () => {
      mockAdministrationRepository.getById.mockResolvedValue(existingAdmin);
      mockAdministrationRepository.getAssignees.mockResolvedValue({
        districts: [{ id: 'district-1', name: 'District 1' }],
        schools: [],
        classes: [],
        groups: [],
      });

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
      });

      await expect(
        service.update(superAdminAuthContext, testAdminId, {
          taskVariants: [],
        }),
      ).rejects.toMatchObject({
        statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
        code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
      });
    });

    it('should throw validation error when referenced org does not exist', async () => {
      mockAdministrationRepository.getById.mockResolvedValue(existingAdmin);
      mockAdministrationRepository.getAssignees.mockResolvedValue({
        districts: [{ id: 'district-1', name: 'District 1' }],
        schools: [],
        classes: [],
        groups: [],
      });

      const mockDistrictRepo = createMockDistrictRepository();
      const mockSchoolRepo = createMockSchoolRepository();
      mockDistrictRepo.listByIds.mockResolvedValue({ items: [], totalItems: 0 });
      mockSchoolRepo.listByIds.mockResolvedValue({ items: [], totalItems: 0 });

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
        districtRepository: mockDistrictRepo,
        schoolRepository: mockSchoolRepo,
      });

      await expect(
        service.update(superAdminAuthContext, testAdminId, {
          orgs: ['non-existent-org'],
        }),
      ).rejects.toMatchObject({
        statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
        code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
      });
    });

    it('should throw validation error when referenced task variant does not exist', async () => {
      mockAdministrationRepository.getById.mockResolvedValue(existingAdmin);
      mockAdministrationRepository.getAssignees.mockResolvedValue({
        districts: [{ id: 'district-1', name: 'District 1' }],
        schools: [],
        classes: [],
        groups: [],
      });

      const mockTaskVariantRepo = createMockTaskVariantRepository();
      mockTaskVariantRepo.getByIds.mockResolvedValue({ items: [], totalItems: 0 });

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
        taskVariantRepository: mockTaskVariantRepo,
      });

      await expect(
        service.update(superAdminAuthContext, testAdminId, {
          taskVariants: [{ taskVariantId: 'non-existent-tv', orderIndex: 0 }],
        }),
      ).rejects.toMatchObject({
        statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
        code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
      });
    });

    it('should throw validation error when task variant is not published', async () => {
      mockAdministrationRepository.getById.mockResolvedValue(existingAdmin);
      mockAdministrationRepository.getAssignees.mockResolvedValue({
        districts: [{ id: 'district-1', name: 'District 1' }],
        schools: [],
        classes: [],
        groups: [],
      });

      const unpublishedVariant = TaskVariantFactory.build({
        id: 'tv-1',
        status: TaskVariantStatus.DRAFT,
      });
      const mockTaskVariantRepo = createMockTaskVariantRepository();
      mockTaskVariantRepo.getByIds.mockResolvedValue({ items: [unpublishedVariant], totalItems: 1 });

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
        taskVariantRepository: mockTaskVariantRepo,
      });

      await expect(
        service.update(superAdminAuthContext, testAdminId, {
          taskVariants: [{ taskVariantId: 'tv-1', orderIndex: 0 }],
        }),
      ).rejects.toMatchObject({
        statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
        code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
      });
    });

    describe('partial updates', () => {
      it('should update only name when only name is provided', async () => {
        mockAdministrationRepository.getById.mockResolvedValue(existingAdmin);
        mockAdministrationRepository.existsByNameExcludingId.mockResolvedValue(false);
        mockAdministrationRepository.getAssignees.mockResolvedValue({
          districts: [{ id: 'district-1', name: 'District 1' }],
          schools: [],
          classes: [],
          groups: [],
        });
        mockAdministrationRepository.updateWithAssignments.mockResolvedValue({ id: testAdminId });

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          authorizationService: mockAuthorizationService,
        });

        await service.update(superAdminAuthContext, testAdminId, { name: 'New Name Only' });

        expect(mockAdministrationRepository.updateWithAssignments).toHaveBeenCalledWith(
          testAdminId,
          expect.objectContaining({
            administration: expect.objectContaining({
              name: 'New Name Only',
            }),
          }),
        );
        // Should not include other fields that weren't provided
        const callArgs = mockAdministrationRepository.updateWithAssignments.mock.calls[0]?.[1];
        expect(callArgs?.administration?.description).toBeUndefined();
        expect(callArgs?.administration?.namePublic).toBeUndefined();
      });

      it('should update only description when only description is provided', async () => {
        mockAdministrationRepository.getById.mockResolvedValue(existingAdmin);
        mockAdministrationRepository.getAssignees.mockResolvedValue({
          districts: [{ id: 'district-1', name: 'District 1' }],
          schools: [],
          classes: [],
          groups: [],
        });
        mockAdministrationRepository.updateWithAssignments.mockResolvedValue({ id: testAdminId });

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          authorizationService: mockAuthorizationService,
        });

        await service.update(superAdminAuthContext, testAdminId, { description: 'New description only' });

        expect(mockAdministrationRepository.updateWithAssignments).toHaveBeenCalledWith(
          testAdminId,
          expect.objectContaining({
            administration: expect.objectContaining({
              description: 'New description only',
            }),
          }),
        );
        // Should not check name uniqueness when name is not being updated
        expect(mockAdministrationRepository.existsByNameExcludingId).not.toHaveBeenCalled();
      });

      it('should update only dates when only dateStart and dateEnd are provided', async () => {
        mockAdministrationRepository.getById.mockResolvedValue(existingAdmin);
        mockAdministrationRepository.getAssignees.mockResolvedValue({
          districts: [{ id: 'district-1', name: 'District 1' }],
          schools: [],
          classes: [],
          groups: [],
        });
        mockAdministrationRepository.updateWithAssignments.mockResolvedValue({ id: testAdminId });

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          authorizationService: mockAuthorizationService,
        });

        await service.update(superAdminAuthContext, testAdminId, {
          dateStart: '2025-01-01T00:00:00Z',
          dateEnd: '2025-12-31T00:00:00Z',
        });

        expect(mockAdministrationRepository.updateWithAssignments).toHaveBeenCalledWith(
          testAdminId,
          expect.objectContaining({
            administration: expect.objectContaining({
              dateStart: new Date('2025-01-01T00:00:00Z'),
              dateEnd: new Date('2025-12-31T00:00:00Z'),
            }),
          }),
        );
      });

      it('should update only isOrdered when only isOrdered is provided', async () => {
        mockAdministrationRepository.getById.mockResolvedValue(existingAdmin);
        mockAdministrationRepository.getTaskVariantsByAdministrationId.mockResolvedValue({
          items: [{ assignment: { orderIndex: 0 } }, { assignment: { orderIndex: 1 } }] as never,
          totalItems: 2,
        });
        mockAdministrationRepository.getAssignees.mockResolvedValue({
          districts: [{ id: 'district-1', name: 'District 1' }],
          schools: [],
          classes: [],
          groups: [],
        });
        mockAdministrationRepository.updateWithAssignments.mockResolvedValue({ id: testAdminId });

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          authorizationService: mockAuthorizationService,
        });

        await service.update(superAdminAuthContext, testAdminId, { isOrdered: true });

        expect(mockAdministrationRepository.updateWithAssignments).toHaveBeenCalledWith(
          testAdminId,
          expect.objectContaining({
            administration: expect.objectContaining({
              isOrdered: true,
            }),
          }),
        );
      });

      it('should preserve existing entity assignments when not provided in request', async () => {
        mockAdministrationRepository.getById.mockResolvedValue(existingAdmin);
        mockAdministrationRepository.existsByNameExcludingId.mockResolvedValue(false);
        mockAdministrationRepository.getAssignees.mockResolvedValue({
          districts: [{ id: 'district-1', name: 'District 1' }],
          schools: [{ id: 'school-1', name: 'School 1', parentOrgId: 'district-1' }],
          classes: [{ id: 'class-1', name: 'Class 1', schoolId: 'school-1', districtId: 'district-1' }],
          groups: [{ id: 'group-1', name: 'Group 1' }],
        });
        mockAdministrationRepository.updateWithAssignments.mockResolvedValue({ id: testAdminId });

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          authorizationService: mockAuthorizationService,
        });

        // Only update name, should not touch entity assignments
        await service.update(superAdminAuthContext, testAdminId, { name: 'Updated Name' });

        const callArgs = mockAdministrationRepository.updateWithAssignments.mock.calls[0]?.[1];
        // Entity arrays should be undefined (not updated) when not provided
        expect(callArgs?.orgIds).toBeUndefined();
        expect(callArgs?.classIds).toBeUndefined();
        expect(callArgs?.groupIds).toBeUndefined();
      });

      it('should validate dateEnd against existing dateStart when only dateEnd is provided', async () => {
        // existingAdmin has dateStart: 2024-01-01
        mockAdministrationRepository.getById.mockResolvedValue(existingAdmin);

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
        });

        // Try to set dateEnd before existing dateStart
        await expect(
          service.update(superAdminAuthContext, testAdminId, {
            dateEnd: '2023-06-01T00:00:00Z',
          }),
        ).rejects.toMatchObject({
          statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
          code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
        });
      });

      it('should validate dateStart against existing dateEnd when only dateStart is provided', async () => {
        // existingAdmin has dateEnd: 2024-12-31
        mockAdministrationRepository.getById.mockResolvedValue(existingAdmin);

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
        });

        // Try to set dateStart after existing dateEnd
        await expect(
          service.update(superAdminAuthContext, testAdminId, {
            dateStart: '2025-06-01T00:00:00Z',
          }),
        ).rejects.toMatchObject({
          statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
          code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
        });
      });

      it('should allow updating multiple fields at once', async () => {
        mockAdministrationRepository.getById.mockResolvedValue(existingAdmin);
        mockAdministrationRepository.existsByNameExcludingId.mockResolvedValue(false);
        mockAdministrationRepository.getAssignees.mockResolvedValue({
          districts: [{ id: 'district-1', name: 'District 1' }],
          schools: [],
          classes: [],
          groups: [],
        });
        mockAdministrationRepository.updateWithAssignments.mockResolvedValue({ id: testAdminId });

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          authorizationService: mockAuthorizationService,
        });

        await service.update(superAdminAuthContext, testAdminId, {
          name: 'Updated Name',
          description: 'Updated description',
          namePublic: 'Updated Public Name',
        });

        expect(mockAdministrationRepository.updateWithAssignments).toHaveBeenCalledWith(
          testAdminId,
          expect.objectContaining({
            administration: expect.objectContaining({
              name: 'Updated Name',
              description: 'Updated description',
              namePublic: 'Updated Public Name',
            }),
          }),
        );
      });
    });

    describe('FGA tuple management', () => {
      it('should add FGA tuples when new orgs are assigned', async () => {
        mockAdministrationRepository.getById.mockResolvedValue(existingAdmin);
        mockAdministrationRepository.existsByNameExcludingId.mockResolvedValue(false);
        mockAdministrationRepository.getAssignees.mockResolvedValue({
          districts: [{ id: 'district-1', name: 'District 1' }],
          schools: [],
          classes: [],
          groups: [],
        });
        mockAdministrationRepository.updateWithAssignments.mockResolvedValue({ id: testAdminId });

        const mockDistrictRepo = createMockDistrictRepository();
        const mockSchoolRepo = createMockSchoolRepository();
        const existingDistrict = OrgFactory.build({ id: 'district-1', orgType: 'district' });
        const newDistrict = OrgFactory.build({ id: 'district-2', orgType: 'district' });
        mockDistrictRepo.listByIds.mockResolvedValue({ items: [existingDistrict, newDistrict], totalItems: 2 });
        mockSchoolRepo.listByIds.mockResolvedValue({ items: [], totalItems: 0 });

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          districtRepository: mockDistrictRepo,
          schoolRepository: mockSchoolRepo,
          authorizationService: mockAuthorizationService,
        });

        await service.update(superAdminAuthContext, testAdminId, {
          orgs: ['district-1', 'district-2'],
        });

        expect(mockAuthorizationService.writeTuplesOrThrow).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              user: 'district:district-2',
              relation: 'assigned_district',
              object: `administration:${testAdminId}`,
            }),
          ]),
        );
      });

      it('should remove FGA tuples when orgs are unassigned', async () => {
        mockAdministrationRepository.getById.mockResolvedValue(existingAdmin);
        mockAdministrationRepository.existsByNameExcludingId.mockResolvedValue(false);
        mockAdministrationRepository.getAssignees.mockResolvedValue({
          districts: [
            { id: 'district-1', name: 'District 1' },
            { id: 'district-2', name: 'District 2' },
          ],
          schools: [],
          classes: [],
          groups: [],
        });
        mockAdministrationRepository.updateWithAssignments.mockResolvedValue({ id: testAdminId });

        const mockDistrictRepo = createMockDistrictRepository();
        const mockSchoolRepo = createMockSchoolRepository();
        const district1 = OrgFactory.build({ id: 'district-1', orgType: 'district' });
        mockDistrictRepo.listByIds.mockResolvedValue({ items: [district1], totalItems: 1 });
        mockSchoolRepo.listByIds.mockResolvedValue({ items: [], totalItems: 0 });

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          districtRepository: mockDistrictRepo,
          schoolRepository: mockSchoolRepo,
          authorizationService: mockAuthorizationService,
        });

        await service.update(superAdminAuthContext, testAdminId, {
          orgs: ['district-1'],
        });

        expect(mockAuthorizationService.deleteTuples).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              user: 'district:district-2',
              relation: 'assigned_district',
              object: `administration:${testAdminId}`,
            }),
          ]),
        );
      });

      it('should compensate FGA changes when database update fails', async () => {
        mockAdministrationRepository.getById.mockResolvedValue(existingAdmin);
        mockAdministrationRepository.existsByNameExcludingId.mockResolvedValue(false);
        mockAdministrationRepository.getAssignees.mockResolvedValue({
          districts: [{ id: 'district-1', name: 'District 1' }],
          schools: [],
          classes: [],
          groups: [],
        });
        mockAdministrationRepository.updateWithAssignments.mockRejectedValue(new Error('Database error'));

        const mockDistrictRepo = createMockDistrictRepository();
        const mockSchoolRepo = createMockSchoolRepository();
        const existingDistrict = OrgFactory.build({ id: 'district-1', orgType: 'district' });
        const newDistrict = OrgFactory.build({ id: 'district-2', orgType: 'district' });
        mockDistrictRepo.listByIds.mockResolvedValue({ items: [existingDistrict, newDistrict], totalItems: 2 });
        mockSchoolRepo.listByIds.mockResolvedValue({ items: [], totalItems: 0 });

        const service = AdministrationService({
          administrationRepository: mockAdministrationRepository,
          districtRepository: mockDistrictRepo,
          schoolRepository: mockSchoolRepo,
          authorizationService: mockAuthorizationService,
        });

        await expect(
          service.update(superAdminAuthContext, testAdminId, {
            orgs: ['district-1', 'district-2'],
          }),
        ).rejects.toThrow();

        expect(mockAuthorizationService.writeTuplesOrThrow).toHaveBeenCalled();

        expect(mockAuthorizationService.deleteTuples).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              user: 'district:district-2',
              relation: 'assigned_district',
              object: `administration:${testAdminId}`,
            }),
          ]),
        );
      });
    });
  });
});
