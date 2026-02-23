import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { AuthContext } from '../types/auth-context';
import type { CreateTaskVariantData } from '../services/task/task.service';
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
  const mockCreateTaskVariant = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup the mock service
    vi.mocked(TaskService).mockReturnValue({
      createTaskVariant: mockCreateTaskVariant,
    });
  });

  describe('createTaskVariant', () => {
    it('should return 201 with created variant id on success', async () => {
      const mockVariantId = { id: 'variant-123' };
      mockCreateTaskVariant.mockResolvedValue(mockVariantId);

      const data: CreateTaskVariantData = {
        taskId: 'task-123',
        name: 'Test Variant',
        description: 'Test description',
        status: TaskVariantStatus.PUBLISHED,
        parameters: [
          { name: 'param1', value: 'value1' },
          { name: 'param2', value: 'value2' },
        ],
      };

      const { TasksController: Controller } = await import('./tasks.controller');
      const result = await Controller.createTaskVariant(mockAuthContext, data);

      expect(result).toEqual({
        status: StatusCodes.CREATED,
        body: {
          data: mockVariantId,
        },
      });

      expect(mockCreateTaskVariant).toHaveBeenCalledWith(mockAuthContext, data);
      expect(mockCreateTaskVariant).toHaveBeenCalledTimes(1);
    });

    it('should return 403 when service throws FORBIDDEN error', async () => {
      const forbiddenError = new ApiError('Forbidden', {
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
      });

      mockCreateTaskVariant.mockRejectedValue(forbiddenError);

      const data: CreateTaskVariantData = {
        taskId: 'task-123',
        name: 'Test Variant',
        description: 'Test description',
        status: TaskVariantStatus.PUBLISHED,
        parameters: [{ name: 'param1', value: 'value1' }],
      };

      const { TasksController: Controller } = await import('./tasks.controller');
      const result = await Controller.createTaskVariant(mockAuthContext, data);

      expect(result.status).toBe(StatusCodes.FORBIDDEN);
      expect(result.body).toHaveProperty('error');
    });

    it('should return 404 when service throws NOT_FOUND error', async () => {
      const notFoundError = new ApiError('Task not found', {
        statusCode: StatusCodes.NOT_FOUND,
        code: ApiErrorCode.RESOURCE_NOT_FOUND,
      });

      mockCreateTaskVariant.mockRejectedValue(notFoundError);

      const data: CreateTaskVariantData = {
        taskId: 'nonexistent-task',
        name: 'Test Variant',
        description: 'Test description',
        status: TaskVariantStatus.PUBLISHED,
        parameters: [{ name: 'param1', value: 'value1' }],
      };

      const { TasksController: Controller } = await import('./tasks.controller');
      const result = await Controller.createTaskVariant(mockAuthContext, data);

      expect(result.status).toBe(StatusCodes.NOT_FOUND);
      expect(result.body).toHaveProperty('error');
    });

    it('should return 409 when service throws CONFLICT error', async () => {
      const conflictError = new ApiError('Variant already exists', {
        statusCode: StatusCodes.CONFLICT,
        code: ApiErrorCode.RESOURCE_CONFLICT,
      });

      mockCreateTaskVariant.mockRejectedValue(conflictError);

      const data: CreateTaskVariantData = {
        taskId: 'task-123',
        name: 'duplicate-variant',
        description: 'Test description',
        status: TaskVariantStatus.PUBLISHED,
        parameters: [{ name: 'param1', value: 'value1' }],
      };

      const { TasksController: Controller } = await import('./tasks.controller');
      const result = await Controller.createTaskVariant(mockAuthContext, data);

      expect(result.status).toBe(StatusCodes.CONFLICT);
      expect(result.body).toHaveProperty('error');
    });

    it('should return 400 when service throws BAD_REQUEST error', async () => {
      const badRequestError = new ApiError('Invalid parameters', {
        statusCode: StatusCodes.BAD_REQUEST,
        code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
      });

      mockCreateTaskVariant.mockRejectedValue(badRequestError);

      const data: CreateTaskVariantData = {
        taskId: 'task-123',
        name: 'Test Variant',
        description: 'Test description',
        status: TaskVariantStatus.PUBLISHED,
        parameters: [],
      };

      const { TasksController: Controller } = await import('./tasks.controller');
      const result = await Controller.createTaskVariant(mockAuthContext, data);

      expect(result.status).toBe(StatusCodes.BAD_REQUEST);
      expect(result.body).toHaveProperty('error');
    });

    it('should return 500 when service throws INTERNAL_SERVER_ERROR', async () => {
      const internalError = new ApiError('Database error', {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
      });

      mockCreateTaskVariant.mockRejectedValue(internalError);

      const data: CreateTaskVariantData = {
        taskId: 'task-123',
        name: 'Test Variant',
        description: 'Test description',
        status: TaskVariantStatus.PUBLISHED,
        parameters: [{ name: 'param1', value: 'value1' }],
      };

      const { TasksController: Controller } = await import('./tasks.controller');
      const result = await Controller.createTaskVariant(mockAuthContext, data);

      expect(result.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(result.body).toHaveProperty('error');
    });

    it('should re-throw non-ApiError errors', async () => {
      const unexpectedError = new Error('Unexpected error');

      mockCreateTaskVariant.mockRejectedValue(unexpectedError);

      const data: CreateTaskVariantData = {
        taskId: 'task-123',
        name: 'Test Variant',
        description: 'Test description',
        status: TaskVariantStatus.PUBLISHED,
        parameters: [{ name: 'param1', value: 'value1' }],
      };

      const { TasksController: Controller } = await import('./tasks.controller');
      await expect(Controller.createTaskVariant(mockAuthContext, data)).rejects.toThrow(unexpectedError);
    });

    it('should handle multiple parameter types in success case', async () => {
      const mockVariantId = { id: 'variant-456' };

      mockCreateTaskVariant.mockResolvedValue(mockVariantId);

      const data: CreateTaskVariantData = {
        taskId: 'task-123',
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
      const result = await Controller.createTaskVariant(mockAuthContext, data);

      expect(result.status).toBe(StatusCodes.CREATED);
      if (result.status === StatusCodes.CREATED) {
        expect(result.body.data).toEqual(mockVariantId);
      }
      expect(mockCreateTaskVariant).toHaveBeenCalledWith(mockAuthContext, data);
    });
  });
});
