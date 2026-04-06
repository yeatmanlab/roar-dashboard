import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StatusCodes } from 'http-status-codes';
import { ApiError } from '../../errors/api-error';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { createMockTaskVariantRepository } from '../../test-support/repositories/task-variant.repository';
import { createMockTaskVariantParameterRepository } from '../../test-support/repositories/task-variant-parameter.repository';
import type { MockTaskVariantRepository } from '../../test-support/repositories/task-variant.repository';
import type { MockTaskVariantParameterRepository } from '../../test-support/repositories/task-variant-parameter.repository';
import { TaskVariantParameterFactory } from '../../test-support/factories/task-variant-parameter.factory';
import { buildTaskVariantWithDetails } from '../../test-support/factories/task-variant.factory';
import { TaskVariantService, TaskVariantSortField } from './task-veriant.service';
import type { AuthContext } from '../../types/auth-context';
describe('TaskVariantService', () => {
  let mockTaskVariantRepository: MockTaskVariantRepository;
  let mockTaskVariantParameterRepository: MockTaskVariantParameterRepository;
  let service: ReturnType<typeof TaskVariantService>;

  const superAdminContext: AuthContext = { userId: 'super-admin-1', isSuperAdmin: true };
  const regularUserContext: AuthContext = { userId: 'user-1', isSuperAdmin: false };

  const defaultOptions = {
    page: 1,
    perPage: 25,
    sortBy: TaskVariantSortField.VARIANT_NAME,
    sortOrder: 'asc' as const,
    filters: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockTaskVariantRepository = createMockTaskVariantRepository();
    mockTaskVariantParameterRepository = createMockTaskVariantParameterRepository();
    service = TaskVariantService({
      taskVariantRepository: mockTaskVariantRepository,
      taskVariantParameterRepository: mockTaskVariantParameterRepository,
    });
  });

  describe('listAllPublished', () => {
    describe('authorization', () => {
      it('throws 403 when caller is not a super admin', async () => {
        await expect(service.listAllPublished(regularUserContext, defaultOptions)).rejects.toMatchObject({
          statusCode: StatusCodes.FORBIDDEN,
          code: ApiErrorCode.AUTH_FORBIDDEN,
        });
      });

      it('does not call the repository when authorization fails', async () => {
        await expect(service.listAllPublished(regularUserContext, defaultOptions)).rejects.toBeInstanceOf(ApiError);

        expect(mockTaskVariantRepository.listAllPublished).not.toHaveBeenCalled();
        expect(mockTaskVariantParameterRepository.getByTaskVariantIds).not.toHaveBeenCalled();
      });
    });

    describe('result handling', () => {
      it('returns the paginated result from the repository', async () => {
        const variant = buildTaskVariantWithDetails();
        mockTaskVariantRepository.listAllPublished.mockResolvedValue({ items: [variant], totalItems: 1 });

        const result = await service.listAllPublished(superAdminContext, defaultOptions);

        expect(result.items).toHaveLength(1);
        expect(result.totalItems).toBe(1);
        expect(result.items[0]!.id).toBe(variant.id);
      });

      it('returns empty items early when totalItems is 0', async () => {
        mockTaskVariantRepository.listAllPublished.mockResolvedValue({ items: [], totalItems: 0 });

        const result = await service.listAllPublished(superAdminContext, defaultOptions);

        expect(result.items).toEqual([]);
        expect(result.totalItems).toBe(0);
        expect(mockTaskVariantParameterRepository.getByTaskVariantIds).not.toHaveBeenCalled();
      });

      it('passes options through to the repository correctly', async () => {
        mockTaskVariantRepository.listAllPublished.mockResolvedValue({ items: [], totalItems: 0 });

        const options = {
          page: 2,
          perPage: 10,
          sortBy: TaskVariantSortField.TASK_NAME,
          sortOrder: 'desc' as const,
          search: 'reading',
          filters: [{ field: 'task.id', operator: 'eq' as const, value: 'task-abc' }],
        };

        await service.listAllPublished(superAdminContext, options);

        expect(mockTaskVariantRepository.listAllPublished).toHaveBeenCalledWith(
          expect.objectContaining({
            page: 2,
            perPage: 10,
            sortBy: TaskVariantSortField.TASK_NAME,
            sortOrder: 'desc',
            search: 'reading',
          }),
        );
      });

      it('omits search from repo options when search is undefined', async () => {
        mockTaskVariantRepository.listAllPublished.mockResolvedValue({ items: [], totalItems: 0 });

        await service.listAllPublished(superAdminContext, defaultOptions);

        const callArg = mockTaskVariantRepository.listAllPublished.mock.calls[0]![0]!;
        expect('search' in callArg).toBe(false);
      });
    });

    describe('embed: parameters', () => {
      it('does not call parameter repository when embed is empty', async () => {
        const variant = buildTaskVariantWithDetails();
        mockTaskVariantRepository.listAllPublished.mockResolvedValue({ items: [variant], totalItems: 1 });

        await service.listAllPublished(superAdminContext, { ...defaultOptions, embed: [] });

        expect(mockTaskVariantParameterRepository.getByTaskVariantIds).not.toHaveBeenCalled();
      });

      it('fetches parameters in bulk and attaches them when embed includes parameters', async () => {
        const variant1 = buildTaskVariantWithDetails();
        const variant2 = buildTaskVariantWithDetails();
        mockTaskVariantRepository.listAllPublished.mockResolvedValue({
          items: [variant1, variant2],
          totalItems: 2,
        });

        const param1 = TaskVariantParameterFactory.build({
          taskVariantId: variant1.id,
          name: 'difficulty',
          value: 'easy',
        });
        const param2 = TaskVariantParameterFactory.build({
          taskVariantId: variant2.id,
          name: 'difficulty',
          value: 'hard',
        });
        const param3 = TaskVariantParameterFactory.build({ taskVariantId: variant2.id, name: 'timeLimit', value: 30 });
        mockTaskVariantParameterRepository.getByTaskVariantIds.mockResolvedValue([param1, param2, param3]);

        const result = await service.listAllPublished(superAdminContext, {
          ...defaultOptions,
          embed: ['parameters'],
        });

        expect(mockTaskVariantParameterRepository.getByTaskVariantIds).toHaveBeenCalledExactlyOnceWith([
          variant1.id,
          variant2.id,
        ]);

        expect(result.items[0]!.parameters).toEqual([{ name: 'difficulty', value: 'easy' }]);
        expect(result.items[1]!.parameters).toEqual([
          { name: 'difficulty', value: 'hard' },
          { name: 'timeLimit', value: 30 },
        ]);
      });

      it('attaches empty parameters array for variants with no parameters', async () => {
        const variant = buildTaskVariantWithDetails();
        mockTaskVariantRepository.listAllPublished.mockResolvedValue({ items: [variant], totalItems: 1 });
        mockTaskVariantParameterRepository.getByTaskVariantIds.mockResolvedValue([]);

        const result = await service.listAllPublished(superAdminContext, {
          ...defaultOptions,
          embed: ['parameters'],
        });

        expect(result.items[0]!.parameters).toEqual([]);
      });
    });

    describe('error handling', () => {
      it('re-throws ApiError from the repository', async () => {
        const apiError = new ApiError('Not found', {
          statusCode: StatusCodes.NOT_FOUND,
          code: ApiErrorCode.RESOURCE_NOT_FOUND,
        });
        mockTaskVariantRepository.listAllPublished.mockRejectedValue(apiError);

        await expect(service.listAllPublished(superAdminContext, defaultOptions)).rejects.toBe(apiError);
      });

      it('wraps unexpected repository errors in a DATABASE_QUERY_FAILED ApiError', async () => {
        mockTaskVariantRepository.listAllPublished.mockRejectedValue(new Error('DB connection lost'));

        await expect(service.listAllPublished(superAdminContext, defaultOptions)).rejects.toMatchObject({
          statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
          code: ApiErrorCode.DATABASE_QUERY_FAILED,
        });
      });

      it('wraps parameter repository errors in a DATABASE_QUERY_FAILED ApiError', async () => {
        const variant = buildTaskVariantWithDetails();
        mockTaskVariantRepository.listAllPublished.mockResolvedValue({ items: [variant], totalItems: 1 });
        mockTaskVariantParameterRepository.getByTaskVariantIds.mockRejectedValue(new Error('Timeout'));

        await expect(
          service.listAllPublished(superAdminContext, { ...defaultOptions, embed: ['parameters'] }),
        ).rejects.toMatchObject({
          statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
          code: ApiErrorCode.DATABASE_QUERY_FAILED,
        });
      });
    });
  });
});
