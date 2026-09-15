import { Factory } from 'fishery';
import { faker } from '@faker-js/faker';
import type { TaskBundle, NewTaskBundle } from '../../db/schema';
import { CoreDbClient } from '../../db/clients';
import { taskBundles } from '../../db/schema/core';
import type { TaskBundleVariantWithTaskDetails } from '../../repositories/task-bundle-variant.repository';
import { TaskFactory } from './task.factory';
import { TaskVariantFactory } from './task-variant.factory';

/**
 * Factory for creating TaskBundle test objects.
 *
 * Usage:
 * - `TaskBundleFactory.build()` - Creates in-memory object (unit tests)
 * - `await TaskBundleFactory.create()` - Persists to database (integration tests)
 */
export const TaskBundleFactory = Factory.define<TaskBundle>(({ onCreate, sequence }) => {
  onCreate(async (bundle) => {
    const insertData: NewTaskBundle = {
      id: bundle.id,
      slug: bundle.slug,
      name: bundle.name,
      description: bundle.description,
      image: bundle.image,
    };

    const [inserted] = await CoreDbClient.insert(taskBundles).values(insertData).returning();
    if (!inserted) throw new Error('Failed to insert task bundle');
    return inserted;
  });

  return {
    id: faker.string.uuid(),
    slug: `bundle-${sequence}-${faker.string.alphanumeric(6).toLowerCase()}`,
    name: faker.word.words(3).replace(/\b\w/g, (c) => c.toUpperCase()),
    description: faker.lorem.sentence(),
    image: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
});

/**
 * Builds an in-memory TaskBundleVariantWithTaskDetails by combining
 * TaskBundleFactory, TaskVariantFactory, and TaskFactory builds.
 * Use this in unit tests that need the joined shape returned by
 * `TaskBundleVariantRepository.getVariantsWithTaskDetailsByBundleIds`.
 *
 * @param overrides - Optional field overrides applied after the defaults
 * @returns A TaskBundleVariantWithTaskDetails object suitable for unit test assertions
 */
export function buildTaskBundleVariantWithDetails(
  overrides: Partial<TaskBundleVariantWithTaskDetails> = {},
): TaskBundleVariantWithTaskDetails {
  const bundle = TaskBundleFactory.build();
  const task = TaskFactory.build();
  const variant = TaskVariantFactory.build({ taskId: task.id });
  return {
    taskBundleId: bundle.id,
    taskVariantId: variant.id,
    sortOrder: 0,
    taskId: task.id,
    taskVariantName: variant.name,
    description: variant.description,
    status: variant.status,
    createdAt: variant.createdAt,
    updatedAt: variant.updatedAt,
    taskSlug: task.slug,
    taskName: task.name,
    taskImage: task.image,
    ...overrides,
  };
}
