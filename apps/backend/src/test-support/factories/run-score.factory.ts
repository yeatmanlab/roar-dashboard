import { Factory } from 'fishery';
import { faker } from '@faker-js/faker';
import type { RunScore, NewRunScore } from '../../db/schema/assessment';
import { AssessmentDbClient } from '../../db/clients';
import { runScores } from '../../db/schema/assessment';

/**
 * Factory for creating RunScore test objects in the assessment database.
 *
 * Usage:
 * - `RunScoreFactory.build()` - Creates in-memory object (unit tests)
 * - `await RunScoreFactory.create({ runId })` - Persists to database (integration tests)
 *
 * Note: The assessment DB has no FK constraints enforced at the FDW level,
 * but `runId` references `runs.id` with cascade delete in the assessment DB.
 */
export const RunScoreFactory = Factory.define<RunScore>(({ onCreate }) => {
  onCreate(async (score) => {
    const insertData: NewRunScore = {
      id: score.id,
      runId: score.runId,
      type: score.type,
      domain: score.domain,
      name: score.name,
      value: score.value,
      assessmentStage: score.assessmentStage,
      categoryScore: score.categoryScore,
    };

    const [inserted] = await AssessmentDbClient.insert(runScores).values(insertData).returning();
    if (!inserted) throw new Error('Failed to insert run score');
    return inserted;
  });

  return {
    id: faker.string.uuid(),
    runId: faker.string.uuid(),
    type: 'computed',
    domain: 'default',
    name: 'score',
    value: '0',
    assessmentStage: null,
    categoryScore: null,
    createdAt: new Date(),
    updatedAt: null,
  };
});
