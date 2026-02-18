import { Factory } from 'fishery';
import { faker } from '@faker-js/faker';
import type { TaskVariantParameter, NewTaskVariantParameter } from '../../db/schema';
import { CoreDbClient } from '../../db/clients';
import { taskVariantParameters } from '../../db/schema/core';

/**
 * Factory for creating TaskVariantParameter test objects.
 *
 * Usage:
 * - `TaskVariantParameterFactory.build()` - Creates in-memory object (unit tests)
 * - `await TaskVariantParameterFactory.create({ taskVariantId, name })` - Persists to database
 *
 * IMPORTANT: taskVariantId and name are required for database persistence.
 * The referenced task variant must already exist.
 */
export const TaskVariantParameterFactory = Factory.define<TaskVariantParameter>(({ onCreate, sequence }) => {
  onCreate(async (param) => {
    if (!param.taskVariantId || param.taskVariantId === '00000000-0000-0000-0000-000000000000') {
      throw new Error('TaskVariantParameterFactory.create() requires taskVariantId to reference an existing variant');
    }

    if (!param.name) {
      throw new Error('TaskVariantParameterFactory.create() requires name');
    }

    const insertData: NewTaskVariantParameter = {
      taskVariantId: param.taskVariantId,
      name: param.name,
      value: param.value,
    };

    const [inserted] = await CoreDbClient.insert(taskVariantParameters).values(insertData).returning();
    if (!inserted) throw new Error('Failed to insert task variant parameter');
    return inserted;
  });

  return {
    taskVariantId: '00000000-0000-0000-0000-000000000000', // Sentinel; must be overridden when using create()
    name: `param-${sequence}`, // Sentinel; should be overridden for meaningful tests
    value: { setting: faker.word.words(2), enabled: true },
    createdAt: new Date(),
    updatedAt: new Date(),
  };
});
