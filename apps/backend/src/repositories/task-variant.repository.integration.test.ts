/**
 * Integration tests for TaskVariantRepository.
 *
 * Tests custom methods (getByTaskId, getByTaskIdAndName, listAllPublished)
 * against the real database. Base CRUD operations are covered by BaseRepository tests.
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

  describe('listAllPublished', () => {
    const defaultOptions = {
      page: 1,
      perPage: 25,
      sortBy: 'variant.name' as const,
      sortOrder: 'asc' as const,
      filters: [],
    };

    it('returns only published variants', async () => {
      const task = await TaskFactory.create();
      const published = await TaskVariantFactory.create({ taskId: task.id, status: 'published' });
      await TaskVariantFactory.create({ taskId: task.id, status: 'draft' });
      await TaskVariantFactory.create({ taskId: task.id, status: 'deprecated' });

      const result = await repository.listAllPublished(defaultOptions);

      const ids = result.items.map((v) => v.id);
      expect(ids).toContain(published.id);
      expect(ids.every((id) => id !== task.id)).toBe(true);
      // Non-published variants must not appear
      const statuses = result.items.map((v) => v.status);
      expect(statuses.every((s) => s === 'published')).toBe(true);
    });

    it('joins and returns task fields on each item', async () => {
      const task = await TaskFactory.create();
      const variant = await TaskVariantFactory.create({ taskId: task.id, status: 'published' });

      const result = await repository.listAllPublished(defaultOptions);

      const item = result.items.find((v) => v.id === variant.id);
      expect(item).toBeDefined();
      expect(item!.taskId).toBe(task.id);
      expect(item!.taskName).toBe(task.name);
      expect(item!.taskSlug).toBe(task.slug);
      expect(item!.taskImage).toBe(task.image);
    });

    it('returns empty result when no published variants exist', async () => {
      // Create only non-published variants under a unique task to avoid
      // interference with published variants created by other tests
      const task = await TaskFactory.create();
      await TaskVariantFactory.create({ taskId: task.id, status: 'draft' });

      // Filter to just this task to isolate the assertion
      const result = await repository.listAllPublished({
        ...defaultOptions,
        filters: [{ field: 'task.id', operator: 'eq', value: task.id }],
      });

      expect(result.items).toHaveLength(0);
      expect(result.totalItems).toBe(0);
    });

    it('paginates correctly', async () => {
      const task = await TaskFactory.create();
      await TaskVariantFactory.create({ taskId: task.id, name: 'Alpha', status: 'published' });
      await TaskVariantFactory.create({ taskId: task.id, name: 'Beta', status: 'published' });
      await TaskVariantFactory.create({ taskId: task.id, name: 'Gamma', status: 'published' });

      const page1 = await repository.listAllPublished({
        ...defaultOptions,
        filters: [{ field: 'task.id', operator: 'eq', value: task.id }],
        perPage: 2,
        page: 1,
      });
      const page2 = await repository.listAllPublished({
        ...defaultOptions,
        filters: [{ field: 'task.id', operator: 'eq', value: task.id }],
        perPage: 2,
        page: 2,
      });

      expect(page1.totalItems).toBe(3);
      expect(page1.items).toHaveLength(2);
      expect(page2.items).toHaveLength(1);

      const allIds = [...page1.items.map((v) => v.id), ...page2.items.map((v) => v.id)];
      expect(new Set(allIds).size).toBe(3);
    });

    it('filters by task.id', async () => {
      const taskA = await TaskFactory.create();
      const taskB = await TaskFactory.create();
      const variantA = await TaskVariantFactory.create({ taskId: taskA.id, status: 'published' });
      await TaskVariantFactory.create({ taskId: taskB.id, status: 'published' });

      const result = await repository.listAllPublished({
        ...defaultOptions,
        filters: [{ field: 'task.id', operator: 'eq', value: taskA.id }],
      });

      expect(result.items.every((v) => v.taskId === taskA.id)).toBe(true);
      expect(result.items.map((v) => v.id)).toContain(variantA.id);
    });

    it('filters by task.slug', async () => {
      const taskA = await TaskFactory.create();
      const taskB = await TaskFactory.create();
      const variantA = await TaskVariantFactory.create({ taskId: taskA.id, status: 'published' });
      await TaskVariantFactory.create({ taskId: taskB.id, status: 'published' });

      const result = await repository.listAllPublished({
        ...defaultOptions,
        filters: [{ field: 'task.slug', operator: 'eq', value: taskA.slug }],
      });

      expect(result.items.every((v) => v.taskSlug === taskA.slug)).toBe(true);
      expect(result.items.map((v) => v.id)).toContain(variantA.id);
    });

    it('searches by variant name using partial match', async () => {
      const task = await TaskFactory.create();
      const matching = await TaskVariantFactory.create({
        taskId: task.id,
        name: 'Phonological Awareness Standard',
        status: 'published',
      });
      const nonMatching = await TaskVariantFactory.create({ taskId: task.id, name: 'Unrelated', status: 'published' });

      // Search for a substring — exercises the %…% wildcard
      const result = await repository.listAllPublished({
        ...defaultOptions,
        search: 'Awareness',
        filters: [{ field: 'task.id', operator: 'eq', value: task.id }],
      });

      const ids = result.items.map((v) => v.id);
      expect(ids).toContain(matching.id);
      expect(ids).not.toContain(nonMatching.id);
    });

    it('searches by task name using partial match', async () => {
      const matchingTask = await TaskFactory.create({ name: 'UniqueTaskNameXYZ' });
      const otherTask = await TaskFactory.create();
      const matchingVariant = await TaskVariantFactory.create({ taskId: matchingTask.id, status: 'published' });
      const otherVariant = await TaskVariantFactory.create({ taskId: otherTask.id, status: 'published' });

      // Search for a substring of the task name — exercises cross-field ILIKE
      const result = await repository.listAllPublished({
        ...defaultOptions,
        search: 'TaskNameXYZ',
        filters: [{ field: 'task.id', operator: 'in', value: [matchingTask.id, otherTask.id].join(',') }],
      });

      const ids = result.items.map((v) => v.id);
      expect(ids).toContain(matchingVariant.id);
      expect(ids).not.toContain(otherVariant.id);
    });

    it('searches by variant description using partial match', async () => {
      const task = await TaskFactory.create();
      const matching = await TaskVariantFactory.create({
        taskId: task.id,
        description: 'UniqueVariantDescriptionABC',
        status: 'published',
      });
      const nonMatching = await TaskVariantFactory.create({
        taskId: task.id,
        description: 'Unrelated description',
        status: 'published',
      });

      // Search for a substring of the description — exercises the %…% wildcard
      const result = await repository.listAllPublished({
        ...defaultOptions,
        search: 'VariantDescriptionABC',
        filters: [{ field: 'task.id', operator: 'eq', value: task.id }],
      });

      const ids = result.items.map((v) => v.id);
      expect(ids).toContain(matching.id);
      expect(ids).not.toContain(nonMatching.id);
    });

    it('searches by task description using partial match', async () => {
      const matchingTask = await TaskFactory.create({ description: 'UniqueTaskDescriptionDEF' });
      const otherTask = await TaskFactory.create();
      const matchingVariant = await TaskVariantFactory.create({ taskId: matchingTask.id, status: 'published' });
      const otherVariant = await TaskVariantFactory.create({ taskId: otherTask.id, status: 'published' });

      // Search for a substring of the task description — exercises cross-field ILIKE
      const result = await repository.listAllPublished({
        ...defaultOptions,
        search: 'TaskDescriptionDEF',
        filters: [{ field: 'task.id', operator: 'in', value: [matchingTask.id, otherTask.id].join(',') }],
      });

      const ids = result.items.map((v) => v.id);
      expect(ids).toContain(matchingVariant.id);
      expect(ids).not.toContain(otherVariant.id);
    });

    it('sorts by variant.name ascending', async () => {
      const task = await TaskFactory.create();
      await TaskVariantFactory.create({ taskId: task.id, name: 'Zebra', status: 'published' });
      await TaskVariantFactory.create({ taskId: task.id, name: 'Apple', status: 'published' });
      await TaskVariantFactory.create({ taskId: task.id, name: 'Mango', status: 'published' });

      const result = await repository.listAllPublished({
        ...defaultOptions,
        sortBy: 'variant.name',
        sortOrder: 'asc',
        filters: [{ field: 'task.id', operator: 'eq', value: task.id }],
      });

      const names = result.items.map((v) => v.name);
      expect(names).toEqual([...names].sort());
    });

    it('sorts by task.name descending', async () => {
      const taskA = await TaskFactory.create({ name: 'AAA Task' });
      const taskB = await TaskFactory.create({ name: 'ZZZ Task' });
      await TaskVariantFactory.create({ taskId: taskA.id, status: 'published' });
      await TaskVariantFactory.create({ taskId: taskB.id, status: 'published' });

      const result = await repository.listAllPublished({
        ...defaultOptions,
        sortBy: 'task.name',
        sortOrder: 'desc',
        filters: [{ field: 'task.id', operator: 'in', value: [taskA.id, taskB.id].join(',') }],
      });

      const taskNames = result.items.map((v) => v.taskName);
      expect(taskNames[0]).toBe('ZZZ Task');
      expect(taskNames[taskNames.length - 1]).toBe('AAA Task');
    });
  });
});
