import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StatusCodes } from 'http-status-codes';
import type { TaskVariantsListQuery } from '@roar-dashboard/api-contract';
import { ApiError } from '../errors/api-error';
import { ApiErrorCode } from '../enums/api-error-code.enum';
import { TaskVariantParameterFactory } from '../test-support/factories/task-variant-parameter.factory';
import { buildTaskVariantWithDetails } from '../test-support/factories/task-variant.factory';
import type { MockTaskVariantService } from '../test-support/services/task-variant.service';
import type { AuthContext } from '../types/auth-context';

vi.mock('../services/task-variant/task-variant.service', () => ({
  TaskVariantService: vi.fn(),
}));

import { TaskVariantService } from '../services/task-variant/task-variant.service';

describe('TaskVariantsController', () => {
  const superAdminContext: AuthContext = { userId: 'super-admin-1', isSuperAdmin: true };

  // Module-level vi.fn() so the controller (cached after first import) always
  // references the same function — matching the pattern in tasks.controller.test.ts.
  const mockListAllPublished = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(TaskVariantService).mockReturnValue({
      listAllPublished: mockListAllPublished,
    } as MockTaskVariantService);
  });

  describe('list', () => {
    const baseQuery: TaskVariantsListQuery = {
      page: 1,
      perPage: 25,
      sortBy: 'variant.name',
      sortOrder: 'asc',
      embed: [],
      filter: [],
    };

    it('returns 200 with paginated items on success', async () => {
      const variant = buildTaskVariantWithDetails();
      mockListAllPublished.mockResolvedValue({ items: [variant], totalItems: 1 });

      const { TaskVariantsController } = await import('./task-variants.controller');
      const result = await TaskVariantsController.list(superAdminContext, baseQuery);

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
      const variant = buildTaskVariantWithDetails({ createdAt, updatedAt });
      mockListAllPublished.mockResolvedValue({ items: [variant], totalItems: 1 });

      const { TaskVariantsController } = await import('./task-variants.controller');
      const result = await TaskVariantsController.list(superAdminContext, baseQuery);

      expect(result.status).toBe(StatusCodes.OK);
      if (result.status === StatusCodes.OK) {
        expect(result.body.data.items[0]!.createdAt).toBe('2024-01-01T00:00:00.000Z');
        expect(result.body.data.items[0]!.updatedAt).toBe('2024-01-02T00:00:00.000Z');
      }
    });

    it('returns null for updatedAt when the variant has no updatedAt', async () => {
      const variant = buildTaskVariantWithDetails({ updatedAt: null });
      mockListAllPublished.mockResolvedValue({ items: [variant], totalItems: 1 });

      const { TaskVariantsController } = await import('./task-variants.controller');
      const result = await TaskVariantsController.list(superAdminContext, baseQuery);

      expect(result.status).toBe(StatusCodes.OK);
      if (result.status === StatusCodes.OK) {
        expect(result.body.data.items[0]!.updatedAt).toBeNull();
      }
    });

    it('passes parameters through when embed includes parameters', async () => {
      const variant = buildTaskVariantWithDetails();
      const param = TaskVariantParameterFactory.build({ taskVariantId: variant.id, name: 'difficulty', value: 'easy' });
      mockListAllPublished.mockResolvedValue({
        items: [{ ...variant, parameters: [{ name: param.name, value: param.value }] }],
        totalItems: 1,
      });

      const { TaskVariantsController } = await import('./task-variants.controller');
      const result = await TaskVariantsController.list(superAdminContext, {
        ...baseQuery,
        embed: ['parameters'],
      });

      expect(result.status).toBe(StatusCodes.OK);
      if (result.status === StatusCodes.OK) {
        expect(result.body.data.items[0]!.parameters).toEqual([{ name: 'difficulty', value: 'easy' }]);
      }
    });

    it('does not include parameters key when embed is not requested', async () => {
      const variant = buildTaskVariantWithDetails();
      mockListAllPublished.mockResolvedValue({ items: [variant], totalItems: 1 });

      const { TaskVariantsController } = await import('./task-variants.controller');
      const result = await TaskVariantsController.list(superAdminContext, baseQuery);

      expect(result.status).toBe(StatusCodes.OK);
      if (result.status === StatusCodes.OK) {
        expect('parameters' in result.body.data.items[0]!).toBe(false);
      }
    });

    it('maps query filter to service filters', async () => {
      mockListAllPublished.mockResolvedValue({ items: [], totalItems: 0 });

      const filter = [{ field: 'task.id', operator: 'eq' as const, value: 'task-abc' }];

      const { TaskVariantsController } = await import('./task-variants.controller');
      await TaskVariantsController.list(superAdminContext, { ...baseQuery, filter });

      expect(mockListAllPublished).toHaveBeenCalledWith(
        superAdminContext,
        expect.objectContaining({ filters: filter }),
      );
    });

    it('passes search to service when provided', async () => {
      mockListAllPublished.mockResolvedValue({ items: [], totalItems: 0 });

      const { TaskVariantsController } = await import('./task-variants.controller');
      await TaskVariantsController.list(superAdminContext, { ...baseQuery, search: 'Awareness' });

      expect(mockListAllPublished).toHaveBeenCalledWith(
        superAdminContext,
        expect.objectContaining({ search: 'Awareness' }),
      );
    });

    it('omits search from service options when not provided', async () => {
      mockListAllPublished.mockResolvedValue({ items: [], totalItems: 0 });

      const { TaskVariantsController } = await import('./task-variants.controller');
      await TaskVariantsController.list(superAdminContext, baseQuery);

      const callArg = mockListAllPublished.mock.calls[0]![1]!;
      expect('search' in callArg).toBe(false);
    });

    it('returns 403 when the service throws a FORBIDDEN ApiError', async () => {
      mockListAllPublished.mockRejectedValue(
        new ApiError('Forbidden', {
          statusCode: StatusCodes.FORBIDDEN,
          code: ApiErrorCode.AUTH_FORBIDDEN,
        }),
      );

      const { TaskVariantsController } = await import('./task-variants.controller');
      const result = await TaskVariantsController.list(superAdminContext, baseQuery);

      expect(result.status).toBe(StatusCodes.FORBIDDEN);
    });

    it('returns 500 when the service throws an INTERNAL_SERVER_ERROR ApiError', async () => {
      mockListAllPublished.mockRejectedValue(
        new ApiError('Internal error', {
          statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
          code: ApiErrorCode.DATABASE_QUERY_FAILED,
        }),
      );

      const { TaskVariantsController } = await import('./task-variants.controller');
      const result = await TaskVariantsController.list(superAdminContext, baseQuery);

      expect(result.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
    });

    it('re-throws unknown errors', async () => {
      const unknown = new Error('Unexpected failure');
      mockListAllPublished.mockRejectedValue(unknown);

      const { TaskVariantsController } = await import('./task-variants.controller');
      await expect(TaskVariantsController.list(superAdminContext, baseQuery)).rejects.toBe(unknown);
    });
  });
});
