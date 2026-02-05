import { Factory } from 'fishery';
import { faker } from '@faker-js/faker';
import type { TaskVariant, NewTaskVariant } from '../../db/schema';
import { CoreDbClient } from '../../db/clients';
import { taskVariants } from '../../db/schema/core';

/**
 * Factory for creating TaskVariant test objects.
 *
 * Usage:
 * - `TaskVariantFactory.build()` - Creates in-memory object (unit tests)
 * - `await TaskVariantFactory.create({ taskId })` - Persists to database (integration tests)
 *
 * Note: `taskId` is required when using `create()`. The referenced task must already exist.
 */
export const TaskVariantFactory = Factory.define<TaskVariant>(({ onCreate }) => {
  onCreate(async (variant) => {
    if (!variant.taskId || variant.taskId === '00000000-0000-0000-0000-000000000000') {
      throw new Error('TaskVariantFactory.create() requires taskId to reference an existing task');
    }

    const insertData: NewTaskVariant = {
      id: variant.id,
      taskId: variant.taskId,
      name: variant.name,
      description: variant.description,
      status: variant.status,
    };

    const [inserted] = await CoreDbClient.insert(taskVariants).values(insertData).returning();
    if (!inserted) throw new Error('Failed to insert task variant');
    return inserted;
  });

  return {
    id: faker.string.uuid(),
    taskId: '00000000-0000-0000-0000-000000000000', // Sentinel; must be overridden when using create()
    name: faker.word.words(2),
    description: faker.lorem.sentence(),
    status: 'published' as const,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
});
