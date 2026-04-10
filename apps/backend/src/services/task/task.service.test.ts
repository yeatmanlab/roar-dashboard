import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  MockTaskRepository,
  MockTaskVariantRepository,
  MockTaskVariantParameterRepository,
  createMockTaskRepository,
  createMockTaskVariantRepository,
  createMockTaskVariantParameterRepository,
} from '../../test-support/repositories';
import { TaskFactory } from '../../test-support/factories/task.factory';
import { TaskVariantFactory } from '../../test-support/factories/task-variant.factory';
import { TaskVariantParameterFactory } from '../../test-support/factories/task-variant-parameter.factory';
import { TaskService } from './task.service';
import { TaskVariantStatus } from '../../enums/task-variant-status.enum';
import { ApiError } from '../../errors/api-error';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { ApiErrorMessage } from '../../enums/api-error-message.enum';
import { StatusCodes } from 'http-status-codes';
import { PostgresErrorCode } from '../../enums/postgres-error-code.enum';
import type { AuthContext } from '../../types/auth-context';
import type { Condition } from '../../types/condition';
import { Operator } from '../../types/condition';
import type { User } from '../../db/schema';
import { SortOrder, TaskSortField } from '@roar-dashboard/api-contract';

describe('TaskService', () => {
  let authContext: AuthContext;
  let taskRepository: MockTaskRepository;
  let taskVariantRepository: MockTaskVariantRepository;
  let taskVariantParameterRepository: MockTaskVariantParameterRepository;
  let taskService: ReturnType<typeof TaskService>;

  beforeEach(() => {
    vi.clearAllMocks();
    authContext = { userId: 'admin-1', isSuperAdmin: true };
    taskRepository = createMockTaskRepository();
    taskVariantRepository = createMockTaskVariantRepository();
    taskVariantParameterRepository = createMockTaskVariantParameterRepository();

    taskService = TaskService({
      taskRepository,
      taskVariantRepository,
      taskVariantParameterRepository,
    });
  });

  describe('createTaskVariant', () => {
    describe('successful creation', () => {
      it('should create a new task-variant with one parameter', async () => {
        const mockTask = TaskFactory.build();
        const mockTaskVariant = TaskVariantFactory.build({ taskId: mockTask.id });
        const mockTaskVariantParameter = TaskVariantParameterFactory.build({
          taskVariantId: mockTaskVariant.id,
          name: 'Test Parameter 1',
          value: 'Test Value 1',
        });
        const mockTaskVariantParameterData = [mockTaskVariantParameter];
        const mockTaskVariantParameterReturnValue = mockTaskVariantParameterData.map((taskVariantParameter) => {
          return {
            id: taskVariantParameter.taskVariantId,
          };
        });
        taskRepository.getById.mockResolvedValueOnce(mockTask);
        taskVariantRepository.runTransaction.mockImplementationOnce(async ({ fn }) => {
          return await fn({});
        });
        taskVariantRepository.create.mockResolvedValueOnce(mockTaskVariant);
        taskVariantParameterRepository.createMany.mockResolvedValueOnce(mockTaskVariantParameterReturnValue);

        const taskId = mockTask.id;
        const body = {
          name: 'Test Variant',
          description: 'Test description',
          status: TaskVariantStatus.PUBLISHED,
          parameters: mockTaskVariantParameterData,
        };
        const result = await taskService.createTaskVariant(authContext, taskId, body);

        expect(result).toEqual({ id: mockTaskVariant.id });
        expect(taskRepository.getById).toHaveBeenCalledWith({ id: mockTask.id });
        expect(taskVariantRepository.create).toHaveBeenCalledWith({
          data: {
            taskId: mockTask.id,
            status: TaskVariantStatus.PUBLISHED,
            name: 'Test Variant',
            description: 'Test description',
          },
          transaction: expect.any(Object),
        });
      });

      it('should create a task-variant with multiple parameters', async () => {
        const mockTask = TaskFactory.build();
        const mockTaskVariant = TaskVariantFactory.build({ taskId: mockTask.id });

        const mockParameters = [
          { name: 'difficulty', value: 'easy' },
          { name: 'timeLimit', value: 120 },
          { name: 'hintsEnabled', value: true },
          { name: 'config', value: { nested: 'object', count: 5 } },
        ];

        const mockParameterReturnValues = mockParameters.map((_, idx) => ({ id: `param-${idx}` }));

        taskRepository.getById.mockResolvedValueOnce(mockTask);
        taskVariantRepository.runTransaction.mockImplementationOnce(async ({ fn }) => {
          return await fn({});
        });
        taskVariantRepository.create.mockResolvedValueOnce(mockTaskVariant);
        taskVariantParameterRepository.createMany.mockResolvedValueOnce(mockParameterReturnValues);

        const taskId = mockTask.id;
        const body = {
          name: 'Multi-param Variant',
          description: 'Variant with multiple parameters',
          status: TaskVariantStatus.PUBLISHED,
          parameters: mockParameters,
        };

        const result = await taskService.createTaskVariant(authContext, taskId, body);

        expect(result).toEqual({ id: mockTaskVariant.id });
        expect(taskVariantParameterRepository.createMany).toHaveBeenCalledWith({
          data: mockParameters.map((param) => ({
            taskVariantId: mockTaskVariant.id,
            name: param.name,
            value: param.value,
          })),
          transaction: expect.any(Object),
        });
      });

      it('should handle JSONB parameter values correctly', async () => {
        const mockTask = TaskFactory.build();
        const mockTaskVariant = TaskVariantFactory.build({ taskId: mockTask.id });

        const complexParameter = {
          name: 'gameConfig',
          value: {
            levels: [1, 2, 3],
            settings: { audio: true, volume: 0.8 },
            metadata: null,
          },
        };

        taskRepository.getById.mockResolvedValueOnce(mockTask);
        taskVariantRepository.runTransaction.mockImplementationOnce(async ({ fn }) => {
          return await fn({});
        });
        taskVariantRepository.create.mockResolvedValueOnce(mockTaskVariant);
        taskVariantParameterRepository.createMany.mockResolvedValueOnce([{ id: 'param-1' }]);

        const taskId = mockTask.id;
        const body = {
          name: 'Complex Variant',
          description: 'Variant with complex JSONB',
          status: TaskVariantStatus.DRAFT,
          parameters: [complexParameter],
        };

        const result = await taskService.createTaskVariant(authContext, taskId, body);

        expect(result).toEqual({ id: mockTaskVariant.id });
        expect(taskVariantParameterRepository.createMany).toHaveBeenCalledWith({
          data: [
            {
              taskVariantId: mockTaskVariant.id,
              name: 'gameConfig',
              value: complexParameter.value,
            },
          ],
          transaction: expect.any(Object),
        });
      });
    });

    describe('authorization', () => {
      it('should throw FORBIDDEN error when user is not super admin', async () => {
        const nonAdminContext: AuthContext = { userId: 'user-1', isSuperAdmin: false };

        const taskId = 'task-1';
        const body = {
          name: 'Test Variant',
          description: 'Test description',
          status: TaskVariantStatus.PUBLISHED,
          parameters: [{ name: 'param1', value: 'value1' }],
        };

        await expect(taskService.createTaskVariant(nonAdminContext, taskId, body)).rejects.toMatchObject({
          statusCode: StatusCodes.FORBIDDEN,
          code: ApiErrorCode.AUTH_FORBIDDEN,
          context: { userId: 'user-1', isSuperAdmin: false },
        });

        // Verify repository methods were never called
        expect(taskRepository.getById).not.toHaveBeenCalled();
        expect(taskVariantRepository.runTransaction).not.toHaveBeenCalled();
      });
    });

    describe('successful creation with edge cases', () => {
      it('should create a variant without parameters (empty array)', async () => {
        const mockTask = TaskFactory.build();
        const mockTaskVariant = TaskVariantFactory.build({ taskId: mockTask.id });

        taskRepository.getById.mockResolvedValueOnce(mockTask);
        taskVariantRepository.runTransaction.mockImplementationOnce(async ({ fn }) => {
          return await fn({});
        });
        taskVariantRepository.create.mockResolvedValueOnce(mockTaskVariant);

        const taskId = mockTask.id;
        const body = {
          name: 'No Params Variant',
          description: 'Variant with no parameters',
          status: TaskVariantStatus.PUBLISHED,
          parameters: [], // Empty array is now allowed
        };

        const result = await taskService.createTaskVariant(authContext, taskId, body);

        expect(result).toEqual({ id: mockTaskVariant.id });
        expect(taskVariantRepository.create).toHaveBeenCalledWith({
          data: {
            taskId: mockTask.id,
            status: TaskVariantStatus.PUBLISHED,
            name: 'No Params Variant',
            description: 'Variant with no parameters',
          },
          transaction: expect.any(Object),
        });
        // createMany should not be called when parameters array is empty
        expect(taskVariantParameterRepository.createMany).not.toHaveBeenCalled();
      });
    });

    describe('validation errors', () => {
      it('should throw INTERNAL when not all parameters are created', async () => {
        const mockTask = TaskFactory.build();
        const mockTaskVariant = TaskVariantFactory.build({ taskId: mockTask.id });

        taskRepository.getById.mockResolvedValue(mockTask);
        taskVariantRepository.runTransaction.mockImplementationOnce(async ({ fn }) => {
          return await fn({});
        });
        taskVariantRepository.create.mockResolvedValueOnce(mockTaskVariant);

        // Only 1 parameter created instead of 3
        taskVariantParameterRepository.createMany.mockResolvedValueOnce([{ id: 'param-1' }]);

        const taskId = mockTask.id;
        const body = {
          name: 'Partial Variant',
          description: 'Should fail',
          status: TaskVariantStatus.PUBLISHED,
          parameters: [
            { name: 'param1', value: 'value1' },
            { name: 'param2', value: 'value2' },
            { name: 'param3', value: 'value3' },
          ],
        };

        await expect(taskService.createTaskVariant(authContext, taskId, body)).rejects.toMatchObject({
          message: 'Failed to create all task variant parameters',
          statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
          code: ApiErrorCode.INTERNAL,
          context: {
            userId: 'admin-1',
            isSuperAdmin: true,
            expected: 3,
            created: 1,
          },
        });
      });
    });

    describe('not found errors', () => {
      it('should throw NOT_FOUND when parent task does not exist', async () => {
        taskRepository.getById.mockResolvedValue(null);

        const taskId = 'nonexistent-task-id';
        const body = {
          name: 'Test Variant',
          description: 'Test description',
          status: TaskVariantStatus.PUBLISHED,
          parameters: [{ name: 'param1', value: 'value1' }],
        };

        await expect(taskService.createTaskVariant(authContext, taskId, body)).rejects.toMatchObject({
          statusCode: StatusCodes.NOT_FOUND,
          code: ApiErrorCode.RESOURCE_NOT_FOUND,
          context: {
            userId: 'admin-1',
            taskId: 'nonexistent-task-id',
          },
        });

        // Verify transaction was never started
        expect(taskVariantRepository.runTransaction).not.toHaveBeenCalled();
      });
    });

    describe('database errors', () => {
      /**
       * Database error tests demonstrate proper error typing patterns:
       *
       * 1. Use Object.assign() to add 'code' property to errors for PostgreSQL error typing
       * 2. Use PostgresErrorCode enum instead of magic strings like '23505'
       * 3. For Drizzle-wrapped errors, include a 'cause' property with the underlying error
       * 4. The service should use unwrapDrizzleError() to access the underlying PostgreSQL error
       *
       * This avoids using 'any' types and provides proper type safety in tests.
       */
      it('should throw CONFLICT on unique constraint violation', async () => {
        const mockTask = TaskFactory.build();

        taskRepository.getById.mockResolvedValue(mockTask);

        // Create a Postgres error with proper typing
        // Using Object.assign to add the 'code' property to match PostgreSQL error structure
        const uniqueViolationError = Object.assign(new Error('duplicate key value violates unique constraint'), {
          code: PostgresErrorCode.UNIQUE_VIOLATION, // '23505'
        });

        taskVariantRepository.runTransaction.mockRejectedValueOnce(uniqueViolationError);

        const taskId = mockTask.id;
        const body = {
          name: 'duplicate-variant-name',
          description: 'Test description',
          status: TaskVariantStatus.PUBLISHED,
          parameters: [{ name: 'param1', value: 'value1' }],
        };

        await expect(taskService.createTaskVariant(authContext, taskId, body)).rejects.toMatchObject({
          statusCode: StatusCodes.CONFLICT,
          code: ApiErrorCode.RESOURCE_CONFLICT,
          context: {
            userId: 'admin-1',
            taskId: mockTask.id,
            variantName: 'duplicate-variant-name',
          },
        });
      });

      it('should throw DATABASE_QUERY_FAILED on unexpected database error', async () => {
        const mockTask = TaskFactory.build();

        taskRepository.getById.mockResolvedValue(mockTask);

        const dbError = new Error('Connection timeout');
        taskVariantRepository.runTransaction.mockRejectedValueOnce(dbError);

        const taskId = mockTask.id;
        const body = {
          name: 'Test Variant',
          description: 'Test description',
          status: TaskVariantStatus.PUBLISHED,
          parameters: [{ name: 'param1', value: 'value1' }],
        };

        await expect(taskService.createTaskVariant(authContext, taskId, body)).rejects.toMatchObject({
          message: 'Failed to create task variant',
          statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
          code: ApiErrorCode.DATABASE_QUERY_FAILED,
          context: {
            userId: 'admin-1',
            taskId: mockTask.id,
          },
        });
      });

      it('should throw INTERNAL when variant creation fails', async () => {
        const mockTask = TaskFactory.build();

        taskRepository.getById.mockResolvedValue(mockTask);
        taskVariantRepository.runTransaction.mockImplementationOnce(async ({ fn }) => {
          return await fn({});
        });

        const taskId = mockTask.id;
        const body = {
          name: 'Failed Variant',
          description: 'Test description',
          status: TaskVariantStatus.PUBLISHED,
          parameters: [{ name: 'param1', value: 'value1' }],
        };

        await expect(taskService.createTaskVariant(authContext, taskId, body)).rejects.toMatchObject({
          message: 'Failed to create task variant',
          statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
          code: ApiErrorCode.INTERNAL,
        });
      });

      it('should propagate ApiError from nested operations', async () => {
        const mockTask = TaskFactory.build();

        taskRepository.getById.mockResolvedValue(mockTask);

        const nestedApiError = new ApiError('Custom validation error', {
          statusCode: StatusCodes.BAD_REQUEST,
          code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
        });

        taskVariantRepository.runTransaction.mockRejectedValueOnce(nestedApiError);

        const taskId = mockTask.id;
        const body = {
          name: 'Test Variant',
          description: 'Test description',
          status: TaskVariantStatus.PUBLISHED,
          parameters: [{ name: 'param1', value: 'value1' }],
        };

        await expect(taskService.createTaskVariant(authContext, taskId, body)).rejects.toThrow(nestedApiError);
      });
    });

    describe('edge cases', () => {
      it('should handle variant with deprecated status', async () => {
        const mockTask = TaskFactory.build();
        const mockTaskVariant = TaskVariantFactory.build({ taskId: mockTask.id });

        taskRepository.getById.mockResolvedValueOnce(mockTask);
        taskVariantRepository.runTransaction.mockImplementationOnce(async ({ fn }) => {
          return await fn({});
        });
        taskVariantRepository.create.mockResolvedValueOnce(mockTaskVariant);
        taskVariantParameterRepository.createMany.mockResolvedValueOnce([{ id: 'param-1' }]);

        const taskId = mockTask.id;
        const body = {
          name: 'Deprecated Variant',
          description: 'Old variant',
          status: TaskVariantStatus.DEPRECATED,
          parameters: [{ name: 'param1', value: 'value1' }],
        };

        const result = await taskService.createTaskVariant(authContext, taskId, body);

        expect(result).toEqual({ id: mockTaskVariant.id });
        expect(taskVariantRepository.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({ status: TaskVariantStatus.DEPRECATED }),
          }),
        );
      });

      it('should handle variant with draft status', async () => {
        const mockTask = TaskFactory.build();
        const mockTaskVariant = TaskVariantFactory.build({ taskId: mockTask.id });

        taskRepository.getById.mockResolvedValueOnce(mockTask);
        taskVariantRepository.runTransaction.mockImplementationOnce(async ({ fn }) => {
          return await fn({});
        });
        taskVariantRepository.create.mockResolvedValueOnce(mockTaskVariant);
        taskVariantParameterRepository.createMany.mockResolvedValueOnce([{ id: 'param-1' }]);

        const taskId = mockTask.id;
        const body = {
          name: 'Draft Variant',
          description: 'Work in progress',
          status: TaskVariantStatus.DRAFT,
          parameters: [{ name: 'param1', value: 'value1' }],
        };

        const result = await taskService.createTaskVariant(authContext, taskId, body);

        expect(result).toEqual({ id: mockTaskVariant.id });
        expect(taskVariantRepository.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({ status: TaskVariantStatus.DRAFT }),
          }),
        );
      });

      it('should handle parameter with null value', async () => {
        const mockTask = TaskFactory.build();
        const mockTaskVariant = TaskVariantFactory.build({ taskId: mockTask.id });

        taskRepository.getById.mockResolvedValueOnce(mockTask);
        taskVariantRepository.runTransaction.mockImplementationOnce(async ({ fn }) => {
          return await fn({});
        });
        taskVariantRepository.create.mockResolvedValueOnce(mockTaskVariant);
        taskVariantParameterRepository.createMany.mockResolvedValueOnce([{ id: 'param-1' }]);

        const taskId = mockTask.id;
        const body = {
          name: 'Null Param Variant',
          description: 'Test null handling',
          status: TaskVariantStatus.PUBLISHED,
          parameters: [{ name: 'optionalConfig', value: null }],
        };

        const result = await taskService.createTaskVariant(authContext, taskId, body);

        expect(result).toEqual({ id: mockTaskVariant.id });
        expect(taskVariantParameterRepository.createMany).toHaveBeenCalledWith({
          data: [
            {
              taskVariantId: mockTaskVariant.id,
              name: 'optionalConfig',
              value: null,
            },
          ],
          transaction: expect.any(Object),
        });
      });

      it('should handle parameter with array value', async () => {
        const mockTask = TaskFactory.build();
        const mockTaskVariant = TaskVariantFactory.build({ taskId: mockTask.id });

        taskRepository.getById.mockResolvedValueOnce(mockTask);
        taskVariantRepository.runTransaction.mockImplementationOnce(async ({ fn }) => {
          return await fn({});
        });
        taskVariantRepository.create.mockResolvedValueOnce(mockTaskVariant);
        taskVariantParameterRepository.createMany.mockResolvedValueOnce([{ id: 'param-1' }]);

        const arrayValue = ['option1', 'option2', 'option3'];
        const taskId = mockTask.id;
        const body = {
          name: 'Array Param Variant',
          description: 'Test array handling',
          status: TaskVariantStatus.PUBLISHED,
          parameters: [{ name: 'choices', value: arrayValue }],
        };

        const result = await taskService.createTaskVariant(authContext, taskId, body);

        expect(result).toEqual({ id: mockTaskVariant.id });
        expect(taskVariantParameterRepository.createMany).toHaveBeenCalledWith({
          data: [
            {
              taskVariantId: mockTaskVariant.id,
              name: 'choices',
              value: arrayValue,
            },
          ],
          transaction: expect.any(Object),
        });
      });
    });
  });

  describe('updateTaskVariant', () => {
    describe('successful updates', () => {
      it('should update only the name field', async () => {
        const mockTask = TaskFactory.build();
        const mockTaskVariant = TaskVariantFactory.build({ taskId: mockTask.id, name: 'Original Name' });

        taskVariantRepository.getTaskIdByVariantId.mockResolvedValueOnce({ taskId: mockTask.id });
        taskVariantRepository.runTransaction.mockImplementationOnce(async ({ fn }) => {
          return await fn({});
        });
        taskVariantRepository.update.mockResolvedValueOnce();

        const params = { taskId: mockTask.id, variantId: mockTaskVariant.id };
        const body = { name: 'Updated Name' };

        const result = await taskService.updateTaskVariant(authContext, params, body);

        expect(result).toBeUndefined();
        expect(taskVariantRepository.update).toHaveBeenCalledWith({
          id: mockTaskVariant.id,
          data: { name: 'Updated Name' },
          transaction: expect.any(Object),
        });
        expect(taskVariantParameterRepository.deleteByTaskVariantId).not.toHaveBeenCalled();
      });

      it('should update only the description field', async () => {
        const mockTask = TaskFactory.build();
        const mockTaskVariant = TaskVariantFactory.build({ taskId: mockTask.id });

        taskVariantRepository.getTaskIdByVariantId.mockResolvedValueOnce({ taskId: mockTask.id });
        taskVariantRepository.runTransaction.mockImplementationOnce(async ({ fn }) => {
          return await fn({});
        });
        taskVariantRepository.update.mockResolvedValueOnce();

        const params = { taskId: mockTask.id, variantId: mockTaskVariant.id };
        const body = { description: 'Updated description' };

        const result = await taskService.updateTaskVariant(authContext, params, body);

        expect(result).toBeUndefined();
        expect(taskVariantRepository.update).toHaveBeenCalledWith({
          id: mockTaskVariant.id,
          data: { description: 'Updated description' },
          transaction: expect.any(Object),
        });
      });

      it('should update only the status field', async () => {
        const mockTask = TaskFactory.build();
        const mockTaskVariant = TaskVariantFactory.build({ taskId: mockTask.id, status: TaskVariantStatus.DRAFT });

        taskVariantRepository.getTaskIdByVariantId.mockResolvedValueOnce({ taskId: mockTask.id });
        taskVariantRepository.runTransaction.mockImplementationOnce(async ({ fn }) => {
          return await fn({});
        });
        taskVariantRepository.update.mockResolvedValueOnce();

        const params = { taskId: mockTask.id, variantId: mockTaskVariant.id };
        const body = { status: TaskVariantStatus.PUBLISHED };

        const result = await taskService.updateTaskVariant(authContext, params, body);

        expect(result).toBeUndefined();
        expect(taskVariantRepository.update).toHaveBeenCalledWith({
          id: mockTaskVariant.id,
          data: { status: TaskVariantStatus.PUBLISHED },
          transaction: expect.any(Object),
        });
      });

      it('should update only the parameters (replacement)', async () => {
        const mockTask = TaskFactory.build();
        const mockTaskVariant = TaskVariantFactory.build({ taskId: mockTask.id });

        taskVariantRepository.getTaskIdByVariantId.mockResolvedValueOnce({ taskId: mockTask.id });
        taskVariantRepository.runTransaction.mockImplementationOnce(async ({ fn }) => {
          return await fn({});
        });
        taskVariantParameterRepository.deleteByTaskVariantId.mockResolvedValueOnce();
        taskVariantParameterRepository.createMany.mockResolvedValueOnce([{ id: 'param-1' }]);

        const newParameters = [{ name: 'newParam', value: 'newValue' }];
        const params = { taskId: mockTask.id, variantId: mockTaskVariant.id };
        const body = { parameters: newParameters };

        const result = await taskService.updateTaskVariant(authContext, params, body);

        expect(result).toBeUndefined();
        expect(taskVariantParameterRepository.deleteByTaskVariantId).toHaveBeenCalledWith({
          taskVariantId: mockTaskVariant.id,
          transaction: expect.any(Object),
        });
        expect(taskVariantParameterRepository.createMany).toHaveBeenCalledWith({
          data: [
            {
              taskVariantId: mockTaskVariant.id,
              name: 'newParam',
              value: 'newValue',
            },
          ],
          transaction: expect.any(Object),
        });
        expect(taskVariantRepository.update).not.toHaveBeenCalled();
      });

      it('should update multiple fields simultaneously', async () => {
        const mockTask = TaskFactory.build();
        const mockTaskVariant = TaskVariantFactory.build({ taskId: mockTask.id });

        taskVariantRepository.getTaskIdByVariantId.mockResolvedValueOnce({ taskId: mockTask.id });
        taskVariantRepository.runTransaction.mockImplementationOnce(async ({ fn }) => {
          return await fn({});
        });
        taskVariantRepository.update.mockResolvedValueOnce();
        taskVariantParameterRepository.deleteByTaskVariantId.mockResolvedValueOnce();
        taskVariantParameterRepository.createMany.mockResolvedValueOnce([{ id: 'param-1' }]);

        const params = { taskId: mockTask.id, variantId: mockTaskVariant.id };
        const body = {
          name: 'Updated Name',
          description: 'Updated description',
          status: TaskVariantStatus.PUBLISHED,
          parameters: [{ name: 'param1', value: 'value1' }],
        };

        const result = await taskService.updateTaskVariant(authContext, params, body);

        expect(result).toBeUndefined();
        expect(taskVariantRepository.update).toHaveBeenCalledWith({
          id: mockTaskVariant.id,
          data: {
            name: 'Updated Name',
            description: 'Updated description',
            status: TaskVariantStatus.PUBLISHED,
          },
          transaction: expect.any(Object),
        });
        expect(taskVariantParameterRepository.deleteByTaskVariantId).toHaveBeenCalled();
        expect(taskVariantParameterRepository.createMany).toHaveBeenCalled();
      });

      it('should allow updating name to the same name (idempotent)', async () => {
        const mockTask = TaskFactory.build();
        const mockTaskVariant = TaskVariantFactory.build({ taskId: mockTask.id, name: 'Same Name' });

        taskVariantRepository.getTaskIdByVariantId.mockResolvedValueOnce({ taskId: mockTask.id });
        taskVariantRepository.runTransaction.mockImplementationOnce(async ({ fn }) => {
          return await fn({});
        });
        taskVariantRepository.update.mockResolvedValueOnce();

        const params = { taskId: mockTask.id, variantId: mockTaskVariant.id };
        const body = { name: 'Same Name' };

        const result = await taskService.updateTaskVariant(authContext, params, body);

        expect(result).toBeUndefined();
        expect(taskVariantRepository.update).toHaveBeenCalledWith({
          id: mockTaskVariant.id,
          data: { name: 'Same Name' },
          transaction: expect.any(Object),
        });
      });

      it('should handle empty parameters array (deletes all parameters)', async () => {
        const mockTask = TaskFactory.build();
        const mockTaskVariant = TaskVariantFactory.build({ taskId: mockTask.id });

        taskVariantRepository.getTaskIdByVariantId.mockResolvedValueOnce({ taskId: mockTask.id });
        taskVariantRepository.runTransaction.mockImplementationOnce(async ({ fn }) => {
          return await fn({});
        });
        taskVariantParameterRepository.deleteByTaskVariantId.mockResolvedValueOnce();

        const params = { taskId: mockTask.id, variantId: mockTaskVariant.id };
        const body = { parameters: [] };

        const result = await taskService.updateTaskVariant(authContext, params, body);

        expect(result).toBeUndefined();
        expect(taskVariantParameterRepository.deleteByTaskVariantId).toHaveBeenCalledWith({
          taskVariantId: mockTaskVariant.id,
          transaction: expect.any(Object),
        });
        expect(taskVariantParameterRepository.createMany).not.toHaveBeenCalled();
      });
    });

    describe('authorization', () => {
      it('should throw FORBIDDEN error when user is not super admin', async () => {
        const nonAdminContext: AuthContext = { userId: 'user-1', isSuperAdmin: false };

        const params = { taskId: 'task-123', variantId: 'variant-123' };
        const body = { name: 'Updated Name' };

        await expect(taskService.updateTaskVariant(nonAdminContext, params, body)).rejects.toMatchObject({
          statusCode: StatusCodes.FORBIDDEN,
          code: ApiErrorCode.AUTH_FORBIDDEN,
          context: {
            userId: 'user-1',
            isSuperAdmin: false,
          },
        });

        expect(taskRepository.getById).not.toHaveBeenCalled();
      });
    });

    describe('not found errors', () => {
      it('should throw NOT_FOUND when task does not exist', async () => {
        taskVariantRepository.getTaskIdByVariantId.mockResolvedValueOnce(null);

        const params = { taskId: 'nonexistent-task-id', variantId: 'variant-123' };
        const body = { name: 'Updated Name' };

        await expect(taskService.updateTaskVariant(authContext, params, body)).rejects.toMatchObject({
          statusCode: StatusCodes.NOT_FOUND,
          code: ApiErrorCode.RESOURCE_NOT_FOUND,
          context: {
            userId: 'admin-1',
            taskId: 'nonexistent-task-id',
          },
        });

        expect(taskVariantRepository.getById).not.toHaveBeenCalled();
      });

      it('should throw NOT_FOUND when variant does not exist', async () => {
        const mockTask = TaskFactory.build();

        taskVariantRepository.getTaskIdByVariantId.mockResolvedValueOnce(null);

        const params = { taskId: mockTask.id, variantId: 'nonexistent-variant-id' };
        const body = { name: 'Updated Name' };

        await expect(taskService.updateTaskVariant(authContext, params, body)).rejects.toMatchObject({
          statusCode: StatusCodes.NOT_FOUND,
          code: ApiErrorCode.RESOURCE_NOT_FOUND,
          context: {
            userId: 'admin-1',
            taskId: mockTask.id,
            variantId: 'nonexistent-variant-id',
          },
        });

        expect(taskVariantRepository.runTransaction).not.toHaveBeenCalled();
      });

      it('should throw NOT_FOUND when variant belongs to different task', async () => {
        const mockTask = TaskFactory.build({ id: 'task-123' });
        const mockTaskVariant = TaskVariantFactory.build({ id: 'variant-123', taskId: 'different-task-id' });

        taskVariantRepository.getTaskIdByVariantId.mockResolvedValueOnce({ taskId: 'different-task-id' });

        const params = { taskId: mockTask.id, variantId: mockTaskVariant.id };
        const body = { name: 'Updated Name' };

        await expect(taskService.updateTaskVariant(authContext, params, body)).rejects.toMatchObject({
          statusCode: StatusCodes.NOT_FOUND,
          code: ApiErrorCode.RESOURCE_NOT_FOUND,
          context: {
            userId: 'admin-1',
            taskId: mockTask.id,
            variantId: mockTaskVariant.id,
          },
        });

        expect(taskVariantRepository.runTransaction).not.toHaveBeenCalled();
      });
    });

    describe('conflict errors', () => {
      it('should throw CONFLICT on unique constraint violation during transaction', async () => {
        const mockTask = TaskFactory.build();
        const mockTaskVariant = TaskVariantFactory.build({ taskId: mockTask.id });

        taskVariantRepository.getTaskIdByVariantId.mockResolvedValueOnce({ taskId: mockTask.id });

        const uniqueViolationError = Object.assign(new Error('duplicate key value violates unique constraint'), {
          code: PostgresErrorCode.UNIQUE_VIOLATION,
        });

        taskVariantRepository.runTransaction.mockRejectedValueOnce(uniqueViolationError);

        const params = { taskId: mockTask.id, variantId: mockTaskVariant.id };
        const body = { name: 'Duplicate Name' };

        await expect(taskService.updateTaskVariant(authContext, params, body)).rejects.toMatchObject({
          statusCode: StatusCodes.CONFLICT,
          code: ApiErrorCode.RESOURCE_CONFLICT,
          context: {
            userId: 'admin-1',
            taskId: mockTask.id,
            variantId: mockTaskVariant.id,
            variantName: 'Duplicate Name',
          },
        });
      });
    });

    describe('database errors', () => {
      it('should throw DATABASE_QUERY_FAILED on unexpected database error', async () => {
        const mockTask = TaskFactory.build();
        const mockTaskVariant = TaskVariantFactory.build({ taskId: mockTask.id });

        taskVariantRepository.getTaskIdByVariantId.mockResolvedValueOnce({ taskId: mockTask.id });

        const dbError = new Error('Connection timeout');
        taskVariantRepository.runTransaction.mockRejectedValueOnce(dbError);

        const params = { taskId: mockTask.id, variantId: mockTaskVariant.id };
        const body = { description: 'Updated description' };

        await expect(taskService.updateTaskVariant(authContext, params, body)).rejects.toMatchObject({
          message: 'Failed to update task variant',
          statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
          code: ApiErrorCode.DATABASE_QUERY_FAILED,
          context: {
            userId: 'admin-1',
            taskId: mockTask.id,
            variantId: mockTaskVariant.id,
          },
        });
      });

      it('should propagate ApiError from nested operations', async () => {
        const mockTask = TaskFactory.build();
        const mockTaskVariant = TaskVariantFactory.build({ taskId: mockTask.id });

        taskVariantRepository.getTaskIdByVariantId.mockResolvedValueOnce({ taskId: mockTask.id });

        const nestedApiError = new ApiError('Custom validation error', {
          statusCode: StatusCodes.BAD_REQUEST,
          code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
        });

        taskVariantRepository.runTransaction.mockRejectedValueOnce(nestedApiError);

        const params = { taskId: mockTask.id, variantId: mockTaskVariant.id };
        const body = { name: 'Updated Name' };

        await expect(taskService.updateTaskVariant(authContext, params, body)).rejects.toThrow(nestedApiError);
      });
    });

    describe('edge cases', () => {
      it('should update only description when name is not being updated', async () => {
        const mockTask = TaskFactory.build();
        const mockTaskVariant = TaskVariantFactory.build({ taskId: mockTask.id, name: 'Original Name' });

        taskVariantRepository.getTaskIdByVariantId.mockResolvedValueOnce({ taskId: mockTask.id });
        taskVariantRepository.runTransaction.mockImplementationOnce(async ({ fn }) => {
          return await fn({});
        });
        taskVariantRepository.update.mockResolvedValueOnce();

        const params = { taskId: mockTask.id, variantId: mockTaskVariant.id };
        const body = { description: 'New description' };

        await taskService.updateTaskVariant(authContext, params, body);

        expect(taskVariantRepository.update).toHaveBeenCalledWith({
          id: mockTaskVariant.id,
          data: { description: 'New description' },
          transaction: expect.any(Object),
        });
      });

      it('should skip variant update when only parameters are provided', async () => {
        const mockTask = TaskFactory.build();
        const mockTaskVariant = TaskVariantFactory.build({ taskId: mockTask.id });

        taskVariantRepository.getTaskIdByVariantId.mockResolvedValueOnce({ taskId: mockTask.id });
        taskVariantRepository.runTransaction.mockImplementationOnce(async ({ fn }) => {
          return await fn({});
        });
        taskVariantParameterRepository.deleteByTaskVariantId.mockResolvedValueOnce();
        taskVariantParameterRepository.createMany.mockResolvedValueOnce([{ id: 'param-1' }]);

        const params = { taskId: mockTask.id, variantId: mockTaskVariant.id };
        const body = { parameters: [{ name: 'onlyParam', value: 'onlyValue' }] };

        await taskService.updateTaskVariant(authContext, params, body);

        expect(taskVariantRepository.update).not.toHaveBeenCalled();
        expect(taskVariantParameterRepository.deleteByTaskVariantId).toHaveBeenCalled();
        expect(taskVariantParameterRepository.createMany).toHaveBeenCalled();
      });

      it('should handle updating to all status types', async () => {
        const mockTask = TaskFactory.build();
        const mockTaskVariant = TaskVariantFactory.build({ taskId: mockTask.id });

        for (const status of [TaskVariantStatus.DRAFT, TaskVariantStatus.PUBLISHED, TaskVariantStatus.DEPRECATED]) {
          taskVariantRepository.getTaskIdByVariantId.mockResolvedValueOnce({ taskId: mockTask.id });
          taskVariantRepository.runTransaction.mockImplementationOnce(async ({ fn }) => {
            return await fn({});
          });
          taskVariantRepository.update.mockResolvedValueOnce();

          const params = { taskId: mockTask.id, variantId: mockTaskVariant.id };
          const body = { status };

          const result = await taskService.updateTaskVariant(authContext, params, body);

          expect(result).toBeUndefined();
          expect(taskVariantRepository.update).toHaveBeenCalledWith(
            expect.objectContaining({
              data: { status },
            }),
          );
        }
      });
    });
  });

  describe('evaluateTaskVariantEligibility', () => {
    const createUser = (overrides: Partial<User> = {}): User =>
      ({
        id: 'user-1',
        assessmentPid: 'test-pid',
        userType: 'student',
        grade: '5',
        statusEll: 'active',
        statusIep: null,
        statusFrl: null,
        dob: null,
        gender: null,
        race: null,
        hispanicEthnicity: null,
        homeLanguage: null,
        ...overrides,
      }) as unknown as User;

    describe('assignment (assigned_if) evaluation', () => {
      it('should return isAssigned=true when conditionsAssignment is null (assigned to all)', () => {
        const user = createUser();
        const result = taskService.evaluateTaskVariantEligibility(user, null, null);
        expect(result.isAssigned).toBe(true);
      });

      it('should return isAssigned=true when conditionsAssignment passes', () => {
        const user = createUser({ grade: '5' });
        const conditionsAssignment: Condition = {
          field: 'studentData.grade',
          op: Operator.EQUAL,
          value: 5,
        };
        const result = taskService.evaluateTaskVariantEligibility(user, conditionsAssignment, null);
        expect(result.isAssigned).toBe(true);
      });

      it('should return isAssigned=false when conditionsAssignment fails', () => {
        const user = createUser({ grade: '2' });
        const conditionsAssignment: Condition = {
          field: 'studentData.grade',
          op: Operator.GREATER_THAN_OR_EQUAL,
          value: 3,
        };
        const result = taskService.evaluateTaskVariantEligibility(user, conditionsAssignment, null);
        expect(result.isAssigned).toBe(false);
      });

      it('should return isAssigned=true when conditionsAssignment is SelectAllCondition (true)', () => {
        const user = createUser();
        const result = taskService.evaluateTaskVariantEligibility(user, true, null);
        expect(result.isAssigned).toBe(true);
      });

      it('should return assigned and required when SelectAllCondition for assignment but optional_if fails', () => {
        const user = createUser({ grade: '5', statusEll: 'inactive' });
        const conditionsRequirements: Condition = {
          field: 'studentData.statusEll',
          op: Operator.EQUAL,
          value: 'active',
        };
        const result = taskService.evaluateTaskVariantEligibility(user, true, conditionsRequirements);
        expect(result).toEqual({ isAssigned: true, isOptional: false });
      });
    });

    describe('optional (optional_if) evaluation', () => {
      it('should return isOptional=false when conditionsRequirements is null (required for all)', () => {
        const user = createUser();
        const result = taskService.evaluateTaskVariantEligibility(user, null, null);
        expect(result.isOptional).toBe(false);
      });

      it('should return isOptional=true when conditionsRequirements passes', () => {
        const user = createUser({ grade: '5' });
        const conditionsRequirements: Condition = {
          field: 'studentData.grade',
          op: Operator.EQUAL,
          value: 5,
        };
        const result = taskService.evaluateTaskVariantEligibility(user, null, conditionsRequirements);
        expect(result.isOptional).toBe(true);
      });

      it('should return isOptional=false when conditionsRequirements fails', () => {
        const user = createUser({ grade: '5', statusEll: 'inactive' });
        const conditionsRequirements: Condition = {
          field: 'studentData.statusEll',
          op: Operator.EQUAL,
          value: 'active',
        };
        const result = taskService.evaluateTaskVariantEligibility(user, null, conditionsRequirements);
        expect(result.isOptional).toBe(false);
      });

      it('should not evaluate optional_if when user is not assigned (short-circuit)', () => {
        const user = createUser({ grade: '2' });
        const conditionsAssignment: Condition = {
          field: 'studentData.grade',
          op: Operator.GREATER_THAN_OR_EQUAL,
          value: 3,
        };
        // This condition would pass, but should not be evaluated since user is not assigned
        const conditionsRequirements: Condition = {
          field: 'studentData.grade',
          op: Operator.LESS_THAN,
          value: 5,
        };
        const result = taskService.evaluateTaskVariantEligibility(user, conditionsAssignment, conditionsRequirements);
        expect(result.isAssigned).toBe(false);
        expect(result.isOptional).toBe(false);
      });
    });

    describe('combined scenarios', () => {
      it('should return assigned and required when both conditions are null', () => {
        const user = createUser();
        const result = taskService.evaluateTaskVariantEligibility(user, null, null);
        expect(result).toEqual({ isAssigned: true, isOptional: false });
      });

      it('should return assigned and optional when assignment passes and optional_if passes', () => {
        const user = createUser({ grade: '5', statusEll: 'active' });
        const conditionsAssignment: Condition = {
          field: 'studentData.grade',
          op: Operator.GREATER_THAN_OR_EQUAL,
          value: 3,
        };
        const conditionsRequirements: Condition = {
          field: 'studentData.statusEll',
          op: Operator.EQUAL,
          value: 'active',
        };
        const result = taskService.evaluateTaskVariantEligibility(user, conditionsAssignment, conditionsRequirements);
        expect(result).toEqual({ isAssigned: true, isOptional: true });
      });

      it('should return assigned and required when assignment passes but optional_if fails', () => {
        const user = createUser({ grade: '5', statusEll: 'inactive' });
        const conditionsAssignment: Condition = {
          field: 'studentData.grade',
          op: Operator.EQUAL,
          value: 5,
        };
        const conditionsRequirements: Condition = {
          field: 'studentData.statusEll',
          op: Operator.EQUAL,
          value: 'active',
        };
        const result = taskService.evaluateTaskVariantEligibility(user, conditionsAssignment, conditionsRequirements);
        expect(result).toEqual({ isAssigned: true, isOptional: false });
      });

      it('should return not assigned when assignment fails regardless of optional_if', () => {
        const user = createUser({ grade: '2', statusEll: 'active' });
        const conditionsAssignment: Condition = {
          field: 'studentData.grade',
          op: Operator.GREATER_THAN_OR_EQUAL,
          value: 3,
        };
        // This would pass if evaluated
        const conditionsRequirements: Condition = {
          field: 'studentData.statusEll',
          op: Operator.EQUAL,
          value: 'active',
        };
        const result = taskService.evaluateTaskVariantEligibility(user, conditionsAssignment, conditionsRequirements);
        expect(result).toEqual({ isAssigned: false, isOptional: false });
      });
    });

    describe('comparison operators', () => {
      it('should handle EQUAL operator', () => {
        const user = createUser({ grade: '5' });
        const condition: Condition = { field: 'studentData.grade', op: Operator.EQUAL, value: 5 };
        expect(taskService.evaluateTaskVariantEligibility(user, condition, null).isAssigned).toBe(true);

        const user2 = createUser({ grade: '3' });
        expect(taskService.evaluateTaskVariantEligibility(user2, condition, null).isAssigned).toBe(false);
      });

      it('should handle NOT_EQUAL operator', () => {
        const user = createUser({ grade: '3' });
        const condition: Condition = { field: 'studentData.grade', op: Operator.NOT_EQUAL, value: 5 };
        expect(taskService.evaluateTaskVariantEligibility(user, condition, null).isAssigned).toBe(true);

        const user2 = createUser({ grade: '5' });
        expect(taskService.evaluateTaskVariantEligibility(user2, condition, null).isAssigned).toBe(false);
      });

      it('should handle LESS_THAN operator', () => {
        const user = createUser({ grade: '3' });
        const condition: Condition = { field: 'studentData.grade', op: Operator.LESS_THAN, value: 5 };
        expect(taskService.evaluateTaskVariantEligibility(user, condition, null).isAssigned).toBe(true);

        const user2 = createUser({ grade: '5' });
        expect(taskService.evaluateTaskVariantEligibility(user2, condition, null).isAssigned).toBe(false);

        const user3 = createUser({ grade: '7' });
        expect(taskService.evaluateTaskVariantEligibility(user3, condition, null).isAssigned).toBe(false);
      });

      it('should handle GREATER_THAN operator', () => {
        const user = createUser({ grade: '7' });
        const condition: Condition = { field: 'studentData.grade', op: Operator.GREATER_THAN, value: 5 };
        expect(taskService.evaluateTaskVariantEligibility(user, condition, null).isAssigned).toBe(true);

        const user2 = createUser({ grade: '5' });
        expect(taskService.evaluateTaskVariantEligibility(user2, condition, null).isAssigned).toBe(false);
      });

      it('should handle LESS_THAN_OR_EQUAL operator', () => {
        const condition: Condition = { field: 'studentData.grade', op: Operator.LESS_THAN_OR_EQUAL, value: 5 };

        const user1 = createUser({ grade: '3' });
        expect(taskService.evaluateTaskVariantEligibility(user1, condition, null).isAssigned).toBe(true);

        const user2 = createUser({ grade: '5' });
        expect(taskService.evaluateTaskVariantEligibility(user2, condition, null).isAssigned).toBe(true);

        const user3 = createUser({ grade: '7' });
        expect(taskService.evaluateTaskVariantEligibility(user3, condition, null).isAssigned).toBe(false);
      });

      it('should handle GREATER_THAN_OR_EQUAL operator', () => {
        const condition: Condition = { field: 'studentData.grade', op: Operator.GREATER_THAN_OR_EQUAL, value: 5 };

        const user1 = createUser({ grade: '7' });
        expect(taskService.evaluateTaskVariantEligibility(user1, condition, null).isAssigned).toBe(true);

        const user2 = createUser({ grade: '5' });
        expect(taskService.evaluateTaskVariantEligibility(user2, condition, null).isAssigned).toBe(true);

        const user3 = createUser({ grade: '3' });
        expect(taskService.evaluateTaskVariantEligibility(user3, condition, null).isAssigned).toBe(false);
      });
    });

    describe('field types', () => {
      it('should handle string field comparisons', () => {
        const user = createUser({ statusEll: 'active' });
        const condition: Condition = { field: 'studentData.statusEll', op: Operator.EQUAL, value: 'active' };
        expect(taskService.evaluateTaskVariantEligibility(user, condition, null).isAssigned).toBe(true);
      });

      it('should handle boolean field comparisons', () => {
        const user = createUser({ hispanicEthnicity: true });
        const condition: Condition = { field: 'studentData.hispanicEthnicity', op: Operator.EQUAL, value: true };
        expect(taskService.evaluateTaskVariantEligibility(user, condition, null).isAssigned).toBe(true);
      });

      it('should return not assigned when field is null', () => {
        const user = createUser({ grade: null });
        const condition: Condition = { field: 'studentData.grade', op: Operator.EQUAL, value: 5 };
        expect(taskService.evaluateTaskVariantEligibility(user, condition, null).isAssigned).toBe(false);
      });

      it('should return not assigned when field is undefined', () => {
        // Create user without setting statusFrl (effectively undefined in the condition data)
        const user = createUser({ statusFrl: null });
        const condition: Condition = { field: 'studentData.statusFrl', op: Operator.EQUAL, value: 'eligible' };
        expect(taskService.evaluateTaskVariantEligibility(user, condition, null).isAssigned).toBe(false);
      });
    });

    describe('grade conversion', () => {
      it('should convert Kindergarten grade to 0', () => {
        const user = createUser({ grade: 'Kindergarten' });
        const condition: Condition = { field: 'studentData.grade', op: Operator.EQUAL, value: 0 };
        expect(taskService.evaluateTaskVariantEligibility(user, condition, null).isAssigned).toBe(true);
      });

      it('should convert PreKindergarten grade to 0', () => {
        const user = createUser({ grade: 'PreKindergarten' });
        const condition: Condition = { field: 'studentData.grade', op: Operator.EQUAL, value: 0 };
        expect(taskService.evaluateTaskVariantEligibility(user, condition, null).isAssigned).toBe(true);
      });

      it('should convert TransitionalKindergarten grade to 0', () => {
        const user = createUser({ grade: 'TransitionalKindergarten' });
        const condition: Condition = { field: 'studentData.grade', op: Operator.EQUAL, value: 0 };
        expect(taskService.evaluateTaskVariantEligibility(user, condition, null).isAssigned).toBe(true);
      });

      it('should convert InfantToddler grade to 0', () => {
        const user = createUser({ grade: 'InfantToddler' });
        const condition: Condition = { field: 'studentData.grade', op: Operator.EQUAL, value: 0 };
        expect(taskService.evaluateTaskVariantEligibility(user, condition, null).isAssigned).toBe(true);
      });

      it('should convert Preschool grade to 0', () => {
        const user = createUser({ grade: 'Preschool' });
        const condition: Condition = { field: 'studentData.grade', op: Operator.EQUAL, value: 0 };
        expect(taskService.evaluateTaskVariantEligibility(user, condition, null).isAssigned).toBe(true);
      });

      it('should convert PostGraduate grade to 13', () => {
        const user = createUser({ grade: 'PostGraduate' });
        const condition: Condition = { field: 'studentData.grade', op: Operator.EQUAL, value: 13 };
        expect(taskService.evaluateTaskVariantEligibility(user, condition, null).isAssigned).toBe(true);
      });

      it('should convert numeric string grades correctly', () => {
        const user = createUser({ grade: '5' });
        const condition: Condition = { field: 'studentData.grade', op: Operator.EQUAL, value: 5 };
        expect(taskService.evaluateTaskVariantEligibility(user, condition, null).isAssigned).toBe(true);
      });

      it('should handle grade comparison with string value in condition', () => {
        const user = createUser({ grade: '5' });
        const condition: Condition = { field: 'studentData.grade', op: Operator.EQUAL, value: '5' };
        expect(taskService.evaluateTaskVariantEligibility(user, condition, null).isAssigned).toBe(true);
      });

      it('should handle grade comparison with Kindergarten string in condition', () => {
        const user = createUser({ grade: 'Kindergarten' });
        const condition: Condition = { field: 'studentData.grade', op: Operator.EQUAL, value: 'Kindergarten' };
        expect(taskService.evaluateTaskVariantEligibility(user, condition, null).isAssigned).toBe(true);
      });

      it('should return not assigned for invalid grade values', () => {
        // Use 'as unknown as User' to simulate invalid data that might come from external sources
        const user = createUser({ grade: 'InvalidGrade' as User['grade'] });
        const condition: Condition = { field: 'studentData.grade', op: Operator.EQUAL, value: 5 };
        expect(taskService.evaluateTaskVariantEligibility(user, condition, null).isAssigned).toBe(false);
      });

      it('should return not assigned when user grade is null', () => {
        const user = createUser({ grade: null });
        const condition: Condition = { field: 'studentData.grade', op: Operator.GREATER_THAN_OR_EQUAL, value: 3 };
        expect(taskService.evaluateTaskVariantEligibility(user, condition, null).isAssigned).toBe(false);
      });
    });

    describe('composite conditions - AND', () => {
      it('should return assigned when all AND conditions pass', () => {
        const user = createUser({ grade: '5', statusEll: 'active' });
        const condition: Condition = {
          op: 'AND',
          conditions: [
            { field: 'studentData.grade', op: Operator.EQUAL, value: 5 },
            { field: 'studentData.statusEll', op: Operator.EQUAL, value: 'active' },
          ],
        };
        expect(taskService.evaluateTaskVariantEligibility(user, condition, null).isAssigned).toBe(true);
      });

      it('should return not assigned when any AND condition fails', () => {
        const user = createUser({ grade: '5', statusEll: 'inactive' });
        const condition: Condition = {
          op: 'AND',
          conditions: [
            { field: 'studentData.grade', op: Operator.EQUAL, value: 5 },
            { field: 'studentData.statusEll', op: Operator.EQUAL, value: 'active' },
          ],
        };
        expect(taskService.evaluateTaskVariantEligibility(user, condition, null).isAssigned).toBe(false);
      });

      it('should return assigned for empty AND conditions array', () => {
        const user = createUser();
        const condition: Condition = { op: 'AND', conditions: [] };
        expect(taskService.evaluateTaskVariantEligibility(user, condition, null).isAssigned).toBe(true);
      });
    });

    describe('composite conditions - OR', () => {
      it('should return assigned when any OR condition passes', () => {
        const user = createUser({ grade: '5', statusEll: 'inactive' });
        const condition: Condition = {
          op: 'OR',
          conditions: [
            { field: 'studentData.grade', op: Operator.EQUAL, value: 5 },
            { field: 'studentData.statusEll', op: Operator.EQUAL, value: 'active' },
          ],
        };
        expect(taskService.evaluateTaskVariantEligibility(user, condition, null).isAssigned).toBe(true);
      });

      it('should return not assigned when all OR conditions fail', () => {
        const user = createUser({ grade: '3', statusEll: 'inactive' });
        const condition: Condition = {
          op: 'OR',
          conditions: [
            { field: 'studentData.grade', op: Operator.EQUAL, value: 5 },
            { field: 'studentData.statusEll', op: Operator.EQUAL, value: 'active' },
          ],
        };
        expect(taskService.evaluateTaskVariantEligibility(user, condition, null).isAssigned).toBe(false);
      });

      it('should return not assigned for empty OR conditions array', () => {
        const user = createUser();
        const condition: Condition = { op: 'OR', conditions: [] };
        expect(taskService.evaluateTaskVariantEligibility(user, condition, null).isAssigned).toBe(false);
      });
    });

    describe('nested composite conditions', () => {
      it('should handle nested AND within OR', () => {
        const user = createUser({ grade: '5', statusEll: 'active', statusIep: 'yes' });
        const condition: Condition = {
          op: 'OR',
          conditions: [
            {
              op: 'AND',
              conditions: [
                { field: 'studentData.grade', op: Operator.EQUAL, value: 5 },
                { field: 'studentData.statusEll', op: Operator.EQUAL, value: 'active' },
              ],
            },
            { field: 'studentData.statusIep', op: Operator.EQUAL, value: 'no' },
          ],
        };
        expect(taskService.evaluateTaskVariantEligibility(user, condition, null).isAssigned).toBe(true);
      });

      it('should handle nested OR within AND', () => {
        const user = createUser({ grade: '5', statusEll: 'inactive', statusIep: 'yes' });
        const condition: Condition = {
          op: 'AND',
          conditions: [
            { field: 'studentData.grade', op: Operator.EQUAL, value: 5 },
            {
              op: 'OR',
              conditions: [
                { field: 'studentData.statusEll', op: Operator.EQUAL, value: 'active' },
                { field: 'studentData.statusIep', op: Operator.EQUAL, value: 'yes' },
              ],
            },
          ],
        };
        expect(taskService.evaluateTaskVariantEligibility(user, condition, null).isAssigned).toBe(true);
      });

      it('should handle complex grade range conditions', () => {
        const user = createUser({ grade: '5' });
        const condition: Condition = {
          op: 'AND',
          conditions: [
            { field: 'studentData.grade', op: Operator.GREATER_THAN_OR_EQUAL, value: 3 },
            { field: 'studentData.grade', op: Operator.LESS_THAN_OR_EQUAL, value: 8 },
          ],
        };
        expect(taskService.evaluateTaskVariantEligibility(user, condition, null).isAssigned).toBe(true);

        const user2 = createUser({ grade: '2' });
        expect(taskService.evaluateTaskVariantEligibility(user2, condition, null).isAssigned).toBe(false);

        const user3 = createUser({ grade: '9' });
        expect(taskService.evaluateTaskVariantEligibility(user3, condition, null).isAssigned).toBe(false);
      });
    });

    describe('complex eligibility and optionality', () => {
      it('should handle complex composite conditions for both assignment and optionality', () => {
        const user = createUser({ grade: '5', statusEll: 'active' });
        const conditionsAssignment: Condition = {
          op: 'AND',
          conditions: [
            { field: 'studentData.grade', op: Operator.GREATER_THAN_OR_EQUAL, value: 3 },
            { field: 'studentData.grade', op: Operator.LESS_THAN_OR_EQUAL, value: 8 },
          ],
        };
        const conditionsRequirements: Condition = {
          op: 'OR',
          conditions: [
            { field: 'studentData.statusEll', op: Operator.EQUAL, value: 'active' },
            { field: 'studentData.statusIep', op: Operator.EQUAL, value: 'yes' },
          ],
        };
        const result = taskService.evaluateTaskVariantEligibility(user, conditionsAssignment, conditionsRequirements);
        expect(result).toEqual({ isAssigned: true, isOptional: true });
      });

      it('should return not assigned with complex conditions when user does not match', () => {
        const user = createUser({ grade: '2', statusEll: 'active' });
        const conditionsAssignment: Condition = {
          op: 'AND',
          conditions: [
            { field: 'studentData.grade', op: Operator.GREATER_THAN_OR_EQUAL, value: 3 },
            { field: 'studentData.grade', op: Operator.LESS_THAN_OR_EQUAL, value: 8 },
          ],
        };
        const conditionsRequirements: Condition = {
          field: 'studentData.statusEll',
          op: Operator.EQUAL,
          value: 'active',
        };
        const result = taskService.evaluateTaskVariantEligibility(user, conditionsAssignment, conditionsRequirements);
        expect(result).toEqual({ isAssigned: false, isOptional: false });
      });
    });
  });

  describe('list', () => {
    describe('successful listing', () => {
      it('should return paginated tasks with default options', async () => {
        const mockTasks = [TaskFactory.build(), TaskFactory.build()];
        taskRepository.listAll.mockResolvedValue({
          items: mockTasks,
          totalItems: 2,
        });

        const options = { page: 1, perPage: 25 };
        const result = await taskService.list(authContext, options);

        expect(result).toEqual({
          items: mockTasks,
          totalItems: 2,
        });
        expect(taskRepository.listAll).toHaveBeenCalledWith(options);
      });

      it('should pass sorting options to repository', async () => {
        const mockTasks = [TaskFactory.build()];
        taskRepository.listAll.mockResolvedValue({
          items: mockTasks,
          totalItems: 1,
        });

        const options = {
          page: 1,
          perPage: 10,
          orderBy: { field: TaskSortField.NAME, direction: SortOrder.ASC },
        };
        const result = await taskService.list(authContext, options);

        expect(result.items).toHaveLength(1);
        expect(taskRepository.listAll).toHaveBeenCalledWith(options);
      });

      it('should pass slug filter to repository', async () => {
        const mockTask = TaskFactory.build({ slug: 'swr' });
        taskRepository.listAll.mockResolvedValue({
          items: [mockTask],
          totalItems: 1,
        });

        const options = { page: 1, perPage: 25, slug: 'swr' };
        const result = await taskService.list(authContext, options);

        expect(result.items).toHaveLength(1);
        expect(result.items[0]?.slug).toBe('swr');
        expect(taskRepository.listAll).toHaveBeenCalledWith(options);
      });

      it('should pass search filter to repository', async () => {
        const mockTasks = [
          TaskFactory.build({ name: 'Single Word Reading' }),
          TaskFactory.build({ name: 'Phonological Reading' }),
        ];
        taskRepository.listAll.mockResolvedValue({
          items: mockTasks,
          totalItems: 2,
        });

        const options = { page: 1, perPage: 25, search: 'Reading' };
        const result = await taskService.list(authContext, options);

        expect(result.items).toHaveLength(2);
        expect(taskRepository.listAll).toHaveBeenCalledWith(options);
      });

      it('should return empty list when no tasks match', async () => {
        taskRepository.listAll.mockResolvedValue({
          items: [],
          totalItems: 0,
        });

        const options = { page: 1, perPage: 25, slug: 'nonexistent' };
        const result = await taskService.list(authContext, options);

        expect(result.items).toHaveLength(0);
        expect(result.totalItems).toBe(0);
      });

      it('should handle pagination correctly', async () => {
        const mockTasks = [TaskFactory.build()];
        taskRepository.listAll.mockResolvedValue({
          items: mockTasks,
          totalItems: 100,
        });

        const options = { page: 5, perPage: 10 };
        const result = await taskService.list(authContext, options);

        expect(result.items).toHaveLength(1);
        expect(result.totalItems).toBe(100);
        expect(taskRepository.listAll).toHaveBeenCalledWith({ page: 5, perPage: 10 });
      });
    });

    describe('authorization', () => {
      it('should allow non-super-admin users to list tasks', async () => {
        const nonAdminContext: AuthContext = { userId: 'user-1', isSuperAdmin: false };
        const mockTasks = [TaskFactory.build()];
        taskRepository.listAll.mockResolvedValue({
          items: mockTasks,
          totalItems: 1,
        });

        const options = { page: 1, perPage: 25 };
        const result = await taskService.list(nonAdminContext, options);

        // Tasks are global resources - all authenticated users can view them
        expect(result.items).toHaveLength(1);
        expect(taskRepository.listAll).toHaveBeenCalled();
      });
    });

    describe('error handling', () => {
      it('should wrap database errors in ApiError', async () => {
        const dbError = new Error('Connection timeout');
        taskRepository.listAll.mockRejectedValue(dbError);

        const options = { page: 1, perPage: 25 };

        await expect(taskService.list(authContext, options)).rejects.toMatchObject({
          message: ApiErrorMessage.INTERNAL_SERVER_ERROR,
          statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
          code: ApiErrorCode.DATABASE_QUERY_FAILED,
          context: { userId: 'admin-1' },
          cause: dbError,
        });
      });

      it('should propagate existing ApiErrors', async () => {
        const apiError = new ApiError('Custom error', {
          statusCode: StatusCodes.BAD_REQUEST,
          code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
        });
        taskRepository.listAll.mockRejectedValue(apiError);

        const options = { page: 1, perPage: 25 };

        await expect(taskService.list(authContext, options)).rejects.toThrow(apiError);
      });
    });
  });

  describe('getById', () => {
    const validTaskId = '123e4567-e89b-12d3-a456-426614174000';

    describe('successful retrieval with UUID', () => {
      it('should return task when found by valid UUID', async () => {
        const mockTask = TaskFactory.build({ id: validTaskId });
        taskRepository.getById.mockResolvedValue(mockTask);

        const result = await taskService.getById(authContext, validTaskId);

        expect(result).toEqual(mockTask);
        expect(taskRepository.getById).toHaveBeenCalledWith({ id: validTaskId });
      });

      it('should allow non-super-admin users to get task by ID', async () => {
        const nonAdminContext: AuthContext = { userId: 'user-1', isSuperAdmin: false };
        const mockTask = TaskFactory.build({ id: validTaskId });
        taskRepository.getById.mockResolvedValue(mockTask);

        const result = await taskService.getById(nonAdminContext, validTaskId);

        // Tasks are global resources - all authenticated users can view them
        expect(result).toEqual(mockTask);
        expect(taskRepository.getById).toHaveBeenCalledWith({ id: validTaskId });
      });
    });

    describe('successful retrieval with task slug', () => {
      it('should return task when found by slug', async () => {
        const taskSlug = 'swr';
        const mockTask = TaskFactory.build({ slug: taskSlug });
        taskRepository.getBySlug.mockResolvedValue(mockTask);

        const result = await taskService.getById(authContext, taskSlug);

        expect(result).toEqual(mockTask);
        expect(taskRepository.getBySlug).toHaveBeenCalledWith(taskSlug);
        expect(taskRepository.getById).not.toHaveBeenCalled();
      });

      it('should allow non-super-admin users to get task by slug', async () => {
        const nonAdminContext: AuthContext = { userId: 'user-1', isSuperAdmin: false };
        const taskSlug = 'letter-task';
        const mockTask = TaskFactory.build({ slug: taskSlug });
        taskRepository.getBySlug.mockResolvedValue(mockTask);

        const result = await taskService.getById(nonAdminContext, taskSlug);

        // Tasks are global resources - all authenticated users can view them
        expect(result).toEqual(mockTask);
        expect(taskRepository.getBySlug).toHaveBeenCalledWith(taskSlug);
      });
    });

    describe('not found', () => {
      it('should throw NOT_FOUND when task does not exist by UUID', async () => {
        taskRepository.getById.mockResolvedValue(null);

        await expect(taskService.getById(authContext, validTaskId)).rejects.toMatchObject({
          message: ApiErrorMessage.NOT_FOUND,
          statusCode: StatusCodes.NOT_FOUND,
          code: ApiErrorCode.RESOURCE_NOT_FOUND,
          context: { userId: 'admin-1', taskId: validTaskId },
        });
      });

      it('should throw NOT_FOUND when task does not exist by slug', async () => {
        const taskSlug = 'nonexistent-slug';
        taskRepository.getBySlug.mockResolvedValue(null);

        await expect(taskService.getById(authContext, taskSlug)).rejects.toMatchObject({
          message: ApiErrorMessage.NOT_FOUND,
          statusCode: StatusCodes.NOT_FOUND,
          code: ApiErrorCode.RESOURCE_NOT_FOUND,
          context: { userId: 'admin-1', taskId: taskSlug },
        });
      });
    });

    describe('UUID vs slug detection', () => {
      it('should use getById for UUID-formatted task ID', async () => {
        const mockTask = TaskFactory.build({ id: validTaskId });
        taskRepository.getById.mockResolvedValue(mockTask);

        await taskService.getById(authContext, validTaskId);

        expect(taskRepository.getById).toHaveBeenCalledWith({ id: validTaskId });
        expect(taskRepository.getBySlug).not.toHaveBeenCalled();
      });

      it('should use getBySlug for non-UUID formatted task ID', async () => {
        const slug = 'reading-comprehension';
        const mockTask = TaskFactory.build({ slug });
        taskRepository.getBySlug.mockResolvedValue(mockTask);

        await taskService.getById(authContext, slug);

        expect(taskRepository.getBySlug).toHaveBeenCalledWith(slug);
        expect(taskRepository.getById).not.toHaveBeenCalled();
      });

      it('should handle case-sensitive slug lookup', async () => {
        const taskWithLowerSlug = TaskFactory.build({ slug: 'swr' });
        taskRepository.getBySlug.mockImplementation((slug) => {
          if (slug === 'swr') return Promise.resolve(taskWithLowerSlug);
          return Promise.resolve(null);
        });

        // Lowercase slug should work
        const result = await taskService.getById(authContext, 'swr');
        expect(result.slug).toBe('swr');

        // Uppercase slug should fail (not found)
        await expect(taskService.getById(authContext, 'SWR')).rejects.toMatchObject({
          statusCode: StatusCodes.NOT_FOUND,
          code: ApiErrorCode.RESOURCE_NOT_FOUND,
        });

        // Mixed case slug should fail (not found)
        await expect(taskService.getById(authContext, 'SwR')).rejects.toMatchObject({
          statusCode: StatusCodes.NOT_FOUND,
          code: ApiErrorCode.RESOURCE_NOT_FOUND,
        });
      });
    });

    describe('error handling', () => {
      it('should wrap database errors in ApiError', async () => {
        const dbError = new Error('Connection timeout');
        taskRepository.getById.mockRejectedValue(dbError);

        await expect(taskService.getById(authContext, validTaskId)).rejects.toMatchObject({
          message: ApiErrorMessage.INTERNAL_SERVER_ERROR,
          statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
          code: ApiErrorCode.DATABASE_QUERY_FAILED,
          context: { userId: 'admin-1', taskId: validTaskId },
          cause: dbError,
        });
      });

      it('should propagate existing ApiErrors', async () => {
        const apiError = new ApiError('Custom error', {
          statusCode: StatusCodes.BAD_REQUEST,
          code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
        });
        taskRepository.getById.mockRejectedValue(apiError);

        await expect(taskService.getById(authContext, validTaskId)).rejects.toThrow(apiError);
      });
    });
  });

  describe('create', () => {
    const validCreateData = {
      slug: 'new-task',
      name: 'New Task',
      nameSimple: 'New',
      nameTechnical: 'new-task-technical',
      taskConfig: { difficulty: 'easy' },
      description: 'A new task',
      image: 'https://example.com/image.png',
      tutorialVideo: 'https://example.com/video.mp4',
    };

    describe('successful creation', () => {
      it('should create a new task with all fields', async () => {
        const mockCreatedTask = { id: 'new-task-id' };
        taskRepository.create.mockResolvedValueOnce(mockCreatedTask);

        const result = await taskService.create(authContext, validCreateData);

        expect(result).toEqual({ id: 'new-task-id' });
        expect(taskRepository.create).toHaveBeenCalledWith({
          data: {
            slug: 'new-task',
            name: 'New Task',
            nameSimple: 'New',
            nameTechnical: 'new-task-technical',
            taskConfig: { difficulty: 'easy' },
            description: 'A new task',
            image: 'https://example.com/image.png',
            tutorialVideo: 'https://example.com/video.mp4',
          },
        });
      });

      it('should create a task with only required fields', async () => {
        const mockCreatedTask = { id: 'minimal-task-id' };
        taskRepository.create.mockResolvedValueOnce(mockCreatedTask);

        const minimalData = {
          slug: 'minimal-task',
          name: 'Minimal Task',
          nameSimple: 'Minimal',
          nameTechnical: 'minimal-technical',
          taskConfig: {},
        };

        const result = await taskService.create(authContext, minimalData);

        expect(result).toEqual({ id: 'minimal-task-id' });
        expect(taskRepository.create).toHaveBeenCalledWith({
          data: {
            slug: 'minimal-task',
            name: 'Minimal Task',
            nameSimple: 'Minimal',
            nameTechnical: 'minimal-technical',
            taskConfig: {},
          },
        });
      });
    });

    describe('authorization', () => {
      it('should throw FORBIDDEN error when user is not super admin', async () => {
        const nonAdminContext: AuthContext = { userId: 'user-1', isSuperAdmin: false };

        await expect(taskService.create(nonAdminContext, validCreateData)).rejects.toMatchObject({
          message: ApiErrorMessage.FORBIDDEN,
          statusCode: StatusCodes.FORBIDDEN,
          code: ApiErrorCode.AUTH_FORBIDDEN,
          context: { userId: 'user-1', isSuperAdmin: false },
        });

        expect(taskRepository.create).not.toHaveBeenCalled();
      });
    });

    describe('error handling', () => {
      it('should throw CONFLICT error when slug already exists', async () => {
        const uniqueViolationError = new Error('duplicate key value');
        (uniqueViolationError as Error & { code: string }).code = PostgresErrorCode.UNIQUE_VIOLATION;
        taskRepository.create.mockRejectedValueOnce(uniqueViolationError);

        await expect(taskService.create(authContext, validCreateData)).rejects.toMatchObject({
          message: ApiErrorMessage.CONFLICT,
          statusCode: StatusCodes.CONFLICT,
          code: ApiErrorCode.RESOURCE_CONFLICT,
          context: { userId: 'admin-1', slug: 'new-task' },
        });
      });

      it('should throw INTERNAL_SERVER_ERROR for unexpected database errors', async () => {
        const dbError = new Error('Database connection failed');
        taskRepository.create.mockRejectedValueOnce(dbError);

        await expect(taskService.create(authContext, validCreateData)).rejects.toMatchObject({
          message: ApiErrorMessage.INTERNAL_SERVER_ERROR,
          statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
          code: ApiErrorCode.DATABASE_QUERY_FAILED,
          context: { userId: 'admin-1', slug: 'new-task' },
          cause: dbError,
        });
      });

      it('should propagate existing ApiErrors', async () => {
        const apiError = new ApiError('Custom error', {
          statusCode: StatusCodes.BAD_REQUEST,
          code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
        });
        taskRepository.create.mockRejectedValueOnce(apiError);

        await expect(taskService.create(authContext, validCreateData)).rejects.toThrow(apiError);
      });
    });
  });

  describe('update', () => {
    const validTaskId = '123e4567-e89b-12d3-a456-426614174000';
    const taskSlug = 'existing-task';
    const mockTask = TaskFactory.build({ id: validTaskId, slug: taskSlug });

    describe('authorization', () => {
      it('should throw FORBIDDEN when user is not super admin', async () => {
        const nonAdminContext: AuthContext = { userId: 'user-1', isSuperAdmin: false };

        await expect(taskService.update(nonAdminContext, validTaskId, { name: 'Updated Name' })).rejects.toMatchObject({
          message: ApiErrorMessage.FORBIDDEN,
          statusCode: StatusCodes.FORBIDDEN,
          code: ApiErrorCode.AUTH_FORBIDDEN,
        });
      });
    });

    describe('validation', () => {
      it('should throw 422 when there are no mutable fields', async () => {
        await expect(taskService.update(authContext, validTaskId, {})).rejects.toMatchObject({
          message: ApiErrorMessage.REQUEST_VALIDATION_FAILED,
          statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
          code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
        });
      });
    });

    describe('not found', () => {
      it('should throw NOT_FOUND when task does not exist by UUID', async () => {
        taskRepository.getById.mockResolvedValue(null);

        await expect(taskService.update(authContext, validTaskId, { name: 'Updated Name' })).rejects.toMatchObject({
          message: ApiErrorMessage.NOT_FOUND,
          statusCode: StatusCodes.NOT_FOUND,
          code: ApiErrorCode.RESOURCE_NOT_FOUND,
        });
      });
    });

    describe('successful update', () => {
      it('should update task when looked up by UUID', async () => {
        taskRepository.getById.mockResolvedValue(mockTask);
        taskRepository.update.mockResolvedValue();

        const result = await taskService.update(authContext, validTaskId, { name: 'Updated Name' });

        expect(result).toEqual({ id: validTaskId });
        expect(taskRepository.getById).toHaveBeenCalledWith({ id: validTaskId });
        expect(taskRepository.update).toHaveBeenCalledWith({
          id: validTaskId,
          data: { name: 'Updated Name' },
        });
      });

      it('should update task when looked up by slug', async () => {
        taskRepository.getBySlug.mockResolvedValue(mockTask);
        taskRepository.update.mockResolvedValue();

        const result = await taskService.update(authContext, taskSlug, { description: null });

        expect(result).toEqual({ id: validTaskId });
        expect(taskRepository.getBySlug).toHaveBeenCalledWith(taskSlug);
        expect(taskRepository.update).toHaveBeenCalledWith({
          id: validTaskId,
          data: { description: null },
        });
      });
    });
  });

  describe('listTaskVariants', () => {
    const validTaskId = '123e4567-e89b-12d3-a456-426614174000';
    const mockTask = TaskFactory.build({
      id: validTaskId,
      name: 'Test Task',
      slug: 'test-task',
      image: 'https://example.com/image.png',
    });

    const mockVariants = [
      TaskVariantFactory.build({ id: 'variant-1', taskId: validTaskId, status: TaskVariantStatus.PUBLISHED }),
      TaskVariantFactory.build({ id: 'variant-2', taskId: validTaskId, status: TaskVariantStatus.DRAFT }),
    ];

    const mockParams = [
      TaskVariantParameterFactory.build({ taskVariantId: 'variant-1', name: 'difficulty', value: 'easy' }),
      TaskVariantParameterFactory.build({ taskVariantId: 'variant-1', name: 'timeLimit', value: 60 }),
      TaskVariantParameterFactory.build({ taskVariantId: 'variant-2', name: 'mode', value: 'practice' }),
    ];

    const defaultOptions = {
      page: 1,
      perPage: 25,
      orderBy: { field: 'name' as const, direction: SortOrder.ASC },
    };

    describe('successful retrieval with UUID', () => {
      it('should return variants with parameters for super admin', async () => {
        taskRepository.getById.mockResolvedValue(mockTask);
        taskVariantRepository.listByTaskId.mockResolvedValue({
          items: mockVariants,
          totalItems: 2,
        });
        taskVariantParameterRepository.getByTaskVariantIds.mockResolvedValue(mockParams);

        const result = await taskService.listTaskVariants(authContext, validTaskId, defaultOptions);

        expect(result.items).toHaveLength(2);
        expect(result.totalItems).toBe(2);
        expect(result.task).toEqual({
          name: 'Test Task',
          slug: 'test-task',
          image: 'https://example.com/image.png',
        });

        // Verify parameters are grouped correctly
        const variant1 = result.items.find((v) => v.id === 'variant-1');
        const variant2 = result.items.find((v) => v.id === 'variant-2');
        expect(variant1?.parameters).toHaveLength(2);
        expect(variant2?.parameters).toHaveLength(1);
      });

      it('should call repository with no status filter for super admin without status option', async () => {
        taskRepository.getById.mockResolvedValue(mockTask);
        taskVariantRepository.listByTaskId.mockResolvedValue({ items: [], totalItems: 0 });
        taskVariantParameterRepository.getByTaskVariantIds.mockResolvedValue([]);

        await taskService.listTaskVariants(authContext, validTaskId, defaultOptions);

        expect(taskVariantRepository.listByTaskId).toHaveBeenCalledWith({ taskId: validTaskId }, defaultOptions);
      });

      it('should call repository with status filter for super admin with status option', async () => {
        taskRepository.getById.mockResolvedValue(mockTask);
        taskVariantRepository.listByTaskId.mockResolvedValue({ items: [], totalItems: 0 });
        taskVariantParameterRepository.getByTaskVariantIds.mockResolvedValue([]);

        const optionsWithStatus = { ...defaultOptions, status: 'draft' as const };
        await taskService.listTaskVariants(authContext, validTaskId, optionsWithStatus);

        expect(taskVariantRepository.listByTaskId).toHaveBeenCalledWith(
          { taskId: validTaskId, status: 'draft' },
          optionsWithStatus,
        );
      });

      it('should force published status for non-super admin', async () => {
        const nonAdminContext: AuthContext = { userId: 'user-1', isSuperAdmin: false };
        taskRepository.getById.mockResolvedValue(mockTask);
        taskVariantRepository.listByTaskId.mockResolvedValue({ items: [], totalItems: 0 });
        taskVariantParameterRepository.getByTaskVariantIds.mockResolvedValue([]);

        await taskService.listTaskVariants(nonAdminContext, validTaskId, defaultOptions);

        expect(taskVariantRepository.listByTaskId).toHaveBeenCalledWith(
          { taskId: validTaskId, status: 'published' },
          defaultOptions,
        );
      });

      it('should ignore status option for non-super admin and force published', async () => {
        const nonAdminContext: AuthContext = { userId: 'user-1', isSuperAdmin: false };
        taskRepository.getById.mockResolvedValue(mockTask);
        taskVariantRepository.listByTaskId.mockResolvedValue({ items: [], totalItems: 0 });
        taskVariantParameterRepository.getByTaskVariantIds.mockResolvedValue([]);

        const optionsWithStatus = { ...defaultOptions, status: 'draft' as const };
        await taskService.listTaskVariants(nonAdminContext, validTaskId, optionsWithStatus);

        // Should still use 'published' even though 'draft' was requested
        expect(taskVariantRepository.listByTaskId).toHaveBeenCalledWith(
          { taskId: validTaskId, status: 'published' },
          optionsWithStatus,
        );
      });

      it('should return empty parameters array for variants without parameters', async () => {
        const variantWithoutParams = TaskVariantFactory.build({ id: 'variant-no-params', taskId: validTaskId });
        taskRepository.getById.mockResolvedValue(mockTask);
        taskVariantRepository.listByTaskId.mockResolvedValue({
          items: [variantWithoutParams],
          totalItems: 1,
        });
        taskVariantParameterRepository.getByTaskVariantIds.mockResolvedValue([]);

        const result = await taskService.listTaskVariants(authContext, validTaskId, defaultOptions);

        expect(result.items[0]?.parameters).toEqual([]);
      });

      it('should return empty items when no variants exist', async () => {
        taskRepository.getById.mockResolvedValue(mockTask);
        taskVariantRepository.listByTaskId.mockResolvedValue({ items: [], totalItems: 0 });
        taskVariantParameterRepository.getByTaskVariantIds.mockResolvedValue([]);

        const result = await taskService.listTaskVariants(authContext, validTaskId, defaultOptions);

        expect(result.items).toEqual([]);
        expect(result.totalItems).toBe(0);
        expect(result.task).toEqual({
          name: 'Test Task',
          slug: 'test-task',
          image: 'https://example.com/image.png',
        });
      });

      it('should not call getByTaskVariantIds when no variants exist', async () => {
        taskRepository.getById.mockResolvedValue(mockTask);
        taskVariantRepository.listByTaskId.mockResolvedValue({ items: [], totalItems: 0 });
        taskVariantParameterRepository.getByTaskVariantIds.mockResolvedValue([]);

        await taskService.listTaskVariants(authContext, validTaskId, defaultOptions);

        expect(taskVariantParameterRepository.getByTaskVariantIds).toHaveBeenCalledWith([]);
      });
    });

    describe('successful retrieval with task slug', () => {
      it('should return variants when task is looked up by slug', async () => {
        const taskSlug = 'test-task';
        taskRepository.getBySlug.mockResolvedValue(mockTask);
        taskVariantRepository.listByTaskId.mockResolvedValue({ items: mockVariants, totalItems: 2 });
        taskVariantParameterRepository.getByTaskVariantIds.mockResolvedValue(mockParams);

        const result = await taskService.listTaskVariants(authContext, taskSlug, defaultOptions);

        expect(result.items).toHaveLength(2);
        expect(result.totalItems).toBe(2);
        expect(result.task).toEqual({
          name: 'Test Task',
          slug: 'test-task',
          image: 'https://example.com/image.png',
        });
        expect(taskRepository.getBySlug).toHaveBeenCalledWith(taskSlug);
        expect(taskRepository.getById).not.toHaveBeenCalled();
      });

      it('should pass resolved task.id (not slug) to the variant repository', async () => {
        const taskSlug = 'test-task';
        taskRepository.getBySlug.mockResolvedValue(mockTask);
        taskVariantRepository.listByTaskId.mockResolvedValue({ items: [], totalItems: 0 });
        taskVariantParameterRepository.getByTaskVariantIds.mockResolvedValue([]);

        await taskService.listTaskVariants(authContext, taskSlug, defaultOptions);

        // Must use task.id (UUID), not the slug string, when querying variants
        expect(taskVariantRepository.listByTaskId).toHaveBeenCalledWith(
          expect.objectContaining({ taskId: mockTask.id }),
          defaultOptions,
        );
        expect(taskVariantRepository.listByTaskId).not.toHaveBeenCalledWith(
          expect.objectContaining({ taskId: taskSlug }),
          expect.anything(),
        );
      });
    });

    describe('not found', () => {
      it('should throw NOT_FOUND when task does not exist by UUID', async () => {
        taskRepository.getById.mockResolvedValue(null);

        await expect(taskService.listTaskVariants(authContext, validTaskId, defaultOptions)).rejects.toMatchObject({
          message: ApiErrorMessage.NOT_FOUND,
          statusCode: StatusCodes.NOT_FOUND,
          code: ApiErrorCode.RESOURCE_NOT_FOUND,
          context: { userId: 'admin-1', taskId: validTaskId },
        });
      });

      it('should throw NOT_FOUND when task does not exist by slug', async () => {
        const taskSlug = 'nonexistent-slug';
        taskRepository.getBySlug.mockResolvedValue(null);

        await expect(taskService.listTaskVariants(authContext, taskSlug, defaultOptions)).rejects.toMatchObject({
          message: ApiErrorMessage.NOT_FOUND,
          statusCode: StatusCodes.NOT_FOUND,
          code: ApiErrorCode.RESOURCE_NOT_FOUND,
          context: { userId: 'admin-1', taskId: taskSlug },
        });
      });

      it('should not call listByTaskId when task does not exist', async () => {
        taskRepository.getById.mockResolvedValue(null);

        await expect(taskService.listTaskVariants(authContext, validTaskId, defaultOptions)).rejects.toThrow();

        expect(taskVariantRepository.listByTaskId).not.toHaveBeenCalled();
      });
    });

    describe('UUID vs slug detection', () => {
      it('should use getById for UUID-formatted task ID', async () => {
        taskRepository.getById.mockResolvedValue(mockTask);
        taskVariantRepository.listByTaskId.mockResolvedValue({ items: [], totalItems: 0 });
        taskVariantParameterRepository.getByTaskVariantIds.mockResolvedValue([]);

        await taskService.listTaskVariants(authContext, validTaskId, defaultOptions);

        expect(taskRepository.getById).toHaveBeenCalledWith({ id: validTaskId });
        expect(taskRepository.getBySlug).not.toHaveBeenCalled();
      });

      it('should use getBySlug for non-UUID formatted task ID', async () => {
        const slug = 'reading-comprehension';
        taskRepository.getBySlug.mockResolvedValue(mockTask);
        taskVariantRepository.listByTaskId.mockResolvedValue({ items: [], totalItems: 0 });
        taskVariantParameterRepository.getByTaskVariantIds.mockResolvedValue([]);

        await taskService.listTaskVariants(authContext, slug, defaultOptions);

        expect(taskRepository.getBySlug).toHaveBeenCalledWith(slug);
        expect(taskRepository.getById).not.toHaveBeenCalled();
      });

      it('should handle case-sensitive slug lookup', async () => {
        const taskWithLowerSlug = TaskFactory.build({ id: mockTask.id, slug: 'swr' });
        taskRepository.getBySlug.mockImplementation((slug) => {
          if (slug === 'swr') return Promise.resolve(taskWithLowerSlug);
          return Promise.resolve(null);
        });
        taskVariantRepository.listByTaskId.mockResolvedValue({ items: [], totalItems: 0 });
        taskVariantParameterRepository.getByTaskVariantIds.mockResolvedValue([]);

        // Lowercase slug should work
        const result = await taskService.listTaskVariants(authContext, 'swr', defaultOptions);
        expect(result.task.slug).toBe('swr');

        // Uppercase slug should fail (not found)
        await expect(taskService.listTaskVariants(authContext, 'SWR', defaultOptions)).rejects.toMatchObject({
          statusCode: StatusCodes.NOT_FOUND,
          code: ApiErrorCode.RESOURCE_NOT_FOUND,
        });

        // Mixed case slug should fail (not found)
        await expect(taskService.listTaskVariants(authContext, 'SwR', defaultOptions)).rejects.toMatchObject({
          statusCode: StatusCodes.NOT_FOUND,
          code: ApiErrorCode.RESOURCE_NOT_FOUND,
        });
      });
    });

    describe('error handling', () => {
      it('should wrap database errors in ApiError', async () => {
        const dbError = new Error('Connection timeout');
        taskRepository.getById.mockRejectedValue(dbError);

        await expect(taskService.listTaskVariants(authContext, validTaskId, defaultOptions)).rejects.toMatchObject({
          message: ApiErrorMessage.INTERNAL_SERVER_ERROR,
          statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
          code: ApiErrorCode.DATABASE_QUERY_FAILED,
          context: { userId: 'admin-1', taskId: validTaskId },
          cause: dbError,
        });
      });

      it('should wrap variant repository errors in ApiError', async () => {
        const dbError = new Error('Query failed');
        taskRepository.getById.mockResolvedValue(mockTask);
        taskVariantRepository.listByTaskId.mockRejectedValue(dbError);

        await expect(taskService.listTaskVariants(authContext, validTaskId, defaultOptions)).rejects.toMatchObject({
          message: ApiErrorMessage.INTERNAL_SERVER_ERROR,
          statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
          code: ApiErrorCode.DATABASE_QUERY_FAILED,
          cause: dbError,
        });
      });

      it('should wrap parameter repository errors in ApiError', async () => {
        const dbError = new Error('Parameter query failed');
        taskRepository.getById.mockResolvedValue(mockTask);
        taskVariantRepository.listByTaskId.mockResolvedValue({ items: mockVariants, totalItems: 2 });
        taskVariantParameterRepository.getByTaskVariantIds.mockRejectedValue(dbError);

        await expect(taskService.listTaskVariants(authContext, validTaskId, defaultOptions)).rejects.toMatchObject({
          message: ApiErrorMessage.INTERNAL_SERVER_ERROR,
          statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
          code: ApiErrorCode.DATABASE_QUERY_FAILED,
          cause: dbError,
        });
      });

      it('should propagate existing ApiErrors', async () => {
        const apiError = new ApiError('Custom error', {
          statusCode: StatusCodes.BAD_REQUEST,
          code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
        });
        taskRepository.getById.mockRejectedValue(apiError);

        await expect(taskService.listTaskVariants(authContext, validTaskId, defaultOptions)).rejects.toThrow(apiError);
      });
    });
  });

  describe('getTaskVariant', () => {
    const validTaskId = '123e4567-e89b-12d3-a456-426614174000';
    const mockTask = TaskFactory.build({ id: validTaskId });
    const mockVariant = TaskVariantFactory.build({ taskId: mockTask.id });
    const mockParams = [
      { taskVariantId: mockVariant.id, name: 'param1', value: 'value1', createdAt: new Date(), updatedAt: new Date() },
      { taskVariantId: mockVariant.id, name: 'param2', value: 'value2', createdAt: new Date(), updatedAt: new Date() },
    ];

    describe('successful retrieval with UUID', () => {
      it('should retrieve variant by task UUID successfully', async () => {
        taskRepository.getById.mockResolvedValue(mockTask);
        taskVariantRepository.getById.mockResolvedValue(mockVariant);
        taskVariantParameterRepository.getByTaskVariantId.mockResolvedValue(mockParams);

        const result = await taskService.getTaskVariant(authContext, mockTask.id, mockVariant.id);

        expect(result).toEqual({
          ...mockVariant,
          parameters: mockParams.map(({ name, value }) => ({ name, value })),
          task: {
            name: mockTask.name,
            slug: mockTask.slug,
            image: mockTask.image,
          },
        });
        expect(taskRepository.getById).toHaveBeenCalledWith({ id: mockTask.id });
        expect(taskVariantRepository.getById).toHaveBeenCalledWith({ id: mockVariant.id });
      });
    });

    describe('successful retrieval with task slug', () => {
      it('should retrieve variant by task slug successfully', async () => {
        const taskSlug = 'test-task-slug';
        taskRepository.getBySlug.mockResolvedValue(mockTask);
        taskVariantRepository.getById.mockResolvedValue(mockVariant);
        taskVariantParameterRepository.getByTaskVariantId.mockResolvedValue(mockParams);

        const result = await taskService.getTaskVariant(authContext, taskSlug, mockVariant.id);

        expect(result).toEqual({
          ...mockVariant,
          parameters: mockParams.map(({ name, value }) => ({ name, value })),
          task: {
            name: mockTask.name,
            slug: mockTask.slug,
            image: mockTask.image,
          },
        });
        expect(taskRepository.getBySlug).toHaveBeenCalledWith(taskSlug);
      });
    });

    describe('task not found errors', () => {
      it('should throw NOT_FOUND when task does not exist by UUID', async () => {
        taskRepository.getById.mockResolvedValue(null);
        taskRepository.getBySlug.mockResolvedValue(null);

        await expect(
          taskService.getTaskVariant(authContext, '00000000-0000-0000-0000-000000000000', mockVariant.id),
        ).rejects.toThrow(
          expect.objectContaining({
            statusCode: StatusCodes.NOT_FOUND,
            code: ApiErrorCode.RESOURCE_NOT_FOUND,
          }),
        );
      });

      it('should throw NOT_FOUND when task does not exist by slug', async () => {
        taskRepository.getById.mockResolvedValue(null);
        taskRepository.getBySlug.mockResolvedValue(null);

        await expect(taskService.getTaskVariant(authContext, 'nonexistent-slug', mockVariant.id)).rejects.toThrow(
          expect.objectContaining({
            statusCode: StatusCodes.NOT_FOUND,
            code: ApiErrorCode.RESOURCE_NOT_FOUND,
          }),
        );
      });
    });

    describe('variant not found errors', () => {
      it('should throw NOT_FOUND when variant does not exist', async () => {
        taskRepository.getById.mockResolvedValue(mockTask);
        taskVariantRepository.getById.mockResolvedValue(null);

        await expect(taskService.getTaskVariant(authContext, mockTask.id, 'nonexistent-variant')).rejects.toThrow(
          expect.objectContaining({
            statusCode: StatusCodes.NOT_FOUND,
            code: ApiErrorCode.RESOURCE_NOT_FOUND,
          }),
        );
      });
    });

    describe('authorization - super admin access', () => {
      it('should allow super admin to retrieve published variant', async () => {
        const publishedVariant = TaskVariantFactory.build({ taskId: mockTask.id, status: 'published' });
        taskRepository.getById.mockResolvedValue(mockTask);
        taskVariantRepository.getById.mockResolvedValue(publishedVariant);
        taskVariantParameterRepository.getByTaskVariantId.mockResolvedValue(mockParams);

        const result = await taskService.getTaskVariant(authContext, mockTask.id, publishedVariant.id);

        expect(result.status).toBe('published');
      });

      it('should allow super admin to retrieve draft variant', async () => {
        const draftVariant = TaskVariantFactory.build({ taskId: mockTask.id, status: 'draft' });
        taskRepository.getById.mockResolvedValue(mockTask);
        taskVariantRepository.getById.mockResolvedValue(draftVariant);
        taskVariantParameterRepository.getByTaskVariantId.mockResolvedValue(mockParams);

        const result = await taskService.getTaskVariant(authContext, mockTask.id, draftVariant.id);

        expect(result.status).toBe('draft');
      });

      it('should allow super admin to retrieve deprecated variant', async () => {
        const deprecatedVariant = TaskVariantFactory.build({ taskId: mockTask.id, status: 'deprecated' });
        taskRepository.getById.mockResolvedValue(mockTask);
        taskVariantRepository.getById.mockResolvedValue(deprecatedVariant);
        taskVariantParameterRepository.getByTaskVariantId.mockResolvedValue(mockParams);

        const result = await taskService.getTaskVariant(authContext, mockTask.id, deprecatedVariant.id);

        expect(result.status).toBe('deprecated');
      });
    });

    describe('authorization - non-super admin access', () => {
      const nonAdminContext: AuthContext = { userId: 'user-1', isSuperAdmin: false };

      it('should allow non-super admin to retrieve published variant', async () => {
        const publishedVariant = TaskVariantFactory.build({ taskId: mockTask.id, status: 'published' });
        taskRepository.getById.mockResolvedValue(mockTask);
        taskVariantRepository.getById.mockResolvedValue(publishedVariant);
        taskVariantParameterRepository.getByTaskVariantId.mockResolvedValue(mockParams);

        const result = await taskService.getTaskVariant(nonAdminContext, mockTask.id, publishedVariant.id);

        expect(result.status).toBe('published');
      });

      it('should throw NOT_FOUND when non-super admin tries to retrieve draft variant', async () => {
        const draftVariant = TaskVariantFactory.build({ taskId: mockTask.id, status: 'draft' });
        taskRepository.getById.mockResolvedValue(mockTask);
        taskVariantRepository.getById.mockResolvedValue(draftVariant);

        await expect(taskService.getTaskVariant(nonAdminContext, mockTask.id, draftVariant.id)).rejects.toThrow(
          expect.objectContaining({
            statusCode: StatusCodes.NOT_FOUND,
            code: ApiErrorCode.RESOURCE_NOT_FOUND,
          }),
        );
      });

      it('should throw NOT_FOUND when non-super admin tries to retrieve deprecated variant', async () => {
        const deprecatedVariant = TaskVariantFactory.build({ taskId: mockTask.id, status: 'deprecated' });
        taskRepository.getById.mockResolvedValue(mockTask);
        taskVariantRepository.getById.mockResolvedValue(deprecatedVariant);

        await expect(taskService.getTaskVariant(nonAdminContext, mockTask.id, deprecatedVariant.id)).rejects.toThrow(
          expect.objectContaining({
            statusCode: StatusCodes.NOT_FOUND,
            code: ApiErrorCode.RESOURCE_NOT_FOUND,
          }),
        );
      });
    });

    describe('variant parameters handling', () => {
      it('should return empty parameters array when variant has no parameters', async () => {
        taskRepository.getById.mockResolvedValue(mockTask);
        taskVariantRepository.getById.mockResolvedValue(mockVariant);
        taskVariantParameterRepository.getByTaskVariantId.mockResolvedValue([]);

        const result = await taskService.getTaskVariant(authContext, mockTask.id, mockVariant.id);

        expect(result.parameters).toEqual([]);
      });

      it('should return all parameters for variant', async () => {
        const manyParams = [
          {
            taskVariantId: mockVariant.id,
            name: 'param1',
            value: 'value1',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            taskVariantId: mockVariant.id,
            name: 'param2',
            value: { nested: 'object' },
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            taskVariantId: mockVariant.id,
            name: 'param3',
            value: [1, 2, 3],
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          { taskVariantId: mockVariant.id, name: 'param4', value: null, createdAt: new Date(), updatedAt: new Date() },
        ];
        // Service method maps parameters to name/value only
        const manyParamsSimplified = manyParams.map(({ name, value }) => ({ name, value }));

        taskRepository.getById.mockResolvedValue(mockTask);
        taskVariantRepository.getById.mockResolvedValue(mockVariant);
        taskVariantParameterRepository.getByTaskVariantId.mockResolvedValue(manyParams);

        const result = await taskService.getTaskVariant(authContext, mockTask.id, mockVariant.id);

        expect(result.parameters).toEqual(manyParamsSimplified);
      });
    });

    describe('task information inclusion', () => {
      it('should include task name, slug, and image in result', async () => {
        const taskWithImage = TaskFactory.build({ id: validTaskId, image: 'https://example.com/image.jpg' });
        taskRepository.getById.mockResolvedValue(taskWithImage);
        taskVariantRepository.getById.mockResolvedValue(mockVariant);
        taskVariantParameterRepository.getByTaskVariantId.mockResolvedValue(mockParams);

        const result = await taskService.getTaskVariant(authContext, taskWithImage.id, mockVariant.id);

        expect(result.task).toEqual({
          name: taskWithImage.name,
          slug: taskWithImage.slug,
          image: taskWithImage.image,
        });
      });

      it('should include task with null image', async () => {
        const taskWithoutImage = TaskFactory.build({ id: validTaskId, image: null });
        taskRepository.getById.mockResolvedValue(taskWithoutImage);
        taskVariantRepository.getById.mockResolvedValue(mockVariant);
        taskVariantParameterRepository.getByTaskVariantId.mockResolvedValue(mockParams);

        const result = await taskService.getTaskVariant(authContext, taskWithoutImage.id, mockVariant.id);

        expect(result.task.image).toBeNull();
      });
    });

    describe('error handling', () => {
      it('should wrap database errors from task repository in ApiError', async () => {
        const dbError = new Error('Database connection failed');
        taskRepository.getById.mockRejectedValue(dbError);

        await expect(taskService.getTaskVariant(authContext, validTaskId, mockVariant.id)).rejects.toThrow(
          expect.objectContaining({
            message: ApiErrorMessage.INTERNAL_SERVER_ERROR,
            statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
            code: ApiErrorCode.DATABASE_QUERY_FAILED,
          }),
        );
      });

      it('should wrap database errors from variant repository in ApiError', async () => {
        const dbError = new Error('Database connection failed');
        taskRepository.getById.mockResolvedValue(mockTask);
        taskVariantRepository.getById.mockRejectedValue(dbError);

        await expect(taskService.getTaskVariant(authContext, mockTask.id, mockVariant.id)).rejects.toThrow(
          expect.objectContaining({
            message: ApiErrorMessage.INTERNAL_SERVER_ERROR,
            statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
            code: ApiErrorCode.DATABASE_QUERY_FAILED,
          }),
        );
      });

      it('should wrap database errors from parameter repository in ApiError', async () => {
        const dbError = new Error('Database connection failed');
        taskRepository.getById.mockResolvedValue(mockTask);
        taskVariantRepository.getById.mockResolvedValue(mockVariant);
        taskVariantParameterRepository.getByTaskVariantId.mockRejectedValue(dbError);

        await expect(taskService.getTaskVariant(authContext, mockTask.id, mockVariant.id)).rejects.toThrow(
          expect.objectContaining({
            message: ApiErrorMessage.INTERNAL_SERVER_ERROR,
            statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
            code: ApiErrorCode.DATABASE_QUERY_FAILED,
          }),
        );
      });

      it('should propagate existing ApiErrors from task repository', async () => {
        const apiError = new ApiError('Task access denied', {
          statusCode: StatusCodes.FORBIDDEN,
          code: ApiErrorCode.AUTH_FORBIDDEN,
        });
        taskRepository.getById.mockRejectedValue(apiError);

        await expect(taskService.getTaskVariant(authContext, validTaskId, mockVariant.id)).rejects.toThrow(apiError);
      });

      it('should propagate existing ApiErrors from variant repository', async () => {
        const apiError = new ApiError('Variant access denied', {
          statusCode: StatusCodes.FORBIDDEN,
          code: ApiErrorCode.AUTH_FORBIDDEN,
        });
        taskRepository.getById.mockResolvedValue(mockTask);
        taskVariantRepository.getById.mockRejectedValue(apiError);

        await expect(taskService.getTaskVariant(authContext, mockTask.id, mockVariant.id)).rejects.toThrow(apiError);
      });
    });

    describe('UUID validation for variant lookup', () => {
      it('should fetch variant by exact UUID match', async () => {
        const variantId = '123e4567-e89b-12d3-a456-426614174000';
        taskRepository.getById.mockResolvedValue(mockTask);
        taskVariantRepository.getById.mockResolvedValue(mockVariant);
        taskVariantParameterRepository.getByTaskVariantId.mockResolvedValue(mockParams);

        await taskService.getTaskVariant(authContext, mockTask.id, variantId);

        expect(taskVariantRepository.getById).toHaveBeenCalledWith({ id: variantId });
      });
    });

    describe('UUID vs slug detection for task lookup', () => {
      it('should try getById first for UUID-formatted task ID', async () => {
        const validUuid = '123e4567-e89b-12d3-a456-426614174000';
        taskRepository.getById.mockResolvedValue(mockTask);
        taskVariantRepository.getById.mockResolvedValue(mockVariant);
        taskVariantParameterRepository.getByTaskVariantId.mockResolvedValue(mockParams);

        await taskService.getTaskVariant(authContext, validUuid, mockVariant.id);

        expect(taskRepository.getById).toHaveBeenCalledWith({ id: validUuid });
        expect(taskRepository.getBySlug).not.toHaveBeenCalled();
      });

      it('should use slug lookup for non-UUID formatted task IDs', async () => {
        const slug = 'reading-comprehension';
        taskRepository.getBySlug.mockResolvedValue(mockTask);
        taskVariantRepository.getById.mockResolvedValue(mockVariant);
        taskVariantParameterRepository.getByTaskVariantId.mockResolvedValue(mockParams);

        const result = await taskService.getTaskVariant(authContext, slug, mockVariant.id);

        expect(taskRepository.getById).not.toHaveBeenCalled();
        expect(taskRepository.getBySlug).toHaveBeenCalledWith(slug);
        expect(result.task.slug).toBe(mockTask.slug);
      });

      it('should handle case-sensitive slug lookup', async () => {
        const taskWithLowerSlug = TaskFactory.build({ id: mockTask.id, slug: 'swr' });
        taskRepository.getBySlug.mockImplementation((slug) => {
          if (slug === 'swr') {
            return Promise.resolve(taskWithLowerSlug);
          }
          return Promise.resolve(null);
        });
        taskVariantRepository.getById.mockResolvedValue(mockVariant);
        taskVariantParameterRepository.getByTaskVariantId.mockResolvedValue(mockParams);

        // Lowercase slug should work
        const resultLower = await taskService.getTaskVariant(authContext, 'swr', mockVariant.id);

        expect(resultLower.task.slug).toBe('swr');

        // Uppercase slug should fail (not found)
        taskRepository.getBySlug.mockResolvedValue(null);
        await expect(taskService.getTaskVariant(authContext, 'SWR', mockVariant.id)).rejects.toThrow(
          expect.objectContaining({
            statusCode: StatusCodes.NOT_FOUND,
            code: ApiErrorCode.RESOURCE_NOT_FOUND,
          }),
        );

        // Mixed case slug should fail (not found)
        await expect(taskService.getTaskVariant(authContext, 'SwR', mockVariant.id)).rejects.toThrow(
          expect.objectContaining({
            statusCode: StatusCodes.NOT_FOUND,
            code: ApiErrorCode.RESOURCE_NOT_FOUND,
          }),
        );
      });
    });

    describe('response structure', () => {
      it('should return correct response shape with all required fields', async () => {
        taskRepository.getById.mockResolvedValue(mockTask);
        taskVariantRepository.getById.mockResolvedValue(mockVariant);
        taskVariantParameterRepository.getByTaskVariantId.mockResolvedValue(mockParams);

        const result = await taskService.getTaskVariant(authContext, mockTask.id, mockVariant.id);

        expect(result).toHaveProperty('id');
        expect(result).toHaveProperty('taskId');
        expect(result).toHaveProperty('name');
        expect(result).toHaveProperty('description');
        expect(result).toHaveProperty('status');
        expect(result).toHaveProperty('createdAt');
        expect(result).toHaveProperty('updatedAt');
        expect(result).toHaveProperty('parameters');
        expect(result).toHaveProperty('task');
        expect(result.task).toHaveProperty('name');
        expect(result.task).toHaveProperty('slug');
        expect(result.task).toHaveProperty('image');
      });
    });
  });
});
