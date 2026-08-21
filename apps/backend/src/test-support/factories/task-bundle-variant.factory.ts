import { Factory } from 'fishery';
import type { TaskBundleVariant, NewTaskBundleVariant } from '../../db/schema';
import { CoreDbClient } from '../../db/clients';
import { taskBundleVariants } from '../../db/schema/core';

/**
 * Factory for creating TaskBundleVariant junction records.
 *
 * Usage:
 * - `TaskBundleVariantFactory.build()` - Creates in-memory object (unit tests)
 * - `await TaskBundleVariantFactory.create({ taskBundleId, taskVariantId })` - Persists to database
 *
 * Note: `taskBundleId` and `taskVariantId` are required when using `create()`.
 *       Both referenced records must already exist.
 */
export const TaskBundleVariantFactory = Factory.define<TaskBundleVariant>(({ onCreate, sequence }) => {
  onCreate(async (record) => {
    if (
      !record.taskBundleId ||
      record.taskBundleId === '00000000-0000-0000-0000-000000000000' ||
      !record.taskVariantId ||
      record.taskVariantId === '00000000-0000-0000-0000-000000000000'
    ) {
      throw new Error(
        'TaskBundleVariantFactory.create() requires taskBundleId and taskVariantId to reference existing records',
      );
    }

    const insertData: NewTaskBundleVariant = {
      taskBundleId: record.taskBundleId,
      taskVariantId: record.taskVariantId,
      sortOrder: record.sortOrder,
    };

    const [inserted] = await CoreDbClient.insert(taskBundleVariants).values(insertData).returning();
    if (!inserted) throw new Error('Failed to insert task bundle variant');
    return inserted;
  });

  return {
    taskBundleId: '00000000-0000-0000-0000-000000000000', // Sentinel; must be overridden when using create()
    taskVariantId: '00000000-0000-0000-0000-000000000000', // Sentinel; must be overridden when using create()
    sortOrder: sequence,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
});
