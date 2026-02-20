import { describe, it, expect, beforeEach } from 'vitest';
import type { AuthContext } from '../../types/auth-context';
// import { logger } from '../../logger';
import { createMockTaskRepository } from '../../test-support/repositories/task.repository';
import { createMockTaskVariantRepository } from '../../test-support/repositories/task-variant.repository';
import { createMockTaskVariantParameterRepository } from '../../test-support/repositories/task-variant-parameter.repository';
import { TaskFactory } from '../../test-support/factories/task.factory';
import { TaskVariantFactory } from '../../test-support/factories/task-variant.factory';
import { TaskVariantParameterFactory } from '../../test-support/factories/task-variant-parameter.factory';
import { TaskService } from './task.service';
import { TaskVariantStatus } from '../../enums/task-variant-status.enum';

describe('TaskService', () => {
  let mockAuthContext: AuthContext;
  let taskRepository: ReturnType<typeof createMockTaskRepository>;
  let taskVariantRepository: ReturnType<typeof createMockTaskVariantRepository>;
  let taskVariantParameterRepository: ReturnType<typeof createMockTaskVariantParameterRepository>;
  let taskService: ReturnType<typeof TaskService>;
  beforeEach(() => {
    mockAuthContext = { userId: 'admin-1', isSuperAdmin: true };
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
      const result = await taskService.createTaskVariant(mockAuthContext, mockData);
      expect(result).toEqual({ id: mockTaskVariant.id });
    });
  });
});
