import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StatusCodes } from 'http-status-codes';
import type { TaskBundleListQuery } from '@roar-dashboard/api-contract';
import { ApiError } from '../errors/api-error';
import { ApiErrorCode } from '../enums/api-error-code.enum';
import { TaskBundleFactory, buildTaskBundleVariantWithDetails } from '../test-support/factories/task-bundle.factory';
import type { MockTaskBundleService } from '../test-support/services/task-bundle.service';
import type { AuthContext } from '../types/auth-context';

vi.mock('../services/task-bundle/task-bundle.service', () => ({
  TaskBundleService: vi.fn(),
}));

import { TaskBundleService } from '../services/task-bundle/task-bundle.service';

describe('TaskBundlesController', () => {
  const superAdminContext: AuthContext = { userId: 'super-admin-1', isSuperAdmin: true };

  // Module-level vi.fn() so the controller (cached after first import) always
  // references the same function — matching the pattern in task-variants.controller.test.ts.
  const mockList = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(TaskBundleService).mockReturnValue({
      list: mockList,
    } as MockTaskBundleService);
  });

  describe('list', () => {
    const baseQuery: TaskBundleListQuery = {
      page: 1,
      perPage: 25,
      sortBy: 'name',
      sortOrder: 'asc',
      embed: [],
      filter: [],
    };

    it('returns 200 with paginated items on success', async () => {
      const bundle = TaskBundleFactory.build();
      const variant = buildTaskBundleVariantWithDetails({ taskBundleId: bundle.id });
      mockList.mockResolvedValue({
        items: [{ ...bundle, taskVariants: [variant] }],
        totalItems: 1,
      });

      const { TaskBundlesController } = await import('./task-bundles.controller');
      const result = await TaskBundlesController.list(superAdminContext, baseQuery);

      expect(result.status).toBe(StatusCodes.OK);
      if (result.status === StatusCodes.OK) {
        expect(result.body.data.items).toHaveLength(1);
        expect(result.body.data.pagination).toEqual({
          page: 1,
          perPage: 25,
          totalItems: 1,
          totalPages: 1,
        });
      }
    });

    it('converts Date fields to ISO strings', async () => {
      const createdAt = new Date('2024-01-01T00:00:00Z');
      const updatedAt = new Date('2024-01-02T00:00:00Z');
      const bundle = TaskBundleFactory.build({ createdAt, updatedAt });
      const variant = buildTaskBundleVariantWithDetails({ taskBundleId: bundle.id });
      mockList.mockResolvedValue({
        items: [{ ...bundle, taskVariants: [variant] }],
        totalItems: 1,
      });

      const { TaskBundlesController } = await import('./task-bundles.controller');
      const result = await TaskBundlesController.list(superAdminContext, baseQuery);

      expect(result.status).toBe(StatusCodes.OK);
      if (result.status === StatusCodes.OK) {
        expect(result.body.data.items[0]!.createdAt).toBe('2024-01-01T00:00:00.000Z');
        expect(result.body.data.items[0]!.updatedAt).toBe('2024-01-02T00:00:00.000Z');
      }
    });

    it('returns null for updatedAt when the bundle has no updatedAt', async () => {
      const bundle = TaskBundleFactory.build({ updatedAt: null });
      const variant = buildTaskBundleVariantWithDetails({ taskBundleId: bundle.id });
      mockList.mockResolvedValue({
        items: [{ ...bundle, taskVariants: [variant] }],
        totalItems: 1,
      });

      const { TaskBundlesController } = await import('./task-bundles.controller');
      const result = await TaskBundlesController.list(superAdminContext, baseQuery);

      expect(result.status).toBe(StatusCodes.OK);
      if (result.status === StatusCodes.OK) {
        expect(result.body.data.items[0]!.updatedAt).toBeNull();
      }
    });

    it('converts variant Date fields to ISO strings', async () => {
      const bundle = TaskBundleFactory.build();
      const variantCreatedAt = new Date('2024-03-01T00:00:00Z');
      const variantUpdatedAt = new Date('2024-03-02T00:00:00Z');
      const variant = buildTaskBundleVariantWithDetails({
        taskBundleId: bundle.id,
        createdAt: variantCreatedAt,
        updatedAt: variantUpdatedAt,
      });
      mockList.mockResolvedValue({
        items: [{ ...bundle, taskVariants: [variant] }],
        totalItems: 1,
      });

      const { TaskBundlesController } = await import('./task-bundles.controller');
      const result = await TaskBundlesController.list(superAdminContext, {
        ...baseQuery,
        embed: ['taskVariantDetails'],
      });

      expect(result.status).toBe(StatusCodes.OK);
      if (result.status === StatusCodes.OK) {
        expect(result.body.data.items[0]!.taskVariants[0]!.createdAt).toBe('2024-03-01T00:00:00.000Z');
        expect(result.body.data.items[0]!.taskVariants[0]!.updatedAt).toBe('2024-03-02T00:00:00.000Z');
      }
    });

    it('returns null for variant updatedAt when not present', async () => {
      const bundle = TaskBundleFactory.build();
      const variant = buildTaskBundleVariantWithDetails({ taskBundleId: bundle.id, updatedAt: null });
      mockList.mockResolvedValue({
        items: [{ ...bundle, taskVariants: [variant] }],
        totalItems: 1,
      });

      const { TaskBundlesController } = await import('./task-bundles.controller');
      const result = await TaskBundlesController.list(superAdminContext, {
        ...baseQuery,
        embed: ['taskVariantDetails'],
      });

      expect(result.status).toBe(StatusCodes.OK);
      if (result.status === StatusCodes.OK) {
        expect(result.body.data.items[0]!.taskVariants[0]!.updatedAt).toBeNull();
      }
    });

    it('includes embed fields when taskVariantDetails is requested', async () => {
      const bundle = TaskBundleFactory.build();
      const variant = buildTaskBundleVariantWithDetails({
        taskBundleId: bundle.id,
        taskId: 'task-123',
        taskImage: 'https://example.com/image.png',
        description: 'Task variant description',
        status: 'published',
        parameters: [{ name: 'difficulty', value: 'easy' }],
      });
      mockList.mockResolvedValue({
        items: [{ ...bundle, taskVariants: [variant] }],
        totalItems: 1,
      });

      const { TaskBundlesController } = await import('./task-bundles.controller');
      const result = await TaskBundlesController.list(superAdminContext, {
        ...baseQuery,
        embed: ['taskVariantDetails'],
      });

      expect(result.status).toBe(StatusCodes.OK);
      if (result.status === StatusCodes.OK) {
        const returnedVariant = result.body.data.items[0]!.taskVariants[0]!;
        expect(returnedVariant.taskId).toBe('task-123');
        expect(returnedVariant.taskImage).toBe('https://example.com/image.png');
        expect(returnedVariant.description).toBe('Task variant description');
        expect(returnedVariant.status).toBe('published');
        expect(returnedVariant.parameters).toEqual([{ name: 'difficulty', value: 'easy' }]);
      }
    });

    it('does not include embed fields when taskVariantDetails is not requested', async () => {
      const bundle = TaskBundleFactory.build();
      // Service returns variants without embed fields when not requested
      const variantWithoutEmbeds = {
        taskBundleId: bundle.id,
        taskVariantId: 'variant-123',
        taskSlug: 'some-task',
        taskName: 'Task Name',
        taskVariantName: 'Variant Name',
        sortOrder: 0,
        // Embed fields are intentionally undefined (not returned by service)
      };
      mockList.mockResolvedValue({
        items: [{ ...bundle, taskVariants: [variantWithoutEmbeds] }],
        totalItems: 1,
      });

      const { TaskBundlesController } = await import('./task-bundles.controller');
      const result = await TaskBundlesController.list(superAdminContext, baseQuery);

      expect(result.status).toBe(StatusCodes.OK);
      if (result.status === StatusCodes.OK) {
        const returnedVariant = result.body.data.items[0]!.taskVariants[0]!;
        expect('taskId' in returnedVariant).toBe(false);
        expect('taskImage' in returnedVariant).toBe(false);
        expect('description' in returnedVariant).toBe(false);
        expect('status' in returnedVariant).toBe(false);
        expect('parameters' in returnedVariant).toBe(false);
      }
    });

    it('maps query filter to service filters', async () => {
      mockList.mockResolvedValue({ items: [], totalItems: 0 });

      const filter = [{ field: 'taskBundle.slug', operator: 'eq' as const, value: 'bundle-abc' }];

      const { TaskBundlesController } = await import('./task-bundles.controller');
      await TaskBundlesController.list(superAdminContext, { ...baseQuery, filter });

      expect(mockList).toHaveBeenCalledWith(superAdminContext, expect.objectContaining({ filters: filter }));
    });

    it('passes search to service when provided', async () => {
      mockList.mockResolvedValue({ items: [], totalItems: 0 });

      const { TaskBundlesController } = await import('./task-bundles.controller');
      await TaskBundlesController.list(superAdminContext, { ...baseQuery, search: 'Reading' });

      expect(mockList).toHaveBeenCalledWith(superAdminContext, expect.objectContaining({ search: 'Reading' }));
    });

    it('omits search from service options when not provided', async () => {
      mockList.mockResolvedValue({ items: [], totalItems: 0 });

      const { TaskBundlesController } = await import('./task-bundles.controller');
      await TaskBundlesController.list(superAdminContext, baseQuery);

      const callArg = mockList.mock.calls[0]![1]!;
      expect('search' in callArg).toBe(false);
    });

    it('returns 400 when the service throws a BAD_REQUEST ApiError', async () => {
      mockList.mockRejectedValue(
        new ApiError('Invalid parameters', {
          statusCode: StatusCodes.BAD_REQUEST,
          code: ApiErrorCode.INVALID_FILTER_EXPRESSION,
        }),
      );

      const { TaskBundlesController } = await import('./task-bundles.controller');
      const result = await TaskBundlesController.list(superAdminContext, baseQuery);

      expect(result.status).toBe(StatusCodes.BAD_REQUEST);
    });

    it('returns 403 when the service throws a FORBIDDEN ApiError', async () => {
      mockList.mockRejectedValue(
        new ApiError('Forbidden', {
          statusCode: StatusCodes.FORBIDDEN,
          code: ApiErrorCode.AUTH_FORBIDDEN,
        }),
      );

      const { TaskBundlesController } = await import('./task-bundles.controller');
      const result = await TaskBundlesController.list(superAdminContext, baseQuery);

      expect(result.status).toBe(StatusCodes.FORBIDDEN);
    });

    it('returns 500 when the service throws an INTERNAL_SERVER_ERROR ApiError', async () => {
      mockList.mockRejectedValue(
        new ApiError('Internal error', {
          statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
          code: ApiErrorCode.DATABASE_QUERY_FAILED,
        }),
      );

      const { TaskBundlesController } = await import('./task-bundles.controller');
      const result = await TaskBundlesController.list(superAdminContext, baseQuery);

      expect(result.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
    });

    it('re-throws unknown errors', async () => {
      const unknown = new Error('Unexpected failure');
      mockList.mockRejectedValue(unknown);

      const { TaskBundlesController } = await import('./task-bundles.controller');
      await expect(TaskBundlesController.list(superAdminContext, baseQuery)).rejects.toBe(unknown);
    });
  });
});
