import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StatusCodes } from 'http-status-codes';
import {
  AdministrationFactory,
  AdministrationWithEmbedsFactory,
} from '../test-support/factories/administration.factory';

// Mock the AdministrationService module
vi.mock('../services/administration/administration.service', () => ({
  AdministrationService: vi.fn(),
}));

import { AdministrationService } from '../services/administration/administration.service';

describe('AdministrationsController', () => {
  const mockList = vi.fn();
  const mockAuthContext = { userId: 'user-123', isSuperAdmin: false };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup the mock service
    vi.mocked(AdministrationService).mockReturnValue({
      list: mockList,
    });
  });

  describe('list', () => {
    it('should return paginated administrations with 200 status', async () => {
      const mockAdmins = [AdministrationFactory.build(), AdministrationFactory.build()];
      mockList.mockResolvedValue({
        items: mockAdmins,
        totalItems: 2,
      });

      // Re-import to pick up the mock
      const { AdministrationsController: Controller } = await import('./administrations.controller');

      const result = await Controller.list(mockAuthContext, {
        page: 1,
        perPage: 25,
        sortBy: 'createdAt',
        sortOrder: 'desc',
        embed: [],
      });

      expect(result.status).toBe(StatusCodes.OK);
      expect(result.body.data.items).toHaveLength(2);
      expect(result.body.data.pagination).toEqual({
        page: 1,
        perPage: 25,
        totalItems: 2,
        totalPages: 1,
      });
    });

    it('should transform administration fields to API response format', async () => {
      const mockAdmin = AdministrationFactory.build({
        id: 'admin-uuid-123',
        name: 'Internal Name',
        namePublic: 'Public Name',
        dateStart: new Date('2024-01-01T00:00:00Z'),
        dateEnd: new Date('2024-12-31T23:59:59Z'),
        createdAt: new Date('2023-06-15T10:30:00Z'),
        isOrdered: true,
      });
      mockList.mockResolvedValue({
        items: [mockAdmin],
        totalItems: 1,
      });

      const { AdministrationsController: Controller } = await import('./administrations.controller');

      const result = await Controller.list(mockAuthContext, {
        page: 1,
        perPage: 25,
        sortBy: 'createdAt',
        sortOrder: 'desc',
        embed: [],
      });

      const item = result.body.data.items[0]!;
      expect(item.id).toBe('admin-uuid-123');
      expect(item.name).toBe('Internal Name');
      expect(item.publicName).toBe('Public Name');
      expect(item.dates.start).toBe('2024-01-01T00:00:00.000Z');
      expect(item.dates.end).toBe('2024-12-31T23:59:59.000Z');
      expect(item.dates.created).toBe('2023-06-15T10:30:00.000Z');
      expect(item.isOrdered).toBe(true);
    });

    it('should calculate totalPages correctly', async () => {
      mockList.mockResolvedValue({
        items: AdministrationFactory.buildList(10),
        totalItems: 95,
      });

      const { AdministrationsController: Controller } = await import('./administrations.controller');

      const result = await Controller.list(mockAuthContext, {
        page: 1,
        perPage: 10,
        sortBy: 'createdAt',
        sortOrder: 'desc',
        embed: [],
      });

      expect(result.body.data.pagination.totalPages).toBe(10); // ceil(95/10) = 10
    });

    it('should pass auth context and query parameters to service', async () => {
      mockList.mockResolvedValue({ items: [], totalItems: 0 });

      const { AdministrationsController: Controller } = await import('./administrations.controller');

      const authContext = { userId: 'user-456', isSuperAdmin: true };
      await Controller.list(authContext, {
        page: 3,
        perPage: 50,
        sortBy: 'dateStart',
        sortOrder: 'asc',
        embed: [],
      });

      expect(mockList).toHaveBeenCalledWith(authContext, {
        page: 3,
        perPage: 50,
        sortBy: 'dateStart',
        sortOrder: 'asc',
        embed: [],
      });
    });

    it('should return empty items array when no administrations found', async () => {
      mockList.mockResolvedValue({ items: [], totalItems: 0 });

      const { AdministrationsController: Controller } = await import('./administrations.controller');

      const result = await Controller.list(mockAuthContext, {
        page: 1,
        perPage: 25,
        sortBy: 'createdAt',
        sortOrder: 'desc',
        embed: [],
      });

      expect(result.body.data.items).toEqual([]);
      expect(result.body.data.pagination.totalItems).toBe(0);
      expect(result.body.data.pagination.totalPages).toBe(0);
    });

    it('should include stats in response when embed=stats is requested', async () => {
      const mockAdmin = AdministrationWithEmbedsFactory.build({
        id: 'admin-1',
        name: 'Test Admin',
        stats: { assigned: 25, started: 10, completed: 5 },
      });
      mockList.mockResolvedValue({
        items: [mockAdmin],
        totalItems: 1,
      });

      const { AdministrationsController: Controller } = await import('./administrations.controller');

      const result = await Controller.list(mockAuthContext, {
        page: 1,
        perPage: 25,
        sortBy: 'createdAt',
        sortOrder: 'desc',
        embed: ['stats'],
      });

      expect(mockList).toHaveBeenCalledWith(mockAuthContext, {
        page: 1,
        perPage: 25,
        sortBy: 'createdAt',
        sortOrder: 'desc',
        embed: ['stats'],
      });
      expect(result.body.data.items[0]!.stats).toEqual({
        assigned: 25,
        started: 10,
        completed: 5,
      });
    });

    it('should not include stats in response when not embedded', async () => {
      const mockAdmin = AdministrationFactory.build({
        id: 'admin-1',
        name: 'Test Admin',
        // No stats property
      });
      mockList.mockResolvedValue({
        items: [mockAdmin],
        totalItems: 1,
      });

      const { AdministrationsController: Controller } = await import('./administrations.controller');

      const result = await Controller.list(mockAuthContext, {
        page: 1,
        perPage: 25,
        sortBy: 'createdAt',
        sortOrder: 'desc',
        embed: [],
      });

      expect(result.body.data.items[0]).not.toHaveProperty('stats');
    });

    it('should include tasks in response when embed=tasks is requested', async () => {
      const mockAdmin = AdministrationWithEmbedsFactory.build({
        id: 'admin-1',
        name: 'Test Admin',
        tasks: [
          { taskId: 'task-1', taskName: 'SWR', variantId: 'variant-1', variantName: 'Variant A', orderIndex: 0 },
          { taskId: 'task-2', taskName: 'PA', variantId: 'variant-2', variantName: null, orderIndex: 1 },
        ],
      });
      mockList.mockResolvedValue({
        items: [mockAdmin],
        totalItems: 1,
      });

      const { AdministrationsController: Controller } = await import('./administrations.controller');

      const result = await Controller.list(mockAuthContext, {
        page: 1,
        perPage: 25,
        sortBy: 'createdAt',
        sortOrder: 'desc',
        embed: ['tasks'],
      });

      expect(mockList).toHaveBeenCalledWith(mockAuthContext, {
        page: 1,
        perPage: 25,
        sortBy: 'createdAt',
        sortOrder: 'desc',
        embed: ['tasks'],
      });
      expect(result.body.data.items[0]!.tasks).toEqual([
        { taskId: 'task-1', taskName: 'SWR', variantId: 'variant-1', variantName: 'Variant A', orderIndex: 0 },
        { taskId: 'task-2', taskName: 'PA', variantId: 'variant-2', variantName: null, orderIndex: 1 },
      ]);
    });
  });
});
