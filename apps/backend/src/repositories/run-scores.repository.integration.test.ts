/**
 * Integration tests for RunScoresRepository.
 *
 * Tests `upsertMany` against the real assessment database, exercising the
 * `ON CONFLICT (run_id, type, domain, name, assessment_stage) DO UPDATE`
 * path and the `NULLS NOT DISTINCT` constraint that lets a NULL stage
 * still participate in the natural key.
 *
 * Uses RunFactory to seed parent runs (run_id has a FK with cascade delete);
 * uses RunScoreFactory only when the test wants to pre-seed score rows
 * outside the upsert path under test.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { eq, and } from 'drizzle-orm';
import { AssessmentDbClient } from '../db/clients';
import { runScores } from '../db/schema/assessment';
import { RunFactory } from '../test-support/factories/run.factory';
import { RunScoresRepository } from './run-scores.repository';
import { SCORE_TYPE, SCORE_DOMAIN, ASSESSMENT_STAGE, SCORE_NAME } from '../constants/run-scores';

describe('RunScoresRepository', () => {
  let repository: RunScoresRepository;

  beforeAll(() => {
    repository = new RunScoresRepository();
  });

  describe('upsertMany', () => {
    it('returns an empty array for empty input', async () => {
      const result = await repository.upsertMany({ data: [] });

      expect(result).toEqual([]);
    });

    it('inserts a single new score row', async () => {
      const run = await RunFactory.create();

      const result = await repository.upsertMany({
        data: [
          {
            runId: run.id,
            type: SCORE_TYPE.RAW,
            domain: SCORE_DOMAIN.COMPOSITE,
            name: SCORE_NAME.THETA_SE,
            value: '0.5',
            assessmentStage: ASSESSMENT_STAGE.TEST,
            categoryScore: null,
          },
        ],
      });

      expect(result).toHaveLength(1);
      expect(result[0]!.id).toBeDefined();

      const rows = await AssessmentDbClient.select().from(runScores).where(eq(runScores.runId, run.id));

      expect(rows).toHaveLength(1);
      expect(rows[0]!.value).toBe('0.5');
      expect(rows[0]!.assessmentStage).toBe(ASSESSMENT_STAGE.TEST);
    });

    it('inserts multiple new score rows in one call', async () => {
      const run = await RunFactory.create();

      const result = await repository.upsertMany({
        data: [
          {
            runId: run.id,
            type: SCORE_TYPE.RAW,
            domain: SCORE_DOMAIN.COMPOSITE,
            name: SCORE_NAME.THETA_SE,
            value: '0.5',
            assessmentStage: ASSESSMENT_STAGE.TEST,
          },
          {
            runId: run.id,
            type: SCORE_TYPE.RAW,
            domain: SCORE_DOMAIN.COMPOSITE,
            name: SCORE_NAME.NUM_ATTEMPTED,
            value: '12',
            assessmentStage: ASSESSMENT_STAGE.TEST,
          },
        ],
      });

      expect(result).toHaveLength(2);

      const rows = await AssessmentDbClient.select().from(runScores).where(eq(runScores.runId, run.id));

      expect(rows).toHaveLength(2);
      const byName = new Map(rows.map((r) => [r.name, r.value]));
      expect(byName.get(SCORE_NAME.THETA_SE)).toBe('0.5');
      expect(byName.get(SCORE_NAME.NUM_ATTEMPTED)).toBe('12');
    });

    it('updates the existing row when re-sent with the same natural key', async () => {
      const run = await RunFactory.create();

      // First write
      await repository.upsertMany({
        data: [
          {
            runId: run.id,
            type: SCORE_TYPE.RAW,
            domain: SCORE_DOMAIN.COMPOSITE,
            name: SCORE_NAME.THETA_SE,
            value: '0.5',
            assessmentStage: ASSESSMENT_STAGE.TEST,
          },
        ],
      });

      // Second write — same natural key, new value
      await repository.upsertMany({
        data: [
          {
            runId: run.id,
            type: SCORE_TYPE.RAW,
            domain: SCORE_DOMAIN.COMPOSITE,
            name: SCORE_NAME.THETA_SE,
            value: '0.3',
            assessmentStage: ASSESSMENT_STAGE.TEST,
          },
        ],
      });

      const rows = await AssessmentDbClient.select().from(runScores).where(eq(runScores.runId, run.id));

      // Still exactly one row — the conflict path replaced the value rather than inserting.
      expect(rows).toHaveLength(1);
      expect(rows[0]!.value).toBe('0.3');
    });

    it('treats two NULL assessment_stage rows with otherwise-identical natural keys as the same row', async () => {
      const run = await RunFactory.create();

      // First write with NULL stage
      await repository.upsertMany({
        data: [
          {
            runId: run.id,
            type: SCORE_TYPE.RAW,
            domain: SCORE_DOMAIN.COMPOSITE,
            name: SCORE_NAME.THETA_SE,
            value: '0.5',
            assessmentStage: null,
          },
        ],
      });

      // Second write with NULL stage — should update, not insert (NULLS NOT DISTINCT)
      await repository.upsertMany({
        data: [
          {
            runId: run.id,
            type: SCORE_TYPE.RAW,
            domain: SCORE_DOMAIN.COMPOSITE,
            name: SCORE_NAME.THETA_SE,
            value: '0.4',
            assessmentStage: null,
          },
        ],
      });

      const rows = await AssessmentDbClient.select().from(runScores).where(eq(runScores.runId, run.id));

      expect(rows).toHaveLength(1);
      expect(rows[0]!.value).toBe('0.4');
      expect(rows[0]!.assessmentStage).toBeNull();
    });

    it('treats different assessment_stage values as distinct rows for the same (run, type, domain, name)', async () => {
      const run = await RunFactory.create();

      await repository.upsertMany({
        data: [
          {
            runId: run.id,
            type: SCORE_TYPE.RAW,
            domain: SCORE_DOMAIN.COMPOSITE,
            name: SCORE_NAME.THETA_SE,
            value: '0.5',
            assessmentStage: ASSESSMENT_STAGE.PRACTICE,
          },
          {
            runId: run.id,
            type: SCORE_TYPE.RAW,
            domain: SCORE_DOMAIN.COMPOSITE,
            name: SCORE_NAME.THETA_SE,
            value: '0.7',
            assessmentStage: ASSESSMENT_STAGE.TEST,
          },
        ],
      });

      const rows = await AssessmentDbClient.select().from(runScores).where(eq(runScores.runId, run.id));

      expect(rows).toHaveLength(2);
      const byStage = new Map(rows.map((r) => [r.assessmentStage, r.value]));
      expect(byStage.get(ASSESSMENT_STAGE.PRACTICE)).toBe('0.5');
      expect(byStage.get(ASSESSMENT_STAGE.TEST)).toBe('0.7');
    });

    it('updates category_score on conflict', async () => {
      const run = await RunFactory.create();

      // Insert with categoryScore=false
      await repository.upsertMany({
        data: [
          {
            runId: run.id,
            type: SCORE_TYPE.COMPUTED,
            domain: SCORE_DOMAIN.COMPOSITE,
            name: 'support_level',
            value: 'developingSkill',
            assessmentStage: ASSESSMENT_STAGE.TEST,
            categoryScore: false,
          },
        ],
      });

      // Re-upsert with categoryScore=true
      await repository.upsertMany({
        data: [
          {
            runId: run.id,
            type: SCORE_TYPE.COMPUTED,
            domain: SCORE_DOMAIN.COMPOSITE,
            name: 'support_level',
            value: 'achievedSkill',
            assessmentStage: ASSESSMENT_STAGE.TEST,
            categoryScore: true,
          },
        ],
      });

      const rows = await AssessmentDbClient.select().from(runScores).where(eq(runScores.runId, run.id));

      expect(rows).toHaveLength(1);
      expect(rows[0]!.value).toBe('achievedSkill');
      expect(rows[0]!.categoryScore).toBe(true);
    });

    it('isolates scores by run_id', async () => {
      const runA = await RunFactory.create();
      const runB = await RunFactory.create();

      await repository.upsertMany({
        data: [
          {
            runId: runA.id,
            type: SCORE_TYPE.RAW,
            domain: SCORE_DOMAIN.COMPOSITE,
            name: SCORE_NAME.THETA_SE,
            value: '0.5',
            assessmentStage: ASSESSMENT_STAGE.TEST,
          },
          {
            runId: runB.id,
            type: SCORE_TYPE.RAW,
            domain: SCORE_DOMAIN.COMPOSITE,
            name: SCORE_NAME.THETA_SE,
            value: '0.7',
            assessmentStage: ASSESSMENT_STAGE.TEST,
          },
        ],
      });

      const allForA = await AssessmentDbClient.select().from(runScores).where(eq(runScores.runId, runA.id));
      const allForB = await AssessmentDbClient.select().from(runScores).where(eq(runScores.runId, runB.id));

      expect(allForA).toHaveLength(1);
      expect(allForB).toHaveLength(1);
      expect(allForA[0]!.value).toBe('0.5');
      expect(allForB[0]!.value).toBe('0.7');
    });

    it('participates in a caller-provided transaction (commit path)', async () => {
      const run = await RunFactory.create();
      const repo = repository;

      await repo.runTransaction({
        fn: async (tx) => {
          await repo.upsertMany({
            transaction: tx,
            data: [
              {
                runId: run.id,
                type: SCORE_TYPE.RAW,
                domain: SCORE_DOMAIN.COMPOSITE,
                name: SCORE_NAME.THETA_SE,
                value: '0.42',
                assessmentStage: ASSESSMENT_STAGE.TEST,
              },
            ],
          });
        },
      });

      const rows = await AssessmentDbClient.select()
        .from(runScores)
        .where(and(eq(runScores.runId, run.id), eq(runScores.name, SCORE_NAME.THETA_SE)));

      expect(rows).toHaveLength(1);
      expect(rows[0]!.value).toBe('0.42');
    });

    it('rolls back upserted rows when the caller-provided transaction throws', async () => {
      const run = await RunFactory.create();
      const repo = repository;
      const caughtError = await repo
        .runTransaction({
          fn: async (tx) => {
            await repo.upsertMany({
              transaction: tx,
              data: [
                {
                  runId: run.id,
                  type: SCORE_TYPE.RAW,
                  domain: SCORE_DOMAIN.COMPOSITE,
                  name: SCORE_NAME.THETA_SE,
                  value: 'should-not-persist',
                  assessmentStage: ASSESSMENT_STAGE.TEST,
                },
              ],
            });
            throw new Error('intentional rollback');
          },
        })
        .catch((e) => e);

      expect(caughtError).toBeInstanceOf(Error);

      const rows = await AssessmentDbClient.select().from(runScores).where(eq(runScores.runId, run.id));

      expect(rows).toHaveLength(0);
    });
  });
});
