/**
 * Integration tests for FoundationalCompositeService.
 *
 * Exercises the real assessment-DB write path of `recomputeForRun`: seeding subtest
 * reporting runs + their `composite_foundational` scores, running the recompute inside a
 * transaction, and asserting the composite is written to the dedicated composite run and
 * that re-running is idempotent.
 *
 * Note: the `slug -> taskId` resolution is a CORE-DB concern (TaskRepository). We mock only
 * that lookup so the test focuses on the assessment-DB behavior against the real database;
 * the run/run-scores repositories are real and hit the real DB.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { faker } from '@faker-js/faker';
import { and, eq } from 'drizzle-orm';
import { RunFactory } from '../../test-support/factories/run.factory';
import { RunScoreFactory } from '../../test-support/factories/run-score.factory';
import { TaskFactory } from '../../test-support/factories/task.factory';
import { createMockTaskRepository } from '../../test-support/repositories';
import { RunRepository } from '../../repositories/run.repository';
import { RunScoresRepository } from '../../repositories/run-scores.repository';
import { FoundationalCompositeService } from './foundational-composite.service';
import { SCORE_TYPE, SCORE_DOMAIN, SCORE_NAME } from '../../constants/run-scores';
import { FOUNDATIONAL_COMPOSITE_SLUG } from '../../constants/foundational-composite';
import { AssessmentDbClient } from '../../db/clients';
import { runScores } from '../../db/schema/assessment';

describe('FoundationalCompositeService (integration)', () => {
  let runRepository: RunRepository;
  let runScoresRepository: RunScoresRepository;
  let service: ReturnType<typeof FoundationalCompositeService>;

  // Foundational task ids. Only the slug -> id lookup is mocked (a core-DB concern); the runs
  // and scores below are written to the real assessment DB.
  const PA_TASK_ID = faker.string.uuid();
  const SWR_TASK_ID = faker.string.uuid();

  beforeAll(() => {
    runRepository = new RunRepository();
    runScoresRepository = new RunScoresRepository();

    const taskRepository = createMockTaskRepository();
    taskRepository.getBySlug.mockImplementation(async (slug: string) => {
      if (slug === FOUNDATIONAL_COMPOSITE_SLUG.PA) return TaskFactory.build({ id: PA_TASK_ID, slug });
      if (slug === FOUNDATIONAL_COMPOSITE_SLUG.SWR) return TaskFactory.build({ id: SWR_TASK_ID, slug });
      return null;
    });

    service = FoundationalCompositeService({ runRepository, runScoresRepository, taskRepository });
  });

  /** Seeds a `(computed, composite_foundational)` theta pair (estimate + SE) on a run. */
  async function seedTheta(runId: string, thetaEstimate: string, thetaSE: string) {
    await RunScoreFactory.create({
      runId,
      type: SCORE_TYPE.COMPUTED,
      domain: SCORE_DOMAIN.COMPOSITE_FOUNDATIONAL,
      name: SCORE_NAME.THETA_ESTIMATE,
      value: thetaEstimate,
      assessmentStage: null,
      categoryScore: null,
    });
    await RunScoreFactory.create({
      runId,
      type: SCORE_TYPE.COMPUTED,
      domain: SCORE_DOMAIN.COMPOSITE_FOUNDATIONAL,
      name: SCORE_NAME.THETA_SE,
      value: thetaSE,
      assessmentStage: null,
      categoryScore: null,
    });
  }

  /** Reads the composite `thetaEstimate` value(s) written to the (user, admin) composite run. */
  async function readCompositeValues(userId: string, administrationId: string): Promise<string[]> {
    const compositeRun = await runRepository.runTransaction({
      fn: async (tx) => {
        await runRepository.lockCompositeForUpdate({ userId, administrationId, transaction: tx });
        return runRepository.findOrCreateCompositeRun({ userId, administrationId, transaction: tx });
      },
    });
    const rows = await AssessmentDbClient.select()
      .from(runScores)
      .where(
        and(
          eq(runScores.runId, compositeRun.id),
          eq(runScores.domain, SCORE_DOMAIN.COMPOSITE_FOUNDATIONAL),
          eq(runScores.name, SCORE_NAME.THETA_ESTIMATE),
        ),
      );
    return rows.map((r) => r.value);
  }

  it('writes the composite to the composite run and is idempotent across re-runs', async () => {
    const userId = faker.string.uuid();
    const administrationId = faker.string.uuid();

    // Seed a PA reporting run with a composite_foundational theta pair. A single subtest's
    // inverse-variance LPW equals its estimate, so the composite is exactly 1.5.
    const paRun = await RunFactory.create({ userId, administrationId, taskId: PA_TASK_ID, useForReporting: true });
    await RunScoreFactory.create({
      runId: paRun.id,
      type: SCORE_TYPE.COMPUTED,
      domain: SCORE_DOMAIN.COMPOSITE_FOUNDATIONAL,
      name: SCORE_NAME.THETA_ESTIMATE,
      value: '1.5',
      assessmentStage: null,
      categoryScore: null,
    });
    await RunScoreFactory.create({
      runId: paRun.id,
      type: SCORE_TYPE.COMPUTED,
      domain: SCORE_DOMAIN.COMPOSITE_FOUNDATIONAL,
      name: SCORE_NAME.THETA_SE,
      value: '0.5',
      assessmentStage: null,
      categoryScore: null,
    });
    await RunScoreFactory.create({
      runId: paRun.id,
      type: SCORE_TYPE.COMPUTED,
      domain: SCORE_DOMAIN.COMPOSITE_FOUNDATIONAL,
      name: 'scoringVersion',
      value: '5',
      assessmentStage: null,
      categoryScore: null,
    });

    // Run the recompute twice, each inside its own transaction.
    for (let i = 0; i < 2; i++) {
      await runRepository.runTransaction({
        fn: async (tx) => {
          await service.recomputeForRun({
            userId,
            administrationId,
            triggeringTaskId: PA_TASK_ID,
            triggeredAt: new Date(),
            transaction: tx,
          });
        },
      });
    }

    // Resolve the composite run (created by the recompute) and read its composite score.
    const compositeRun = await runRepository.runTransaction({
      fn: async (tx) => {
        await runRepository.lockCompositeForUpdate({ userId, administrationId, transaction: tx });
        return runRepository.findOrCreateCompositeRun({ userId, administrationId, transaction: tx });
      },
    });

    const compositeScores = await AssessmentDbClient.select()
      .from(runScores)
      .where(
        and(
          eq(runScores.runId, compositeRun.id),
          eq(runScores.domain, SCORE_DOMAIN.COMPOSITE_FOUNDATIONAL),
          eq(runScores.name, SCORE_NAME.THETA_ESTIMATE),
        ),
      );

    // Idempotent: exactly one composite row, with the expected value.
    expect(compositeScores).toHaveLength(1);
    expect(compositeScores[0]!.value).toBe('1.5');
  });

  it('incorporates Word (SWR) into the composite when its scores are present', async () => {
    const userId = faker.string.uuid();
    const administrationId = faker.string.uuid();

    // PA estimate 1.0 (SE 0.5) and SWR estimate 2.0 (SE 0.5) have equal inverse-variance
    // weights, so the LPW composite is (1.0 + 2.0) / 2 = 1.5. PA alone would give 1.0, so a
    // result of 1.5 proves SWR's composite_foundational scores were incorporated.
    const paRun = await RunFactory.create({ userId, administrationId, taskId: PA_TASK_ID, useForReporting: true });
    await seedTheta(paRun.id, '1.0', '0.5');
    await RunScoreFactory.create({
      runId: paRun.id,
      type: SCORE_TYPE.COMPUTED,
      domain: SCORE_DOMAIN.COMPOSITE_FOUNDATIONAL,
      name: 'scoringVersion',
      value: '5',
      assessmentStage: null,
      categoryScore: null,
    });
    const swrRun = await RunFactory.create({ userId, administrationId, taskId: SWR_TASK_ID, useForReporting: true });
    await seedTheta(swrRun.id, '2.0', '0.5');
    await RunScoreFactory.create({
      runId: swrRun.id,
      type: SCORE_TYPE.COMPUTED,
      domain: SCORE_DOMAIN.COMPOSITE_FOUNDATIONAL,
      name: 'scoringVersion',
      value: '5',
      assessmentStage: null,
      categoryScore: null,
    });

    await runRepository.runTransaction({
      fn: async (tx) => {
        await service.recomputeForRun({
          userId,
          administrationId,
          triggeringTaskId: SWR_TASK_ID,
          triggeredAt: new Date(),
          transaction: tx,
        });
      },
    });

    const values = await readCompositeValues(userId, administrationId);
    expect(values).toHaveLength(1);
    expect(Number.parseFloat(values[0]!)).toBeCloseTo(1.5, 10);
  });
});
