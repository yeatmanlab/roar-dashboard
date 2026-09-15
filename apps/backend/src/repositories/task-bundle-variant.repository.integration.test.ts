/**
 * Integration tests for TaskBundleVariantRepository.
 *
 * Tests getVariantsWithTaskDetailsByBundleIds against the real database.
 * Covers empty input, single bundle, multiple bundles, sort order, and join correctness.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { TaskFactory } from '../test-support/factories/task.factory';
import { TaskVariantFactory } from '../test-support/factories/task-variant.factory';
import { TaskBundleFactory } from '../test-support/factories/task-bundle.factory';
import { TaskBundleVariantFactory } from '../test-support/factories/task-bundle-variant.factory';
import { TaskBundleVariantRepository } from './task-bundle-variant.repository';

describe('TaskBundleVariantRepository', () => {
  let repository: TaskBundleVariantRepository;

  beforeAll(() => {
    repository = new TaskBundleVariantRepository();
  });

  describe('getVariantsWithTaskDetailsByBundleIds', () => {
    it('returns empty array when bundleIds is empty', async () => {
      const result = await repository.getVariantsWithTaskDetailsByBundleIds([]);

      expect(result).toEqual([]);
    });

    it('returns empty array when bundle has no variants', async () => {
      const bundle = await TaskBundleFactory.create();

      const result = await repository.getVariantsWithTaskDetailsByBundleIds([bundle.id]);

      expect(result).toEqual([]);
    });

    it('returns empty array when bundleId does not exist', async () => {
      const result = await repository.getVariantsWithTaskDetailsByBundleIds(['00000000-0000-0000-0000-000000000000']);

      expect(result).toEqual([]);
    });

    it('returns variant with all task and task variant fields joined', async () => {
      const task = await TaskFactory.create();
      const variant = await TaskVariantFactory.create({
        taskId: task.id,
        name: 'IntegrationVariant',
        description: 'A test variant',
        status: 'published',
      });
      const bundle = await TaskBundleFactory.create();
      await TaskBundleVariantFactory.create({
        taskBundleId: bundle.id,
        taskVariantId: variant.id,
        sortOrder: 0,
      });

      const result = await repository.getVariantsWithTaskDetailsByBundleIds([bundle.id]);

      expect(result).toHaveLength(1);
      const row = result[0]!;
      expect(row.taskBundleId).toBe(bundle.id);
      expect(row.taskVariantId).toBe(variant.id);
      expect(row.sortOrder).toBe(0);
      // From task_variants
      expect(row.taskId).toBe(task.id);
      expect(row.taskVariantName).toBe('IntegrationVariant');
      expect(row.description).toBe('A test variant');
      expect(row.status).toBe('published');
      expect(row.createdAt).toBeInstanceOf(Date);
      // From tasks
      expect(row.taskSlug).toBe(task.slug);
      expect(row.taskName).toBe(task.name);
      expect(row.taskImage).toBe(task.image);
    });

    it('returns all variants for a bundle ordered by sortOrder', async () => {
      const task = await TaskFactory.create();
      const v1 = await TaskVariantFactory.create({ taskId: task.id, status: 'published' });
      const v2 = await TaskVariantFactory.create({ taskId: task.id, status: 'published' });
      const v3 = await TaskVariantFactory.create({ taskId: task.id, status: 'published' });
      const bundle = await TaskBundleFactory.create();
      // Insert out of order to verify sortOrder is respected
      await TaskBundleVariantFactory.create({ taskBundleId: bundle.id, taskVariantId: v3.id, sortOrder: 2 });
      await TaskBundleVariantFactory.create({ taskBundleId: bundle.id, taskVariantId: v1.id, sortOrder: 0 });
      await TaskBundleVariantFactory.create({ taskBundleId: bundle.id, taskVariantId: v2.id, sortOrder: 1 });

      const result = await repository.getVariantsWithTaskDetailsByBundleIds([bundle.id]);

      expect(result).toHaveLength(3);
      expect(result[0]!.sortOrder).toBe(0);
      expect(result[0]!.taskVariantId).toBe(v1.id);
      expect(result[1]!.sortOrder).toBe(1);
      expect(result[1]!.taskVariantId).toBe(v2.id);
      expect(result[2]!.sortOrder).toBe(2);
      expect(result[2]!.taskVariantId).toBe(v3.id);
    });

    it('returns variants for multiple bundles grouped by bundleId', async () => {
      const task = await TaskFactory.create();
      const v1 = await TaskVariantFactory.create({ taskId: task.id, status: 'published' });
      const v2 = await TaskVariantFactory.create({ taskId: task.id, status: 'published' });
      const bundle1 = await TaskBundleFactory.create();
      const bundle2 = await TaskBundleFactory.create();
      await TaskBundleVariantFactory.create({ taskBundleId: bundle1.id, taskVariantId: v1.id, sortOrder: 0 });
      await TaskBundleVariantFactory.create({ taskBundleId: bundle2.id, taskVariantId: v2.id, sortOrder: 0 });

      const result = await repository.getVariantsWithTaskDetailsByBundleIds([bundle1.id, bundle2.id]);

      expect(result).toHaveLength(2);
      const bundle1Rows = result.filter((r) => r.taskBundleId === bundle1.id);
      const bundle2Rows = result.filter((r) => r.taskBundleId === bundle2.id);
      expect(bundle1Rows).toHaveLength(1);
      expect(bundle1Rows[0]!.taskVariantId).toBe(v1.id);
      expect(bundle2Rows).toHaveLength(1);
      expect(bundle2Rows[0]!.taskVariantId).toBe(v2.id);
    });

    it('only returns variants for specified bundles', async () => {
      const task = await TaskFactory.create();
      const v1 = await TaskVariantFactory.create({ taskId: task.id, status: 'published' });
      const v2 = await TaskVariantFactory.create({ taskId: task.id, status: 'published' });
      const bundle1 = await TaskBundleFactory.create();
      const bundle2 = await TaskBundleFactory.create();
      await TaskBundleVariantFactory.create({ taskBundleId: bundle1.id, taskVariantId: v1.id, sortOrder: 0 });
      await TaskBundleVariantFactory.create({ taskBundleId: bundle2.id, taskVariantId: v2.id, sortOrder: 0 });

      // Only query bundle1
      const result = await repository.getVariantsWithTaskDetailsByBundleIds([bundle1.id]);

      expect(result.every((r) => r.taskBundleId === bundle1.id)).toBe(true);
      expect(result.map((r) => r.taskVariantId)).not.toContain(v2.id);
    });
  });
});
