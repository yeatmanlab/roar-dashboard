import { Factory } from 'fishery';
import { faker } from '@faker-js/faker';
import type { Task, NewTask } from '../../db/schema';
import { CoreDbClient } from '../../db/clients';
import { tasks } from '../../db/schema/core';

/**
 * Factory for creating Task test objects.
 *
 * Usage:
 * - `TaskFactory.build()` - Creates in-memory object (unit tests)
 * - `await TaskFactory.create()` - Persists to database (integration tests)
 */
export const TaskFactory = Factory.define<Task>(({ onCreate, sequence }) => {
  onCreate(async (task) => {
    const insertData: NewTask = {
      id: task.id,
      slug: task.slug,
      name: task.name,
      nameSimple: task.nameSimple,
      nameTechnical: task.nameTechnical,
      description: task.description,
      image: task.image,
      tutorialVideo: task.tutorialVideo,
      taskConfig: task.taskConfig,
    };

    const [inserted] = await CoreDbClient.insert(tasks).values(insertData).returning();
    if (!inserted) throw new Error('Failed to insert task');
    return inserted;
  });

  const name = faker.word.words(2).replace(/\b\w/g, (c) => c.toUpperCase());

  return {
    id: faker.string.uuid(),
    slug: `task-${sequence}-${faker.string.alphanumeric(6).toLowerCase()}`,
    name,
    nameSimple: name,
    nameTechnical: `${name} Technical`,
    description: faker.lorem.sentence(),
    image: null,
    tutorialVideo: null,
    taskConfig: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  };
});
