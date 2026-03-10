import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { AuthContext } from '../types/auth-context';
import type { CreateTaskVariantRequestBody, UpdateTaskVariantRequestBody } from '@roar-dashboard/api-contract';
import { StatusCodes } from 'http-status-codes';
import { TaskVariantStatus } from '../enums/task-variant-status.enum';
import { ApiError } from '../errors/api-error';
import { ApiErrorCode } from '../enums/api-error-code.enum';

// Mock the TaskService module
vi.mock('../services/task/task.service', () => ({
  TaskService: vi.fn(),
}));

import { TaskService } from '../services/task/task.service';

describe('TasksController', () => {
  const mockAuthContext: AuthContext = { userId: 'admin-1', isSuperAdmin: true };
  const mockList = vi.fn();
  const mockCreateTaskVariant = vi.fn();
  const mockUpdateTaskVariant = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup the mock service
    vi.mocked(TaskService).mockReturnValue({
      list: mockList,
      createTaskVariant: mockCreateTaskVariant,
      updateTaskVariant: mockUpdateTaskVariant,
      evaluateTaskVariantEligibility: vi.fn(),
    });
  });

  describe('list', () => {
    const mockTasks = [
      {
        id: 'task-1',
        slug: 'swr',
        name: 'Single Word Reading',
        nameSimple: 'SWR',
        nameTechnical: 'Single Word Reading Technical',
        description: 'A reading assessment',
        image: null,
        tutorialVideo: null,
        taskConfig: { difficulty: 'easy' },
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-02T00:00:00Z'),
      },
      {
        id: 'task-2',
        slug: 'pa',
        name: 'Phonological Awareness',
        nameSimple: 'PA',
        nameTechnical: 'Phonological Awareness Technical',
        description: 'A phonics assessment',
        image: 'https://example.com/pa.png',
        tutorialVideo: 'https://example.com/pa.mp4',
        taskConfig: { levels: [1, 2, 3] },
        createdAt: new Date('2024-01-03T00:00:00Z'),
        updatedAt: null,
      },
    ];

    it('should return 200 with paginated tasks on success', async () => {
      mockList.mockResolvedValue({
        items: mockTasks,
        totalItems: 2,
      });

      const query = { page: 1, perPage: 25, sortBy: 'createdAt', sortOrder: 'desc' } as const;

      const { TasksController: Controller } = await import('./tasks.controller');
      const result = await Controller.list(mockAuthContext, query);

      expect(result.status).toBe(StatusCodes.OK);
      if (result.status === StatusCodes.OK) {
        expect(result.body.data.items).toHaveLength(2);
        expect(result.body.data.pagination).toEqual({
          page: 1,
          perPage: 25,
          totalItems: 2,
          totalPages: 1,
        });
        // Verify date transformation
        expect(result.body.data.items[0]!.createdAt).toBe('2024-01-01T00:00:00.000Z');
        expect(result.body.data.items[0]!.updatedAt).toBe('2024-01-02T00:00:00.000Z');
        // Verify null updatedAt returns null
        expect(result.body.data.items[1]!.updatedAt).toBeNull();
      }

      expect(mockList).toHaveBeenCalledWith(mockAuthContext, {
        page: 1,
        perPage: 25,
        orderBy: { field: 'createdAt', direction: 'desc' },
      });
    });

    it('should return empty list when no tasks exist', async () => {
      mockList.mockResolvedValue({
        items: [],
        totalItems: 0,
      });

      const query = { page: 1, perPage: 25, sortBy: 'createdAt', sortOrder: 'desc' } as const;

      const { TasksController: Controller } = await import('./tasks.controller');
      const result = await Controller.list(mockAuthContext, query);

      expect(result.status).toBe(StatusCodes.OK);
      if (result.status === StatusCodes.OK) {
        expect(result.body.data.items).toHaveLength(0);
        expect(result.body.data.pagination.totalItems).toBe(0);
        expect(result.body.data.pagination.totalPages).toBe(0);
      }
    });

    it('should pass slug filter to service', async () => {
      mockList.mockResolvedValue({
        items: [mockTasks[0]],
        totalItems: 1,
      });

      const query = { page: 1, perPage: 25, sortBy: 'createdAt', sortOrder: 'desc', slug: 'swr' } as const;

      const { TasksController: Controller } = await import('./tasks.controller');
      await Controller.list(mockAuthContext, query);

      expect(mockList).toHaveBeenCalledWith(mockAuthContext, {
        page: 1,
        perPage: 25,
        orderBy: { field: 'createdAt', direction: 'desc' },
        slug: 'swr',
      });
    });

    it('should pass search filter to service', async () => {
      mockList.mockResolvedValue({
        items: mockTasks,
        totalItems: 2,
      });

      const query = { page: 1, perPage: 25, sortBy: 'name', sortOrder: 'asc', search: 'reading' } as const;

      const { TasksController: Controller } = await import('./tasks.controller');
      await Controller.list(mockAuthContext, query);

      expect(mockList).toHaveBeenCalledWith(mockAuthContext, {
        page: 1,
        perPage: 25,
        orderBy: { field: 'name', direction: 'asc' },
        search: 'reading',
      });
    });

    it('should calculate correct totalPages for pagination', async () => {
      mockList.mockResolvedValue({
        items: mockTasks,
        totalItems: 55,
      });

      const query = { page: 1, perPage: 10, sortBy: 'createdAt', sortOrder: 'desc' } as const;

      const { TasksController: Controller } = await import('./tasks.controller');
      const result = await Controller.list(mockAuthContext, query);

      expect(result.status).toBe(StatusCodes.OK);
      if (result.status === StatusCodes.OK) {
        expect(result.body.data.pagination.totalPages).toBe(6); // ceil(55/10) = 6
      }
    });

    it('should return 500 when service throws INTERNAL_SERVER_ERROR', async () => {
      const internalError = new ApiError('Database error', {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
      });

      mockList.mockRejectedValue(internalError);

      const query = { page: 1, perPage: 25, sortBy: 'createdAt', sortOrder: 'desc' } as const;

      const { TasksController: Controller } = await import('./tasks.controller');
      const result = await Controller.list(mockAuthContext, query);

      expect(result.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
      if (result.status === StatusCodes.INTERNAL_SERVER_ERROR) {
        expect(result.body.error.code).toBe(ApiErrorCode.DATABASE_QUERY_FAILED);
      }
    });

    it('should re-throw non-ApiError errors', async () => {
      const unexpectedError = new Error('Unexpected error');
      mockList.mockRejectedValue(unexpectedError);

      const query = { page: 1, perPage: 25, sortBy: 'createdAt', sortOrder: 'desc' } as const;

      const { TasksController: Controller } = await import('./tasks.controller');
      await expect(Controller.list(mockAuthContext, query)).rejects.toThrow(unexpectedError);
    });

    it('should transform taskConfig correctly', async () => {
      mockList.mockResolvedValue({
        items: [mockTasks[0]],
        totalItems: 1,
      });

      const query = { page: 1, perPage: 25, sortBy: 'createdAt', sortOrder: 'desc' } as const;

      const { TasksController: Controller } = await import('./tasks.controller');
      const result = await Controller.list(mockAuthContext, query);

      expect(result.status).toBe(StatusCodes.OK);
      if (result.status === StatusCodes.OK) {
        expect(result.body.data.items[0]!.taskConfig).toEqual({ difficulty: 'easy' });
      }
    });
  });

  describe('createTaskVariant', () => {
    it('should return 201 with created variant id on success', async () => {
      const mockVariantId = { id: 'variant-123' };
      mockCreateTaskVariant.mockResolvedValue(mockVariantId);

      const taskId = 'task-123';
      const body: CreateTaskVariantRequestBody = {
        name: 'Test Variant',
        description: 'Test description',
        status: TaskVariantStatus.PUBLISHED,
        parameters: [
          { name: 'param1', value: 'value1' },
          { name: 'param2', value: 'value2' },
        ],
      };

      const { TasksController: Controller } = await import('./tasks.controller');
      const result = await Controller.createTaskVariant(mockAuthContext, taskId, body);

      expect(result).toEqual({
        status: StatusCodes.CREATED,
        body: {
          data: mockVariantId,
        },
      });

      expect(mockCreateTaskVariant).toHaveBeenCalledWith(mockAuthContext, taskId, body);
      expect(mockCreateTaskVariant).toHaveBeenCalledTimes(1);
    });

    it('should return 403 when service throws FORBIDDEN error', async () => {
      const forbiddenError = new ApiError('Forbidden', {
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
      });

      mockCreateTaskVariant.mockRejectedValue(forbiddenError);

      const taskId = 'task-123';
      const body: CreateTaskVariantRequestBody = {
        name: 'Test Variant',
        description: 'Test description',
        status: TaskVariantStatus.PUBLISHED,
        parameters: [{ name: 'param1', value: 'value1' }],
      };

      const { TasksController: Controller } = await import('./tasks.controller');
      const result = await Controller.createTaskVariant(mockAuthContext, taskId, body);

      expect(result.status).toBe(StatusCodes.FORBIDDEN);
      expect(result.body).toHaveProperty('error');
    });

    it('should return 404 when service throws NOT_FOUND error', async () => {
      const notFoundError = new ApiError('Task not found', {
        statusCode: StatusCodes.NOT_FOUND,
        code: ApiErrorCode.RESOURCE_NOT_FOUND,
      });

      mockCreateTaskVariant.mockRejectedValue(notFoundError);

      const taskId = 'nonexistent-task';
      const body: CreateTaskVariantRequestBody = {
        name: 'Test Variant',
        description: 'Test description',
        status: TaskVariantStatus.PUBLISHED,
        parameters: [{ name: 'param1', value: 'value1' }],
      };

      const { TasksController: Controller } = await import('./tasks.controller');
      const result = await Controller.createTaskVariant(mockAuthContext, taskId, body);

      expect(result.status).toBe(StatusCodes.NOT_FOUND);
      expect(result.body).toHaveProperty('error');
    });

    it('should return 409 when service throws CONFLICT error', async () => {
      const conflictError = new ApiError('Variant already exists', {
        statusCode: StatusCodes.CONFLICT,
        code: ApiErrorCode.RESOURCE_CONFLICT,
      });

      mockCreateTaskVariant.mockRejectedValue(conflictError);

      const taskId = 'task-123';
      const body: CreateTaskVariantRequestBody = {
        name: 'duplicate-variant',
        description: 'Test description',
        status: TaskVariantStatus.PUBLISHED,
        parameters: [{ name: 'param1', value: 'value1' }],
      };

      const { TasksController: Controller } = await import('./tasks.controller');
      const result = await Controller.createTaskVariant(mockAuthContext, taskId, body);

      expect(result.status).toBe(StatusCodes.CONFLICT);
      expect(result.body).toHaveProperty('error');
    });

    it('should return 400 when service throws BAD_REQUEST error', async () => {
      const badRequestError = new ApiError('Invalid parameters', {
        statusCode: StatusCodes.BAD_REQUEST,
        code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
      });

      mockCreateTaskVariant.mockRejectedValue(badRequestError);

      const taskId = 'task-123';
      const body: CreateTaskVariantRequestBody = {
        name: 'Test Variant',
        description: 'Test description',
        status: TaskVariantStatus.PUBLISHED,
        parameters: [],
      };

      const { TasksController: Controller } = await import('./tasks.controller');
      const result = await Controller.createTaskVariant(mockAuthContext, taskId, body);

      expect(result.status).toBe(StatusCodes.BAD_REQUEST);
      expect(result.body).toHaveProperty('error');
    });

    it('should return 500 when service throws INTERNAL_SERVER_ERROR', async () => {
      const internalError = new ApiError('Database error', {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
      });

      mockCreateTaskVariant.mockRejectedValue(internalError);

      const taskId = 'task-123';
      const body: CreateTaskVariantRequestBody = {
        name: 'Test Variant',
        description: 'Test description',
        status: TaskVariantStatus.PUBLISHED,
        parameters: [{ name: 'param1', value: 'value1' }],
      };

      const { TasksController: Controller } = await import('./tasks.controller');
      const result = await Controller.createTaskVariant(mockAuthContext, taskId, body);

      expect(result.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(result.body).toHaveProperty('error');
    });

    it('should re-throw non-ApiError errors', async () => {
      const unexpectedError = new Error('Unexpected error');

      mockCreateTaskVariant.mockRejectedValue(unexpectedError);

      const taskId = 'task-123';
      const body: CreateTaskVariantRequestBody = {
        name: 'Test Variant',
        description: 'Test description',
        status: TaskVariantStatus.PUBLISHED,
        parameters: [{ name: 'param1', value: 'value1' }],
      };

      const { TasksController: Controller } = await import('./tasks.controller');
      await expect(Controller.createTaskVariant(mockAuthContext, taskId, body)).rejects.toThrow(unexpectedError);
    });

    it('should handle multiple parameter types in success case', async () => {
      const mockVariantId = { id: 'variant-456' };

      mockCreateTaskVariant.mockResolvedValue(mockVariantId);

      const taskId = 'task-123';
      const body: CreateTaskVariantRequestBody = {
        name: 'Complex Variant',
        description: 'Test with various parameter types',
        status: TaskVariantStatus.DRAFT,
        parameters: [
          { name: 'stringParam', value: 'text' },
          { name: 'numberParam', value: 42 },
          { name: 'booleanParam', value: true },
          { name: 'objectParam', value: { nested: 'value' } },
          { name: 'arrayParam', value: [1, 2, 3] },
          { name: 'nullParam', value: null },
        ],
      };

      const { TasksController: Controller } = await import('./tasks.controller');
      const result = await Controller.createTaskVariant(mockAuthContext, taskId, body);

      expect(result.status).toBe(StatusCodes.CREATED);
      if (result.status === StatusCodes.CREATED) {
        expect(result.body.data).toEqual(mockVariantId);
      }
      expect(mockCreateTaskVariant).toHaveBeenCalledWith(mockAuthContext, taskId, body);
    });
  });

  describe('updateTaskVariant', () => {
    it('should return 204 No Content on successful update', async () => {
      mockUpdateTaskVariant.mockResolvedValue(undefined);

      const params = { taskId: 'task-123', variantId: 'variant-123' };
      const body: UpdateTaskVariantRequestBody = {
        name: 'Updated Name',
        description: 'Updated description',
      };

      const { TasksController: Controller } = await import('./tasks.controller');
      const result = await Controller.updateTaskVariant(mockAuthContext, params, body);

      expect(result).toEqual({
        status: StatusCodes.NO_CONTENT,
        body: undefined,
      });

      expect(mockUpdateTaskVariant).toHaveBeenCalledWith(mockAuthContext, params, body);
      expect(mockUpdateTaskVariant).toHaveBeenCalledTimes(1);
    });

    it('should return 204 when updating only name', async () => {
      mockUpdateTaskVariant.mockResolvedValue(undefined);

      const params = { taskId: 'task-123', variantId: 'variant-123' };
      const body: UpdateTaskVariantRequestBody = {
        name: 'Updated Name',
      };

      const { TasksController: Controller } = await import('./tasks.controller');
      const result = await Controller.updateTaskVariant(mockAuthContext, params, body);

      expect(result.status).toBe(StatusCodes.NO_CONTENT);
    });

    it('should return 204 when updating only parameters', async () => {
      mockUpdateTaskVariant.mockResolvedValue(undefined);

      const params = { taskId: 'task-123', variantId: 'variant-123' };
      const body: UpdateTaskVariantRequestBody = {
        parameters: [{ name: 'newParam', value: 'newValue' }],
      };

      const { TasksController: Controller } = await import('./tasks.controller');
      const result = await Controller.updateTaskVariant(mockAuthContext, params, body);

      expect(result.status).toBe(StatusCodes.NO_CONTENT);
    });

    it('should return 403 when service throws FORBIDDEN error', async () => {
      const forbiddenError = new ApiError('Forbidden', {
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
      });

      mockUpdateTaskVariant.mockRejectedValue(forbiddenError);

      const params = { taskId: 'task-123', variantId: 'variant-123' };
      const body: UpdateTaskVariantRequestBody = {
        name: 'Updated Name',
      };

      const { TasksController: Controller } = await import('./tasks.controller');
      const result = await Controller.updateTaskVariant(mockAuthContext, params, body);

      expect(result.status).toBe(StatusCodes.FORBIDDEN);
      if (result.status === StatusCodes.FORBIDDEN) {
        expect(result.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
      }
    });

    it('should return 404 when service throws NOT_FOUND error for task', async () => {
      const notFoundError = new ApiError('Task not found', {
        statusCode: StatusCodes.NOT_FOUND,
        code: ApiErrorCode.RESOURCE_NOT_FOUND,
      });

      mockUpdateTaskVariant.mockRejectedValue(notFoundError);

      const params = { taskId: 'nonexistent-task', variantId: 'variant-123' };
      const body: UpdateTaskVariantRequestBody = {
        name: 'Updated Name',
      };

      const { TasksController: Controller } = await import('./tasks.controller');
      const result = await Controller.updateTaskVariant(mockAuthContext, params, body);

      expect(result.status).toBe(StatusCodes.NOT_FOUND);
      if (result.status === StatusCodes.NOT_FOUND) {
        expect(result.body.error.code).toBe(ApiErrorCode.RESOURCE_NOT_FOUND);
      }
    });

    it('should return 404 when service throws NOT_FOUND error for variant', async () => {
      const notFoundError = new ApiError('Variant not found', {
        statusCode: StatusCodes.NOT_FOUND,
        code: ApiErrorCode.RESOURCE_NOT_FOUND,
      });

      mockUpdateTaskVariant.mockRejectedValue(notFoundError);

      const params = { taskId: 'task-123', variantId: 'nonexistent-variant' };
      const body: UpdateTaskVariantRequestBody = {
        name: 'Updated Name',
      };

      const { TasksController: Controller } = await import('./tasks.controller');
      const result = await Controller.updateTaskVariant(mockAuthContext, params, body);

      expect(result.status).toBe(StatusCodes.NOT_FOUND);
      if (result.status === StatusCodes.NOT_FOUND) {
        expect(result.body.error.code).toBe(ApiErrorCode.RESOURCE_NOT_FOUND);
      }
    });

    it('should return 409 when service throws CONFLICT error', async () => {
      const conflictError = new ApiError('Variant name already exists', {
        statusCode: StatusCodes.CONFLICT,
        code: ApiErrorCode.RESOURCE_CONFLICT,
      });

      mockUpdateTaskVariant.mockRejectedValue(conflictError);

      const params = { taskId: 'task-123', variantId: 'variant-123' };
      const body: UpdateTaskVariantRequestBody = {
        name: 'Duplicate Name',
      };

      const { TasksController: Controller } = await import('./tasks.controller');
      const result = await Controller.updateTaskVariant(mockAuthContext, params, body);

      expect(result.status).toBe(StatusCodes.CONFLICT);
      if (result.status === StatusCodes.CONFLICT) {
        expect(result.body.error.code).toBe(ApiErrorCode.RESOURCE_CONFLICT);
      }
    });

    it('should return 400 when service throws BAD_REQUEST error', async () => {
      const badRequestError = new ApiError('Invalid update data', {
        statusCode: StatusCodes.BAD_REQUEST,
        code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
      });

      mockUpdateTaskVariant.mockRejectedValue(badRequestError);

      const params = { taskId: 'task-123', variantId: 'variant-123' };
      const body: UpdateTaskVariantRequestBody = {
        name: 'Updated Name',
      };

      const { TasksController: Controller } = await import('./tasks.controller');
      const result = await Controller.updateTaskVariant(mockAuthContext, params, body);

      expect(result.status).toBe(StatusCodes.BAD_REQUEST);
      if (result.status === StatusCodes.BAD_REQUEST) {
        expect(result.body.error.code).toBe(ApiErrorCode.REQUEST_VALIDATION_FAILED);
      }
    });

    it('should return 500 when service throws INTERNAL_SERVER_ERROR', async () => {
      const internalError = new ApiError('Database error', {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
      });

      mockUpdateTaskVariant.mockRejectedValue(internalError);

      const params = { taskId: 'task-123', variantId: 'variant-123' };
      const body: UpdateTaskVariantRequestBody = {
        name: 'Updated Name',
      };

      const { TasksController: Controller } = await import('./tasks.controller');
      const result = await Controller.updateTaskVariant(mockAuthContext, params, body);

      expect(result.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
      if (result.status === StatusCodes.INTERNAL_SERVER_ERROR) {
        expect(result.body.error.code).toBe(ApiErrorCode.DATABASE_QUERY_FAILED);
      }
    });

    it('should re-throw non-ApiError errors', async () => {
      const unexpectedError = new Error('Unexpected error');

      mockUpdateTaskVariant.mockRejectedValue(unexpectedError);

      const params = { taskId: 'task-123', variantId: 'variant-123' };
      const body: UpdateTaskVariantRequestBody = {
        name: 'Updated Name',
      };

      const { TasksController: Controller } = await import('./tasks.controller');
      await expect(Controller.updateTaskVariant(mockAuthContext, params, body)).rejects.toThrow(unexpectedError);
    });

    it('should handle updating multiple fields', async () => {
      mockUpdateTaskVariant.mockResolvedValue(undefined);

      const params = { taskId: 'task-123', variantId: 'variant-123' };
      const body: UpdateTaskVariantRequestBody = {
        name: 'Multi Update',
        description: 'Updated description',
        status: TaskVariantStatus.PUBLISHED,
        parameters: [
          { name: 'param1', value: 'value1' },
          { name: 'param2', value: 'value2' },
        ],
      };

      const { TasksController: Controller } = await import('./tasks.controller');
      const result = await Controller.updateTaskVariant(mockAuthContext, params, body);

      expect(result.status).toBe(StatusCodes.NO_CONTENT);
    });
  });
});
