import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StatusCodes } from 'http-status-codes';
import { ApiError } from '../../errors/api-error';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { createMockTaskBundleRepository } from '../../test-support/repositories/task-bundle.repository';
import { createMockTaskBundleVariantRepository } from '../../test-support/repositories/task-bundle-variant.repository';
import { createMockTaskVariantParameterRepository } from '../../test-support/repositories/task-variant-parameter.repository';
import type { MockTaskBundleRepository } from '../../test-support/repositories/task-bundle.repository';
import type { MockTaskBundleVariantRepository } from '../../test-support/repositories/task-bundle-variant.repository';
import type { MockTaskVariantParameterRepository } from '../../test-support/repositories/task-variant-parameter.repository';
import { TaskBundleFactory, buildTaskBundleVariantWithDetails } from '../../test-support/factories/task-bundle.factory';
import { TaskVariantParameterFactory } from '../../test-support/factories/task-variant-parameter.factory';
import { TaskBundleService, TaskBundleSortField } from './task-bundle.service';
import type { AuthContext } from '../../types/auth-context';

describe('TaskBundleService', () => {
  let mockTaskBundleRepository: MockTaskBundleRepository;
  let mockTaskBundleVariantRepository: MockTaskBundleVariantRepository;
  let mockTaskVariantParameterRepository: MockTaskVariantParameterRepository;
  let service: ReturnType<typeof TaskBundleService>;

  const superAdminContext: AuthContext = { userId: 'super-admin-1', isSuperAdmin: true };
  const regularUserContext: AuthContext = { userId: 'user-1', isSuperAdmin: false };

  const defaultOptions = {
    page: 1,
    perPage: 25,
    sortBy: TaskBundleSortField.NAME,
    sortOrder: 'asc' as const,
    filters: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockTaskBundleRepository = createMockTaskBundleRepository();
    mockTaskBundleVariantRepository = createMockTaskBundleVariantRepository();
    mockTaskVariantParameterRepository = createMockTaskVariantParameterRepository();
    service = TaskBundleService({
      taskBundleRepository: mockTaskBundleRepository,
      taskBundleVariantRepository: mockTaskBundleVariantRepository,
      taskVariantParameterRepository: mockTaskVariantParameterRepository,
    });
  });

  describe('list', () => {
    describe('authorization', () => {
      it('throws 403 when caller is not a super admin', async () => {
        await expect(service.list(regularUserContext, defaultOptions)).rejects.toMatchObject({
          statusCode: StatusCodes.FORBIDDEN,
          code: ApiErrorCode.AUTH_FORBIDDEN,
        });
      });

      it('does not call any repository when authorization fails', async () => {
        await expect(service.list(regularUserContext, defaultOptions)).rejects.toBeInstanceOf(ApiError);

        expect(mockTaskBundleRepository.listAll).not.toHaveBeenCalled();
        expect(mockTaskBundleVariantRepository.getVariantsWithTaskDetailsByBundleIds).not.toHaveBeenCalled();
        expect(mockTaskVariantParameterRepository.getByTaskVariantIds).not.toHaveBeenCalled();
      });
    });

    describe('result handling', () => {
      it('returns empty items early when totalItems is 0', async () => {
        mockTaskBundleRepository.listAll.mockResolvedValue({ items: [], totalItems: 0 });

        const result = await service.list(superAdminContext, defaultOptions);

        expect(result.items).toEqual([]);
        expect(result.totalItems).toBe(0);
        expect(mockTaskBundleVariantRepository.getVariantsWithTaskDetailsByBundleIds).not.toHaveBeenCalled();
        expect(mockTaskVariantParameterRepository.getByTaskVariantIds).not.toHaveBeenCalled();
      });

      it('returns bundles with their variant lists', async () => {
        const bundle = TaskBundleFactory.build();
        const variant = buildTaskBundleVariantWithDetails({ taskBundleId: bundle.id });
        mockTaskBundleRepository.listAll.mockResolvedValue({ items: [bundle], totalItems: 1 });
        mockTaskBundleVariantRepository.getVariantsWithTaskDetailsByBundleIds.mockResolvedValue([variant]);

        const result = await service.list(superAdminContext, defaultOptions);

        expect(result.totalItems).toBe(1);
        expect(result.items).toHaveLength(1);
        expect(result.items[0]!.id).toBe(bundle.id);
        expect(result.items[0]!.taskVariants).toHaveLength(1);
        expect(result.items[0]!.taskVariants[0]!.taskVariantId).toBe(variant.taskVariantId);
      });

      it('assigns empty variants array to bundles with no matching variants', async () => {
        const bundle = TaskBundleFactory.build();
        mockTaskBundleRepository.listAll.mockResolvedValue({ items: [bundle], totalItems: 1 });
        // No variants returned for this bundle
        mockTaskBundleVariantRepository.getVariantsWithTaskDetailsByBundleIds.mockResolvedValue([]);

        const result = await service.list(superAdminContext, defaultOptions);

        expect(result.items[0]!.taskVariants).toEqual([]);
      });

      it('passes pagination and sort options through to the repository', async () => {
        mockTaskBundleRepository.listAll.mockResolvedValue({ items: [], totalItems: 0 });

        const options = {
          page: 2,
          perPage: 10,
          sortBy: TaskBundleSortField.SLUG,
          sortOrder: 'desc' as const,
          search: 'phonics',
          filters: [{ field: 'taskBundle.slug', operator: 'eq' as const, value: 'grade-3' }],
        };

        await service.list(superAdminContext, options);

        expect(mockTaskBundleRepository.listAll).toHaveBeenCalledWith(
          expect.objectContaining({
            page: 2,
            perPage: 10,
            sortBy: TaskBundleSortField.SLUG,
            sortOrder: 'desc',
            search: 'phonics',
          }),
        );
      });

      it('omits search from repo options when search is undefined', async () => {
        mockTaskBundleRepository.listAll.mockResolvedValue({ items: [], totalItems: 0 });

        await service.list(superAdminContext, defaultOptions);

        const callArg = mockTaskBundleRepository.listAll.mock.calls[0]![0]!;
        expect('search' in callArg).toBe(false);
      });

      it('fetches variants with bundle IDs from the returned page', async () => {
        const bundle1 = TaskBundleFactory.build();
        const bundle2 = TaskBundleFactory.build();
        mockTaskBundleRepository.listAll.mockResolvedValue({ items: [bundle1, bundle2], totalItems: 2 });
        mockTaskBundleVariantRepository.getVariantsWithTaskDetailsByBundleIds.mockResolvedValue([]);

        await service.list(superAdminContext, defaultOptions);

        expect(mockTaskBundleVariantRepository.getVariantsWithTaskDetailsByBundleIds).toHaveBeenCalledExactlyOnceWith([
          bundle1.id,
          bundle2.id,
        ]);
      });
    });

    describe('embed: taskVariantDetails', () => {
      it('does not call parameter repository when embed is empty', async () => {
        const bundle = TaskBundleFactory.build();
        const variant = buildTaskBundleVariantWithDetails({ taskBundleId: bundle.id });
        mockTaskBundleRepository.listAll.mockResolvedValue({ items: [bundle], totalItems: 1 });
        mockTaskBundleVariantRepository.getVariantsWithTaskDetailsByBundleIds.mockResolvedValue([variant]);

        await service.list(superAdminContext, { ...defaultOptions, embed: [] });

        expect(mockTaskVariantParameterRepository.getByTaskVariantIds).not.toHaveBeenCalled();
      });

      it('fetches parameters in bulk and attaches them when embed includes taskVariantDetails', async () => {
        const bundle = TaskBundleFactory.build();
        const variant1 = buildTaskBundleVariantWithDetails({ taskBundleId: bundle.id, sortOrder: 0 });
        const variant2 = buildTaskBundleVariantWithDetails({ taskBundleId: bundle.id, sortOrder: 1 });
        mockTaskBundleRepository.listAll.mockResolvedValue({ items: [bundle], totalItems: 1 });
        mockTaskBundleVariantRepository.getVariantsWithTaskDetailsByBundleIds.mockResolvedValue([variant1, variant2]);

        const param1 = TaskVariantParameterFactory.build({
          taskVariantId: variant1.taskVariantId,
          name: 'difficulty',
          value: 'easy',
        });
        const param2 = TaskVariantParameterFactory.build({
          taskVariantId: variant2.taskVariantId,
          name: 'timeLimit',
          value: 60,
        });
        mockTaskVariantParameterRepository.getByTaskVariantIds.mockResolvedValue([param1, param2]);

        const result = await service.list(superAdminContext, {
          ...defaultOptions,
          embed: ['taskVariantDetails'],
        });

        expect(mockTaskVariantParameterRepository.getByTaskVariantIds).toHaveBeenCalledExactlyOnceWith([
          variant1.taskVariantId,
          variant2.taskVariantId,
        ]);

        expect(result.items[0]!.taskVariants[0]!.parameters).toEqual([{ name: 'difficulty', value: 'easy' }]);
        expect(result.items[0]!.taskVariants[1]!.parameters).toEqual([{ name: 'timeLimit', value: 60 }]);
      });

      it('attaches empty parameters array for variants with no parameters', async () => {
        const bundle = TaskBundleFactory.build();
        const variant = buildTaskBundleVariantWithDetails({ taskBundleId: bundle.id });
        mockTaskBundleRepository.listAll.mockResolvedValue({ items: [bundle], totalItems: 1 });
        mockTaskBundleVariantRepository.getVariantsWithTaskDetailsByBundleIds.mockResolvedValue([variant]);
        mockTaskVariantParameterRepository.getByTaskVariantIds.mockResolvedValue([]);

        const result = await service.list(superAdminContext, {
          ...defaultOptions,
          embed: ['taskVariantDetails'],
        });

        expect(result.items[0]!.taskVariants[0]!.parameters).toEqual([]);
      });

      it('correctly distributes parameters across multiple bundles', async () => {
        const bundle1 = TaskBundleFactory.build();
        const bundle2 = TaskBundleFactory.build();
        const variant1 = buildTaskBundleVariantWithDetails({ taskBundleId: bundle1.id });
        const variant2 = buildTaskBundleVariantWithDetails({ taskBundleId: bundle2.id });
        mockTaskBundleRepository.listAll.mockResolvedValue({ items: [bundle1, bundle2], totalItems: 2 });
        mockTaskBundleVariantRepository.getVariantsWithTaskDetailsByBundleIds.mockResolvedValue([variant1, variant2]);

        const param = TaskVariantParameterFactory.build({
          taskVariantId: variant1.taskVariantId,
          name: 'level',
          value: 1,
        });
        mockTaskVariantParameterRepository.getByTaskVariantIds.mockResolvedValue([param]);

        const result = await service.list(superAdminContext, {
          ...defaultOptions,
          embed: ['taskVariantDetails'],
        });

        expect(result.items[0]!.taskVariants[0]!.parameters).toEqual([{ name: 'level', value: 1 }]);
        expect(result.items[1]!.taskVariants[0]!.parameters).toEqual([]);
      });
    });

    describe('error handling', () => {
      it('re-throws ApiError from the bundle repository', async () => {
        const apiError = new ApiError('Not found', {
          statusCode: StatusCodes.NOT_FOUND,
          code: ApiErrorCode.RESOURCE_NOT_FOUND,
        });
        mockTaskBundleRepository.listAll.mockRejectedValue(apiError);

        await expect(service.list(superAdminContext, defaultOptions)).rejects.toBe(apiError);
      });

      it('wraps unexpected bundle repository errors with specific context', async () => {
        mockTaskBundleRepository.listAll.mockRejectedValue(new Error('DB connection lost'));

        await expect(service.list(superAdminContext, defaultOptions)).rejects.toMatchObject({
          statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
          code: ApiErrorCode.DATABASE_QUERY_FAILED,
          context: { userId: superAdminContext.userId, page: 1, perPage: 25 },
        });
      });

      it('re-throws ApiError from the variant repository', async () => {
        const bundle = TaskBundleFactory.build();
        const apiError = new ApiError('Authorization failed', {
          statusCode: StatusCodes.FORBIDDEN,
          code: ApiErrorCode.AUTH_FORBIDDEN,
        });
        mockTaskBundleRepository.listAll.mockResolvedValue({ items: [bundle], totalItems: 1 });
        mockTaskBundleVariantRepository.getVariantsWithTaskDetailsByBundleIds.mockRejectedValue(apiError);

        await expect(service.list(superAdminContext, defaultOptions)).rejects.toBe(apiError);
      });

      it('wraps unexpected variant repository errors with specific context', async () => {
        const bundle = TaskBundleFactory.build();
        mockTaskBundleRepository.listAll.mockResolvedValue({ items: [bundle], totalItems: 1 });
        mockTaskBundleVariantRepository.getVariantsWithTaskDetailsByBundleIds.mockRejectedValue(
          new Error('Query timeout'),
        );

        await expect(service.list(superAdminContext, defaultOptions)).rejects.toMatchObject({
          statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
          code: ApiErrorCode.DATABASE_QUERY_FAILED,
          context: { userId: superAdminContext.userId, bundleIds: [bundle.id] },
        });
      });

      it('re-throws ApiError from the parameter repository', async () => {
        const bundle = TaskBundleFactory.build();
        const variant = buildTaskBundleVariantWithDetails({ taskBundleId: bundle.id });
        const apiError = new ApiError('Authorization failed', {
          statusCode: StatusCodes.FORBIDDEN,
          code: ApiErrorCode.AUTH_FORBIDDEN,
        });
        mockTaskBundleRepository.listAll.mockResolvedValue({ items: [bundle], totalItems: 1 });
        mockTaskBundleVariantRepository.getVariantsWithTaskDetailsByBundleIds.mockResolvedValue([variant]);
        mockTaskVariantParameterRepository.getByTaskVariantIds.mockRejectedValue(apiError);

        await expect(
          service.list(superAdminContext, { ...defaultOptions, embed: ['taskVariantDetails'] }),
        ).rejects.toBe(apiError);
      });

      it('wraps unexpected parameter repository errors with specific context', async () => {
        const bundle = TaskBundleFactory.build();
        const variant = buildTaskBundleVariantWithDetails({ taskBundleId: bundle.id });
        mockTaskBundleRepository.listAll.mockResolvedValue({ items: [bundle], totalItems: 1 });
        mockTaskBundleVariantRepository.getVariantsWithTaskDetailsByBundleIds.mockResolvedValue([variant]);
        mockTaskVariantParameterRepository.getByTaskVariantIds.mockRejectedValue(new Error('Timeout'));

        await expect(
          service.list(superAdminContext, { ...defaultOptions, embed: ['taskVariantDetails'] }),
        ).rejects.toMatchObject({
          statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
          code: ApiErrorCode.DATABASE_QUERY_FAILED,
          context: { userId: superAdminContext.userId, variantIds: [variant.taskVariantId] },
        });
      });
    });
  });
});
