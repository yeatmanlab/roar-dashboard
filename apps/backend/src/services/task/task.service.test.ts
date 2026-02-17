import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StatusCodes } from 'http-status-codes';
import { TaskService } from './task.service';
import { ApiError } from '../../errors/api-error';
import { ApiErrorCode } from '../../enums/api-error-code.enum';

describe('TaskService', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockTaskVariantRepository: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let taskService: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockTaskVariantRepository = {
      getTaskIdByVariantId: vi.fn(),
    };

    taskService = TaskService({
      taskVariantRepository: mockTaskVariantRepository,
    });
  });

  describe('getTaskIdByVariantId', () => {
    it('should resolve taskId successfully when variant exists', async () => {
      const variantId = '550e8400-e29b-41d4-a716-446655440000';
      const expectedTaskId = 'task-123';

      mockTaskVariantRepository.getTaskIdByVariantId.mockResolvedValue(expectedTaskId);

      const result = await taskService.getTaskIdByVariantId(variantId);

      expect(result).toEqual({ taskId: expectedTaskId });
      expect(mockTaskVariantRepository.getTaskIdByVariantId).toHaveBeenCalledWith(variantId);
      expect(mockTaskVariantRepository.getTaskIdByVariantId).toHaveBeenCalledTimes(1);
    });

    it('should throw UNPROCESSABLE_ENTITY when variant does not exist', async () => {
      const variantId = '550e8400-e29b-41d4-a716-446655440000';

      mockTaskVariantRepository.getTaskIdByVariantId.mockResolvedValue(null);

      await expect(taskService.getTaskIdByVariantId(variantId)).rejects.toMatchObject({
        statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
        code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
        message: 'Invalid task_variant_id',
      });

      expect(mockTaskVariantRepository.getTaskIdByVariantId).toHaveBeenCalledWith(variantId);
    });

    it('should throw UNPROCESSABLE_ENTITY when variant returns empty string', async () => {
      const variantId = '550e8400-e29b-41d4-a716-446655440000';

      mockTaskVariantRepository.getTaskIdByVariantId.mockResolvedValue('');

      await expect(taskService.getTaskIdByVariantId(variantId)).rejects.toMatchObject({
        statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
        code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
      });
    });

    it('should propagate repository errors that are not null/empty', async () => {
      const variantId = '550e8400-e29b-41d4-a716-446655440000';
      const repositoryError = new Error('Database connection failed');

      mockTaskVariantRepository.getTaskIdByVariantId.mockRejectedValue(repositoryError);

      await expect(taskService.getTaskIdByVariantId(variantId)).rejects.toThrow(repositoryError);
    });

    it('should include context in error when variant not found', async () => {
      const variantId = '550e8400-e29b-41d4-a716-446655440000';

      mockTaskVariantRepository.getTaskIdByVariantId.mockResolvedValue(null);

      try {
        await taskService.getTaskIdByVariantId(variantId);
        expect.fail('Should have thrown an error');
      } catch (error) {
        if (error instanceof ApiError) {
          expect(error.context).toEqual({ taskVariantId: variantId });
        }
      }
    });

    it('should handle multiple calls with different variant IDs', async () => {
      const variantId1 = '550e8400-e29b-41d4-a716-446655440000';
      const variantId2 = '660e8400-e29b-41d4-a716-446655440001';
      const taskId1 = 'task-123';
      const taskId2 = 'task-456';

      mockTaskVariantRepository.getTaskIdByVariantId.mockResolvedValueOnce(taskId1).mockResolvedValueOnce(taskId2);

      const result1 = await taskService.getTaskIdByVariantId(variantId1);
      const result2 = await taskService.getTaskIdByVariantId(variantId2);

      expect(result1).toEqual({ taskId: taskId1 });
      expect(result2).toEqual({ taskId: taskId2 });
      expect(mockTaskVariantRepository.getTaskIdByVariantId).toHaveBeenCalledTimes(2);
    });

    it('should use injected repository when provided', async () => {
      const customRepository = {
        getTaskIdByVariantId: vi.fn().mockResolvedValue('custom-task-id'),
      };

      const customTaskService = TaskService({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        taskVariantRepository: customRepository as any,
      });

      const variantId = '550e8400-e29b-41d4-a716-446655440000';
      const result = await customTaskService.getTaskIdByVariantId(variantId);

      expect(result).toEqual({ taskId: 'custom-task-id' });
      expect(customRepository.getTaskIdByVariantId).toHaveBeenCalledWith(variantId);
    });
  });
});
