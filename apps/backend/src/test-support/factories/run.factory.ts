import { Factory } from 'fishery';
import { faker } from '@faker-js/faker';
import type { Run, NewRun } from '../../db/schema/assessment';
import { getAssessmentDbClient } from '../../db/clients';
import { runs } from '../../db/schema/assessment';

/**
 * Factory for creating Run test objects in the assessment database.
 *
 * Usage:
 * - `RunFactory.build()` - Creates in-memory object (unit tests)
 * - `await RunFactory.create({ userId, administrationId })` - Persists to database (integration tests)
 *
 * Note: The assessment DB has no FK constraints to the core DB, so arbitrary UUIDs
 * work for `userId`, `taskId`, `taskVariantId`, and `administrationId`.
 */
export const RunFactory = Factory.define<Run>(({ onCreate }) => {
  onCreate(async (run) => {
    const insertData: NewRun = {
      id: run.id,
      userId: run.userId,
      taskId: run.taskId,
      taskVariantId: run.taskVariantId,
      taskVersion: run.taskVersion,
      administrationId: run.administrationId,
      bestRun: run.bestRun,
      reliableRun: run.reliableRun,
      engagementFlags: run.engagementFlags,
      metadata: run.metadata,
      excludeFromResearch: run.excludeFromResearch,
      completedAt: run.completedAt,
    };

    const [inserted] = await getAssessmentDbClient().insert(runs).values(insertData).returning();
    if (!inserted) throw new Error('Failed to insert run');
    return inserted;
  });

  return {
    id: faker.string.uuid(),
    userId: faker.string.uuid(),
    taskId: faker.string.uuid(),
    taskVariantId: faker.string.uuid(),
    taskVersion: '1.0.0',
    administrationId: faker.string.uuid(),
    bestRun: false,
    reliableRun: false,
    engagementFlags: null,
    metadata: null,
    excludeFromResearch: false,
    completedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
});
