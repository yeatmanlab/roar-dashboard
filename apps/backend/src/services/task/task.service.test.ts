import { describe, it, expect, beforeEach, vi } from 'vitest';
import { logger } from '../../logger';
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
import { StatusCodes } from 'http-status-codes';
import { PostgresErrorCode } from '../../enums/postgres-error-code.enum';
import type { AuthContext } from '../../types/auth-context';

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
        taskVariantRepository.create.mockResolvedValueOnce({ id: mockTaskVariant.id });
        taskVariantParameterRepository.createMany.mockResolvedValueOnce(mockTaskVariantParameterReturnValue);

        const mockData = {
          taskId: mockTask.id,
          name: 'Test Variant',
          description: 'Test description',
          status: TaskVariantStatus.PUBLISHED,
          parameters: mockTaskVariantParameterData,
        };
        const result = await taskService.createTaskVariant(authContext, mockData);

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
        expect(logger.info).toHaveBeenCalledWith(
          expect.objectContaining({
            userId: 'admin-1',
            taskId: mockTask.id,
            variantId: mockTaskVariant.id,
            parameterCount: 1,
          }),
          'Created task variant with parameters',
        );
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
        taskVariantRepository.create.mockResolvedValueOnce({ id: mockTaskVariant.id });
        taskVariantParameterRepository.createMany.mockResolvedValueOnce(mockParameterReturnValues);

        const mockData = {
          taskId: mockTask.id,
          name: 'Multi-param Variant',
          description: 'Variant with multiple parameters',
          status: TaskVariantStatus.PUBLISHED,
          parameters: mockParameters,
        };

        const result = await taskService.createTaskVariant(authContext, mockData);

        expect(result).toEqual({ id: mockTaskVariant.id });
        expect(taskVariantParameterRepository.createMany).toHaveBeenCalledWith({
          data: mockParameters.map((param) => ({
            taskVariantId: mockTaskVariant.id,
            name: param.name,
            value: param.value,
          })),
          transaction: expect.any(Object),
        });
        expect(logger.info).toHaveBeenCalledWith(
          expect.objectContaining({ parameterCount: 4 }),
          'Created task variant with parameters',
        );
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
        taskVariantRepository.create.mockResolvedValueOnce({ id: mockTaskVariant.id });
        taskVariantParameterRepository.createMany.mockResolvedValueOnce([{ id: 'param-1' }]);

        const mockData = {
          taskId: mockTask.id,
          name: 'Complex Variant',
          description: 'Variant with complex JSONB',
          status: TaskVariantStatus.DRAFT,
          parameters: [complexParameter],
        };

        const result = await taskService.createTaskVariant(authContext, mockData);

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

        const mockData = {
          taskId: 'task-1',
          name: 'Test Variant',
          description: 'Test description',
          status: TaskVariantStatus.PUBLISHED,
          parameters: [{ name: 'param1', value: 'value1' }],
        };

        await expect(taskService.createTaskVariant(nonAdminContext, mockData)).rejects.toMatchObject({
          statusCode: StatusCodes.FORBIDDEN,
          code: ApiErrorCode.AUTH_FORBIDDEN,
          context: { userId: 'user-1', isSuperAdmin: false },
        });

        // Verify repository methods were never called
        expect(taskRepository.getById).not.toHaveBeenCalled();
        expect(taskVariantRepository.runTransaction).not.toHaveBeenCalled();
      });
    });

    describe('validation errors', () => {
      it('should throw BAD_REQUEST when parameters array is empty', async () => {
        const mockTask = TaskFactory.build();

        taskRepository.getById.mockResolvedValueOnce(mockTask);
        taskVariantRepository.runTransaction.mockImplementationOnce(async ({ fn }) => {
          return await fn({});
        });
        taskVariantRepository.create.mockResolvedValueOnce({ id: 'variant-1' });

        const mockData = {
          taskId: mockTask.id,
          name: 'Invalid Variant',
          description: 'No parameters',
          status: TaskVariantStatus.PUBLISHED,
          parameters: [], // Empty array - should fail
        };

        await expect(taskService.createTaskVariant(authContext, mockData)).rejects.toMatchObject({
          message: 'At least one parameter required',
          statusCode: StatusCodes.BAD_REQUEST,
          code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
        });
      });

      it('should throw INTERNAL when not all parameters are created', async () => {
        const mockTask = TaskFactory.build();

        taskRepository.getById.mockResolvedValue(mockTask);
        taskVariantRepository.runTransaction.mockImplementationOnce(async ({ fn }) => {
          return await fn({});
        });
        taskVariantRepository.create.mockResolvedValueOnce({ id: 'variant-1' });

        // Only 1 parameter created instead of 3
        taskVariantParameterRepository.createMany.mockResolvedValueOnce([{ id: 'param-1' }]);

        const mockData = {
          taskId: mockTask.id,
          name: 'Partial Variant',
          description: 'Should fail',
          status: TaskVariantStatus.PUBLISHED,
          parameters: [
            { name: 'param1', value: 'value1' },
            { name: 'param2', value: 'value2' },
            { name: 'param3', value: 'value3' },
          ],
        };

        await expect(taskService.createTaskVariant(authContext, mockData)).rejects.toMatchObject({
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

        const mockData = {
          taskId: 'nonexistent-task-id',
          name: 'Test Variant',
          description: 'Test description',
          status: TaskVariantStatus.PUBLISHED,
          parameters: [{ name: 'param1', value: 'value1' }],
        };

        await expect(taskService.createTaskVariant(authContext, mockData)).rejects.toMatchObject({
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

        const mockData = {
          taskId: mockTask.id,
          name: 'duplicate-variant-name',
          description: 'Test description',
          status: TaskVariantStatus.PUBLISHED,
          parameters: [{ name: 'param1', value: 'value1' }],
        };

        await expect(taskService.createTaskVariant(authContext, mockData)).rejects.toMatchObject({
          statusCode: StatusCodes.CONFLICT,
          code: ApiErrorCode.RESOURCE_CONFLICT,
          context: {
            userId: 'admin-1',
            taskId: mockTask.id,
            variantName: 'duplicate-variant-name',
          },
        });

        // Note: logger.error is NOT called for unique violations
        // The service catches unique violations and throws a CONFLICT ApiError
        // logger.error is only called for unexpected database errors
      });

      it('should throw DATABASE_QUERY_FAILED on unexpected database error', async () => {
        const mockTask = TaskFactory.build();

        taskRepository.getById.mockResolvedValue(mockTask);

        const dbError = new Error('Connection timeout');
        taskVariantRepository.runTransaction.mockRejectedValueOnce(dbError);

        const mockData = {
          taskId: mockTask.id,
          name: 'Test Variant',
          description: 'Test description',
          status: TaskVariantStatus.PUBLISHED,
          parameters: [{ name: 'param1', value: 'value1' }],
        };

        await expect(taskService.createTaskVariant(authContext, mockData)).rejects.toMatchObject({
          message: 'Failed to create task variant',
          statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
          code: ApiErrorCode.DATABASE_QUERY_FAILED,
          context: {
            userId: 'admin-1',
            taskId: mockTask.id,
          },
        });

        expect(logger.error).toHaveBeenCalledWith(
          expect.objectContaining({ err: dbError }),
          'Failed to create task variant',
        );
      });

      it('should throw INTERNAL when variant creation fails', async () => {
        const mockTask = TaskFactory.build();

        taskRepository.getById.mockResolvedValue(mockTask);
        taskVariantRepository.runTransaction.mockImplementationOnce(async ({ fn }) => {
          return await fn({});
        });

        const mockData = {
          taskId: mockTask.id,
          name: 'Failed Variant',
          description: 'Test description',
          status: TaskVariantStatus.PUBLISHED,
          parameters: [{ name: 'param1', value: 'value1' }],
        };

        await expect(taskService.createTaskVariant(authContext, mockData)).rejects.toMatchObject({
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

        const mockData = {
          taskId: mockTask.id,
          name: 'Test Variant',
          description: 'Test description',
          status: TaskVariantStatus.PUBLISHED,
          parameters: [{ name: 'param1', value: 'value1' }],
        };

        await expect(taskService.createTaskVariant(authContext, mockData)).rejects.toThrow(nestedApiError);

        // Should not wrap in another ApiError
        expect(logger.error).not.toHaveBeenCalled();
      });

      it('should handle Drizzle-wrapped PostgreSQL unique violation error', async () => {
        const mockTask = TaskFactory.build();

        taskRepository.getById.mockResolvedValue(mockTask);

        // Create a Postgres error with proper error code typing
        const postgresError = Object.assign(new Error('duplicate key value violates unique constraint'), {
          code: PostgresErrorCode.UNIQUE_VIOLATION,
        });

        // Create a mock Drizzle-like error structure
        // The service uses unwrapDrizzleError() which checks for DrizzleQueryError instance
        // and returns error.cause if it exists, otherwise returns the error itself
        // For testing purposes, we can just throw the Postgres error directly since
        // unwrapDrizzleError will return it as-is if it's not a DrizzleQueryError
        taskVariantRepository.runTransaction.mockRejectedValueOnce(postgresError);

        const mockData = {
          taskId: mockTask.id,
          name: 'duplicate-variant-name',
          description: 'Test description',
          status: TaskVariantStatus.PUBLISHED,
          parameters: [{ name: 'param1', value: 'value1' }],
        };

        await expect(taskService.createTaskVariant(authContext, mockData)).rejects.toMatchObject({
          statusCode: StatusCodes.CONFLICT,
          code: ApiErrorCode.RESOURCE_CONFLICT,
          context: {
            userId: 'admin-1',
            taskId: mockTask.id,
            variantName: 'duplicate-variant-name',
          },
        });

        // Note: logger.error is NOT called for unique violations
        // The service catches unique violations and throws a CONFLICT ApiError
        // logger.error is only called for unexpected database errors
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
        taskVariantRepository.create.mockResolvedValueOnce({ id: mockTaskVariant.id });
        taskVariantParameterRepository.createMany.mockResolvedValueOnce([{ id: 'param-1' }]);

        const mockData = {
          taskId: mockTask.id,
          name: 'Deprecated Variant',
          description: 'Old variant',
          status: TaskVariantStatus.DEPRECATED,
          parameters: [{ name: 'param1', value: 'value1' }],
        };

        const result = await taskService.createTaskVariant(authContext, mockData);

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
        taskVariantRepository.create.mockResolvedValueOnce({ id: mockTaskVariant.id });
        taskVariantParameterRepository.createMany.mockResolvedValueOnce([{ id: 'param-1' }]);

        const mockData = {
          taskId: mockTask.id,
          name: 'Draft Variant',
          description: 'Work in progress',
          status: TaskVariantStatus.DRAFT,
          parameters: [{ name: 'param1', value: 'value1' }],
        };

        const result = await taskService.createTaskVariant(authContext, mockData);

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
        taskVariantRepository.create.mockResolvedValueOnce({ id: mockTaskVariant.id });
        taskVariantParameterRepository.createMany.mockResolvedValueOnce([{ id: 'param-1' }]);

        const mockData = {
          taskId: mockTask.id,
          name: 'Null Param Variant',
          description: 'Test null handling',
          status: TaskVariantStatus.PUBLISHED,
          parameters: [{ name: 'optionalConfig', value: null }],
        };

        const result = await taskService.createTaskVariant(authContext, mockData);

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
        taskVariantRepository.create.mockResolvedValueOnce({ id: mockTaskVariant.id });
        taskVariantParameterRepository.createMany.mockResolvedValueOnce([{ id: 'param-1' }]);

        const arrayValue = ['option1', 'option2', 'option3'];
        const mockData = {
          taskId: mockTask.id,
          name: 'Array Param Variant',
          description: 'Test array handling',
          status: TaskVariantStatus.PUBLISHED,
          parameters: [{ name: 'choices', value: arrayValue }],
        };

        const result = await taskService.createTaskVariant(authContext, mockData);

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
});
