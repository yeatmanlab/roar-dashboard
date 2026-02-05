/**
 * Integration tests for AdministrationTaskVariantRepository.
 *
 * Tests the `getByAdministrationIds` method against the real database.
 * Requires tasks, task variants, and administration_task_variants records,
 * which are created per-test using factories since the base fixture does
 * not include task/variant data.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { baseFixture } from '../test-support/fixtures';
import { AdministrationFactory } from '../test-support/factories/administration.factory';
import { TaskFactory } from '../test-support/factories/task.factory';
import { TaskVariantFactory } from '../test-support/factories/task-variant.factory';
import { AdministrationTaskVariantFactory } from '../test-support/factories/administration-task-variant.factory';
import { AdministrationTaskVariantRepository } from './administration-task-variant.repository';
import type { Administration, Task, TaskVariant } from '../db/schema';

describe('AdministrationTaskVariantRepository', () => {
  const repository = new AdministrationTaskVariantRepository();

  // Shared test data created once for this file
  let adminA: Administration;
  let adminB: Administration;
  let adminEmpty: Administration;
  let taskSwr: Task;
  let taskPa: Task;
  let variantSwrDefault: TaskVariant;
  let variantSwrSpanish: TaskVariant;
  let variantPaDefault: TaskVariant;

  beforeAll(async () => {
    // Create tasks
    [taskSwr, taskPa] = await Promise.all([
      TaskFactory.create({ name: 'Sight Word Recognition', nameSimple: 'SWR', nameTechnical: 'SWR Tech' }),
      TaskFactory.create({ name: 'Phonological Awareness', nameSimple: 'PA', nameTechnical: 'PA Tech' }),
    ]);

    // Create task variants
    [variantSwrDefault, variantSwrSpanish, variantPaDefault] = await Promise.all([
      TaskVariantFactory.create({ taskId: taskSwr.id, name: 'Default' }),
      TaskVariantFactory.create({ taskId: taskSwr.id, name: 'Spanish' }),
      TaskVariantFactory.create({ taskId: taskPa.id, name: 'Default' }),
    ]);

    // Create administrations
    [adminA, adminB, adminEmpty] = await Promise.all([
      AdministrationFactory.create({ name: 'Task Variant Test Admin A', createdBy: baseFixture.districtAdmin.id }),
      AdministrationFactory.create({ name: 'Task Variant Test Admin B', createdBy: baseFixture.districtAdmin.id }),
      AdministrationFactory.create({ name: 'Task Variant Test Admin Empty', createdBy: baseFixture.districtAdmin.id }),
    ]);

    // Assign task variants to administrations
    // Admin A: SWR Default (order 0), PA Default (order 1), SWR Spanish (order 2)
    // Admin B: PA Default (order 0)
    // Admin Empty: no assignments
    await Promise.all([
      AdministrationTaskVariantFactory.create({
        administrationId: adminA.id,
        taskVariantId: variantSwrDefault.id,
        orderIndex: 0,
      }),
      AdministrationTaskVariantFactory.create({
        administrationId: adminA.id,
        taskVariantId: variantPaDefault.id,
        orderIndex: 1,
      }),
      AdministrationTaskVariantFactory.create({
        administrationId: adminA.id,
        taskVariantId: variantSwrSpanish.id,
        orderIndex: 2,
      }),
      AdministrationTaskVariantFactory.create({
        administrationId: adminB.id,
        taskVariantId: variantPaDefault.id,
        orderIndex: 0,
      }),
    ]);
  });

  describe('getByAdministrationIds', () => {
    it('returns empty map for empty input array', async () => {
      const result = await repository.getByAdministrationIds([]);

      expect(result).toEqual(new Map());
    });

    it('returns tasks with correct enriched data', async () => {
      const result = await repository.getByAdministrationIds([adminA.id]);

      const tasks = result.get(adminA.id);
      expect(tasks).toBeDefined();
      expect(tasks).toHaveLength(3);

      // Verify enriched fields from the join
      const firstTask = tasks![0]!;
      expect(firstTask.taskId).toBe(taskSwr.id);
      expect(firstTask.taskName).toBe('Sight Word Recognition');
      expect(firstTask.variantId).toBe(variantSwrDefault.id);
      expect(firstTask.variantName).toBe('Default');
      expect(firstTask.orderIndex).toBe(0);
    });

    it('returns tasks ordered by orderIndex', async () => {
      const result = await repository.getByAdministrationIds([adminA.id]);

      const tasks = result.get(adminA.id)!;
      expect(tasks).toHaveLength(3);
      expect(tasks[0]!.orderIndex).toBe(0);
      expect(tasks[1]!.orderIndex).toBe(1);
      expect(tasks[2]!.orderIndex).toBe(2);

      // Verify correct variant at each position
      expect(tasks[0]!.variantId).toBe(variantSwrDefault.id);
      expect(tasks[1]!.variantId).toBe(variantPaDefault.id);
      expect(tasks[2]!.variantId).toBe(variantSwrSpanish.id);
    });

    it('returns tasks for multiple administrations', async () => {
      const result = await repository.getByAdministrationIds([adminA.id, adminB.id]);

      expect(result.size).toBe(2);

      const tasksA = result.get(adminA.id)!;
      expect(tasksA).toHaveLength(3);

      const tasksB = result.get(adminB.id)!;
      expect(tasksB).toHaveLength(1);
      expect(tasksB[0]!.taskId).toBe(taskPa.id);
      expect(tasksB[0]!.taskName).toBe('Phonological Awareness');
    });

    it('omits administrations with no task variants', async () => {
      const result = await repository.getByAdministrationIds([adminA.id, adminEmpty.id]);

      expect(result.has(adminA.id)).toBe(true);
      expect(result.has(adminEmpty.id)).toBe(false);
    });

    it('returns empty map when no administrations have task variants', async () => {
      const result = await repository.getByAdministrationIds([adminEmpty.id]);

      expect(result.size).toBe(0);
    });

    it('handles nonexistent administration IDs', async () => {
      const result = await repository.getByAdministrationIds(['00000000-0000-0000-0000-000000000000']);

      expect(result.size).toBe(0);
    });
  });
});
