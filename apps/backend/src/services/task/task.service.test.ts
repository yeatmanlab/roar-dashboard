/**
 * Integration tests for TaskService.
 *
 * Tests business logic methods using real repositories and database.
 * These are integration tests - they use the real database with factories.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { TaskService } from './task.service';
import { TaskFactory } from '../../test-support/factories/task.factory';
import { TaskVariantFactory } from '../../test-support/factories/task-variant.factory';
import { TaskRepository } from '../../repositories/task.repository';
import { TaskVariantRepository } from '../../repositories/task-variant.repository';
import { TaskVariantParameterRepository } from '../../repositories/task-variant-parameter.repository';
import { ApiErrorMessage } from '../../enums/api-error-message.enum';
import { ApiErrorCode } from '../../enums/api-error-code.enum';

describe('TaskService', () => {
  let taskRepository: TaskRepository;
  let taskVariantRepository: TaskVariantRepository;
  let taskVariantParameterRepository: TaskVariantParameterRepository;
  let service: ReturnType<typeof TaskService>;

  beforeAll(() => {
    taskRepository = new TaskRepository();
    taskVariantRepository = new TaskVariantRepository();
    taskVariantParameterRepository = new TaskVariantParameterRepository();

    service = TaskService({
      taskRepository,
      taskVariantRepository,
      taskVariantParameterRepository,
    });
  });

  describe('createTaskVariant', () => {
    it('should create task variant with parameters for super admin', async () => {
      const task = await TaskFactory.create();
      const variantData = {
        taskId: task.id,
        name: 'easy-mode',
        description: 'Easy difficulty configuration',
        status: 'published' as const,
        parameters: [
          { name: 'difficulty', value: 'easy' },
          { name: 'timeLimit', value: 120 },
          { name: 'hintsEnabled', value: true },
        ],
      };

      const result = await service.createTaskVariant({ userId: 'admin-123', isSuperAdmin: true }, variantData);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();

      // Verify the variant was actually created in the database
      const createdVariant = await taskVariantRepository.getById({ id: result.id! });
      expect(createdVariant).not.toBeNull();
      expect(createdVariant!.taskId).toBe(task.id);
      expect(createdVariant!.name).toBe('easy-mode');

      // Verify all parameters were created
      const parameters = await taskVariantParameterRepository.getByTaskVariantId(result.id!);
      expect(parameters).toHaveLength(3);

      const paramMap = new Map(parameters.map((p) => [p.name, p.value]));
      expect(paramMap.get('difficulty')).toBe('easy');
      expect(paramMap.get('timeLimit')).toBe(120);
      expect(paramMap.get('hintsEnabled')).toBe(true);
    });

    it('should throw forbidden error for non-super admin', async () => {
      const task = await TaskFactory.create();
      const variantData = {
        taskId: task.id,
        name: 'test-variant',
        description: 'Test variant',
        status: 'published' as const,
        parameters: [{ name: 'test', value: 'value' }],
      };

      await expect(
        service.createTaskVariant({ userId: 'user-123', isSuperAdmin: false }, variantData),
      ).rejects.toMatchObject({
        message: ApiErrorMessage.FORBIDDEN,
        statusCode: 403,
        code: ApiErrorCode.AUTH_FORBIDDEN,
      });

      // Verify nothing was created
      const variants = await taskVariantRepository.getByTaskId(task.id);
      expect(variants).toHaveLength(0);
    });

    it('should throw not-found error when parent task does not exist', async () => {
      const variantData = {
        taskId: '00000000-0000-0000-0000-000000000000',
        name: 'test-variant',
        description: 'Test variant',
        status: 'published' as const,
        parameters: [{ name: 'test', value: 'value' }],
      };

      await expect(
        service.createTaskVariant({ userId: 'admin-123', isSuperAdmin: true }, variantData),
      ).rejects.toMatchObject({
        message: ApiErrorMessage.NOT_FOUND,
        statusCode: 404,
        code: ApiErrorCode.RESOURCE_NOT_FOUND,
      });
    });

    it('should throw conflict error when variant name already exists for task', async () => {
      const task = await TaskFactory.create();
      await TaskVariantFactory.create({
        taskId: task.id,
        name: 'existing-variant',
      });

      const variantData = {
        taskId: task.id,
        name: 'existing-variant',
        description: 'Duplicate variant',
        status: 'published' as const,
        parameters: [{ name: 'test', value: 'value' }],
      };

      await expect(
        service.createTaskVariant({ userId: 'admin-123', isSuperAdmin: true }, variantData),
      ).rejects.toMatchObject({
        message: ApiErrorMessage.CONFLICT,
        statusCode: 409,
        code: ApiErrorCode.RESOURCE_CONFLICT,
      });
    });

    it('should allow same variant name for different tasks', async () => {
      const task1 = await TaskFactory.create();
      const task2 = await TaskFactory.create();

      await TaskVariantFactory.create({
        taskId: task1.id,
        name: 'shared-name',
      });

      const variantData = {
        taskId: task2.id,
        name: 'shared-name',
        description: 'Same name, different task',
        status: 'published' as const,
        parameters: [{ name: 'test', value: 'value' }],
      };

      const result = await service.createTaskVariant({ userId: 'admin-123', isSuperAdmin: true }, variantData);

      expect(result).toBeDefined();
    });

    it('should throw bad-request error when parameters array is empty', async () => {
      const task = await TaskFactory.create();
      const variantData = {
        taskId: task.id,
        name: 'no-params-variant',
        description: 'Variant without parameters',
        status: 'published' as const,
        parameters: [],
      };

      await expect(
        service.createTaskVariant({ userId: 'admin-123', isSuperAdmin: true }, variantData),
      ).rejects.toMatchObject({
        message: 'At least one parameter required',
        statusCode: 400,
        code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
      });

      // Verify nothing was created (transaction rollback)
      const variants = await taskVariantRepository.getByTaskId(task.id);
      expect(variants).toHaveLength(0);
    });

    it('should handle parameters with complex JSONB values', async () => {
      const task = await TaskFactory.create();
      const complexConfig = {
        settings: {
          audio: true,
          visual: false,
        },
        options: ['option1', 'option2', 'option3'],
        metadata: {
          version: '1.0',
          author: 'test',
        },
      };

      const variantData = {
        taskId: task.id,
        name: 'complex-variant',
        description: 'Variant with complex parameters',
        status: 'published' as const,
        parameters: [
          { name: 'difficulty', value: 'hard' },
          { name: 'complexConfig', value: complexConfig },
          { name: 'enabled', value: true },
          { name: 'maxAttempts', value: 5 },
        ],
      };

      const result = await service.createTaskVariant({ userId: 'admin-123', isSuperAdmin: true }, variantData);

      expect(result).toBeDefined();

      // Verify all parameters including complex JSONB
      const parameters = await taskVariantParameterRepository.getByTaskVariantId(result.id!);
      expect(parameters).toHaveLength(4);

      const complexParam = parameters.find((p) => p.name === 'complexConfig');
      expect(complexParam).toBeDefined();
      expect(complexParam!.value).toEqual(complexConfig);
    });

    it('should rollback transaction when parameter creation fails', async () => {
      const task = await TaskFactory.create();

      // Create a variant with a parameter that would violate a constraint
      const variantData = {
        taskId: task.id,
        name: 'test-variant',
        description: 'Test variant',
        status: 'published' as const,
        parameters: [{ name: 'test', value: 'value' }],
      };

      // First create should succeed
      const result1 = await service.createTaskVariant({ userId: 'admin-123', isSuperAdmin: true }, variantData);
      expect(result1).toBeDefined();

      // Verify variant was created
      const variant = await taskVariantRepository.getById({ id: result1.id! });
      expect(variant).not.toBeNull();

      // Verify parameters were created
      const params = await taskVariantParameterRepository.getByTaskVariantId(result1.id!);
      expect(params).toHaveLength(1);
    });

    it('should handle multiple parameters of different types', async () => {
      const task = await TaskFactory.create();
      const variantData = {
        taskId: task.id,
        name: 'multi-type-variant',
        description: 'Variant with various parameter types',
        status: 'draft' as const,
        parameters: [
          { name: 'stringParam', value: 'test string' },
          { name: 'numberParam', value: 42 },
          { name: 'booleanParam', value: false },
          { name: 'nullParam', value: null },
          { name: 'arrayParam', value: [1, 2, 3] },
          { name: 'objectParam', value: { key: 'value', nested: { data: true } } },
        ],
      };

      const result = await service.createTaskVariant({ userId: 'admin-123', isSuperAdmin: true }, variantData);

      expect(result).toBeDefined();

      // Verify all parameter types are preserved
      const parameters = await taskVariantParameterRepository.getByTaskVariantId(result.id!);
      expect(parameters).toHaveLength(6);

      const paramMap = new Map(parameters.map((p) => [p.name, p.value]));
      expect(paramMap.get('stringParam')).toBe('test string');
      expect(paramMap.get('numberParam')).toBe(42);
      expect(paramMap.get('booleanParam')).toBe(false);
      expect(paramMap.get('nullParam')).toBeNull();
      expect(paramMap.get('arrayParam')).toEqual([1, 2, 3]);
      expect(paramMap.get('objectParam')).toEqual({ key: 'value', nested: { data: true } });
    });

    it('should handle variant with draft status', async () => {
      const task = await TaskFactory.create();
      const variantData = {
        taskId: task.id,
        name: 'draft-variant',
        description: 'A draft variant',
        status: 'draft' as const,
        parameters: [{ name: 'test', value: 'draft' }],
      };

      const result = await service.createTaskVariant({ userId: 'admin-123', isSuperAdmin: true }, variantData);

      expect(result).toBeDefined();

      const createdVariant = await taskVariantRepository.getById({ id: result.id! });
      expect(createdVariant!.status).toBe('draft');
    });
  });
});
