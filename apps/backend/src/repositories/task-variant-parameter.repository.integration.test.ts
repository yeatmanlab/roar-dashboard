/**
 * Integration tests for TaskVariantParameterRepository.
 *
 * Tests custom methods (getByTaskVariantId) against the real database.
 * Base CRUD operations are covered by BaseRepository tests.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { TaskFactory } from '../test-support/factories/task.factory';
import { TaskVariantFactory } from '../test-support/factories/task-variant.factory';
import { TaskVariantParameterFactory } from '../test-support/factories/task-variant-parameter.factory';
import { TaskVariantParameterRepository } from './task-variant-parameter.repository';

describe('TaskVariantParameterRepository', () => {
  let repository: TaskVariantParameterRepository;

  beforeAll(() => {
    repository = new TaskVariantParameterRepository();
  });

  describe('getByTaskVariantId', () => {
    it('returns parameters when variant has parameters', async () => {
      const task = await TaskFactory.create();
      const variant = await TaskVariantFactory.create({ taskId: task.id });

      await TaskVariantParameterFactory.create({
        taskVariantId: variant.id,
        name: 'difficulty',
        value: 'easy',
      });
      await TaskVariantParameterFactory.create({
        taskVariantId: variant.id,
        name: 'timeLimit',
        value: 120,
      });

      const result = await repository.getByTaskVariantId(variant.id);

      expect(result).toHaveLength(2);
      const paramNames = result.map((p) => p.name);
      expect(paramNames).toContain('difficulty');
      expect(paramNames).toContain('timeLimit');
      expect(result.find((p) => p.name === 'difficulty')?.value).toBe('easy');
      expect(result.find((p) => p.name === 'timeLimit')?.value).toBe(120);
    });

    it('returns empty array when variant has no parameters', async () => {
      const task = await TaskFactory.create();
      const variant = await TaskVariantFactory.create({ taskId: task.id });

      const result = await repository.getByTaskVariantId(variant.id);

      expect(result).toEqual([]);
    });

    it('returns empty array when variant does not exist', async () => {
      const result = await repository.getByTaskVariantId('00000000-0000-0000-0000-000000000000');

      expect(result).toEqual([]);
    });

    it('returns only parameters for specified variant when multiple variants exist', async () => {
      const task = await TaskFactory.create();
      const variant1 = await TaskVariantFactory.create({ taskId: task.id });
      const variant2 = await TaskVariantFactory.create({ taskId: task.id });

      await TaskVariantParameterFactory.create({
        taskVariantId: variant1.id,
        name: 'variant1Param',
        value: 'value1',
      });
      await TaskVariantParameterFactory.create({
        taskVariantId: variant2.id,
        name: 'variant2Param',
        value: 'value2',
      });

      const result = await repository.getByTaskVariantId(variant1.id);

      expect(result).toHaveLength(1);
      expect(result[0]!.name).toBe('variant1Param');
      expect(result[0]!.taskVariantId).toBe(variant1.id);
    });

    it('handles parameters with complex JSONB values', async () => {
      const task = await TaskFactory.create();
      const variant = await TaskVariantFactory.create({ taskId: task.id });

      const complexValue = {
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

      await TaskVariantParameterFactory.create({
        taskVariantId: variant.id,
        name: 'complexConfig',
        value: complexValue,
      });

      const result = await repository.getByTaskVariantId(variant.id);

      expect(result).toHaveLength(1);
      expect(result[0]!.name).toBe('complexConfig');
      expect(result[0]!.value).toEqual(complexValue);
    });
  });
});
