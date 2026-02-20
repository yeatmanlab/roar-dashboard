/**
 * Integration tests for TaskVariantRepository.
 *
 * Tests custom methods (getByTaskId, getByTaskIdAndName) against the real database.
 * Base CRUD operations are covered by BaseRepository tests.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { TaskFactory } from '../test-support/factories/task.factory';
import { TaskVariantFactory } from '../test-support/factories/task-variant.factory';
import { TaskVariantRepository } from './task-variant.repository';

describe('TaskVariantRepository', () => {
  let repository: TaskVariantRepository;

  beforeAll(() => {
    repository = new TaskVariantRepository();
  });

  describe('getByTaskId', () => {
    it('returns variants when task has variants', async () => {
      const task = await TaskFactory.create();
      const variant1 = await TaskVariantFactory.create({
        taskId: task.id,
        name: 'Easy Mode',
      });
      const variant2 = await TaskVariantFactory.create({
        taskId: task.id,
        name: 'Hard Mode',
      });

      const result = await repository.getByTaskId(task.id);

      expect(result).toHaveLength(2);
      const variantIds = result.map((v) => v.id);
      expect(variantIds).toContain(variant1.id);
      expect(variantIds).toContain(variant2.id);
    });

    it('returns empty array when task has no variants', async () => {
      const task = await TaskFactory.create();

      const result = await repository.getByTaskId(task.id);

      expect(result).toEqual([]);
    });

    it('returns empty array when task does not exist', async () => {
      const result = await repository.getByTaskId('00000000-0000-0000-0000-000000000000');

      expect(result).toEqual([]);
    });

    it('returns only variants for specified task when multiple tasks exist', async () => {
      const task1 = await TaskFactory.create();
      const task2 = await TaskFactory.create();

      const variant1 = await TaskVariantFactory.create({
        taskId: task1.id,
        name: 'Task 1 Variant',
      });
      await TaskVariantFactory.create({
        taskId: task2.id,
        name: 'Task 2 Variant',
      });

      const result = await repository.getByTaskId(task1.id);

      expect(result).toHaveLength(1);
      expect(result[0]!.id).toBe(variant1.id);
      expect(result[0]!.taskId).toBe(task1.id);
    });
  });

  describe('getByTaskIdAndName', () => {
    it('returns variant when taskId and name match', async () => {
      const task = await TaskFactory.create();
      const variant = await TaskVariantFactory.create({
        taskId: task.id,
        name: 'Standard Mode',
      });

      const result = await repository.getByTaskIdAndName({
        taskId: task.id,
        name: 'Standard Mode',
      });

      expect(result).not.toBeNull();
      expect(result!.id).toBe(variant.id);
      expect(result!.name).toBe('Standard Mode');
    });

    it('returns null when taskId does not match', async () => {
      const task1 = await TaskFactory.create();
      const task2 = await TaskFactory.create();
      await TaskVariantFactory.create({
        taskId: task1.id,
        name: 'Test Variant',
      });

      const result = await repository.getByTaskIdAndName({
        taskId: task2.id,
        name: 'Test Variant',
      });

      expect(result).toBeNull();
    });

    it('returns null when name does not match', async () => {
      const task = await TaskFactory.create();
      await TaskVariantFactory.create({
        taskId: task.id,
        name: 'Existing Variant',
      });

      const result = await repository.getByTaskIdAndName({
        taskId: task.id,
        name: 'Nonexistent Variant',
      });

      expect(result).toBeNull();
    });

    it('returns correct variant when multiple variants exist for same task', async () => {
      const task = await TaskFactory.create();
      await TaskVariantFactory.create({
        taskId: task.id,
        name: 'Variant Alpha',
      });
      const targetVariant = await TaskVariantFactory.create({
        taskId: task.id,
        name: 'Variant Beta',
      });
      await TaskVariantFactory.create({
        taskId: task.id,
        name: 'Variant Gamma',
      });

      const result = await repository.getByTaskIdAndName({
        taskId: task.id,
        name: 'Variant Beta',
      });

      expect(result).not.toBeNull();
      expect(result!.id).toBe(targetVariant.id);
      expect(result!.name).toBe('Variant Beta');
    });

    it('is case-insensitive for name matching', async () => {
      const task = await TaskFactory.create();
      const variant = await TaskVariantFactory.create({
        taskId: task.id,
        name: 'MixedCase Variant',
      });

      const result = await repository.getByTaskIdAndName({
        taskId: task.id,
        name: 'mixedcase variant',
      });

      expect(result).not.toBeNull();
      expect(result!.id).toBe(variant.id);
      expect(result!.name).toBe('MixedCase Variant');
    });
  });
});
