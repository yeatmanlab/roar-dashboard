/**
 * Integration tests for RunRepository.
 *
 * Tests the `getRunStatsByAdministrationIds` method against the real
 * assessment database. Uses RunFactory to create test runs.
 *
 * Note: The assessment DB has no FK constraints to the core DB, so we
 * use arbitrary UUIDs for userId/taskId/taskVariantId and fixture
 * administration IDs where convenient.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { faker } from '@faker-js/faker';
import { baseFixture } from '../test-support/fixtures';
import { RunFactory } from '../test-support/factories/run.factory';
import { RunScoreFactory } from '../test-support/factories/run-score.factory';
import { RunRepository } from './run.repository';
import { SCORE_TYPE, SCORE_DOMAIN, ASSESSMENT_STAGE, SCORE_NAME } from '../constants/run-scores';

describe('RunRepository', () => {
  let repository: RunRepository;

  beforeAll(() => {
    repository = new RunRepository();
  });

  describe('getById', () => {
    it('returns the run when it exists and is not soft-deleted', async () => {
      const run = await RunFactory.create();

      const result = await repository.getById({ id: run.id });

      expect(result).not.toBeNull();
      expect(result!.id).toBe(run.id);
    });

    it('returns null when the run is soft-deleted', async () => {
      const run = await RunFactory.create({ deletedAt: new Date(), deletedBy: faker.string.uuid() });

      const result = await repository.getById({ id: run.id });

      expect(result).toBeNull();
    });

    it('returns null when the run does not exist', async () => {
      const result = await repository.getById({ id: faker.string.uuid() });

      expect(result).toBeNull();
    });
  });

  describe('getRunStatsByAdministrationIds', () => {
    it('returns empty map for empty input array', async () => {
      const result = await repository.getRunStatsByAdministrationIds([]);

      expect(result).toEqual(new Map());
    });

    it('returns stats with correct started/completed counts', async () => {
      const administrationId = baseFixture.administrationAssignedToDistrict.id;
      const user1 = faker.string.uuid();
      const user2 = faker.string.uuid();
      const user3 = faker.string.uuid();

      // user1: started but not completed
      await RunFactory.create({ userId: user1, administrationId, completedAt: null });

      // user2: completed
      await RunFactory.create({ userId: user2, administrationId, completedAt: new Date() });

      // user3: started but not completed
      await RunFactory.create({ userId: user3, administrationId, completedAt: null });

      const result = await repository.getRunStatsByAdministrationIds([administrationId]);

      const stats = result.get(administrationId);
      expect(stats).toBeDefined();
      expect(stats!.started).toBe(3);
      expect(stats!.completed).toBe(1);
    });

    it('handles multiple administrations', async () => {
      const adminA = faker.string.uuid();
      const adminB = faker.string.uuid();
      const user1 = faker.string.uuid();
      const user2 = faker.string.uuid();

      // Admin A: 2 users started, 1 completed
      await RunFactory.create({ userId: user1, administrationId: adminA, completedAt: new Date() });
      await RunFactory.create({ userId: user2, administrationId: adminA, completedAt: null });

      // Admin B: 1 user started and completed
      await RunFactory.create({ userId: user1, administrationId: adminB, completedAt: new Date() });

      const result = await repository.getRunStatsByAdministrationIds([adminA, adminB]);

      expect(result.size).toBe(2);
      expect(result.get(adminA)).toEqual({ started: 2, completed: 1 });
      expect(result.get(adminB)).toEqual({ started: 1, completed: 1 });
    });

    it('omits administrations with no runs', async () => {
      const adminWithRuns = faker.string.uuid();
      const adminWithoutRuns = faker.string.uuid();

      await RunFactory.create({ userId: faker.string.uuid(), administrationId: adminWithRuns, completedAt: null });

      const result = await repository.getRunStatsByAdministrationIds([adminWithRuns, adminWithoutRuns]);

      expect(result.has(adminWithRuns)).toBe(true);
      expect(result.has(adminWithoutRuns)).toBe(false);
    });

    it('handles zero completed correctly', async () => {
      const administrationId = faker.string.uuid();
      const user1 = faker.string.uuid();
      const user2 = faker.string.uuid();

      // Both users started but neither completed
      await RunFactory.create({ userId: user1, administrationId, completedAt: null });
      await RunFactory.create({ userId: user2, administrationId, completedAt: null });

      const result = await repository.getRunStatsByAdministrationIds([administrationId]);

      const stats = result.get(administrationId);
      expect(stats).toBeDefined();
      expect(stats!.started).toBe(2);
      expect(stats!.completed).toBe(0);
    });

    it('excludes soft-deleted runs from stats', async () => {
      const administrationId = faker.string.uuid();
      const user1 = faker.string.uuid();
      const user2 = faker.string.uuid();

      // user1: active completed run
      await RunFactory.create({ userId: user1, administrationId, completedAt: new Date() });

      // user2: soft-deleted run (should be excluded)
      await RunFactory.create({
        userId: user2,
        administrationId,
        completedAt: new Date(),
        deletedAt: new Date(),
        deletedBy: faker.string.uuid(),
      });

      const result = await repository.getRunStatsByAdministrationIds([administrationId]);

      const stats = result.get(administrationId);
      expect(stats).toBeDefined();
      expect(stats!.started).toBe(1);
      expect(stats!.completed).toBe(1);
    });

    it('counts distinct users (multiple runs per user count as one)', async () => {
      const administrationId = faker.string.uuid();
      const userId = faker.string.uuid();

      // Same user, multiple runs, one completed
      await RunFactory.create({ userId, administrationId, completedAt: null });
      await RunFactory.create({ userId, administrationId, completedAt: new Date() });
      await RunFactory.create({ userId, administrationId, completedAt: null });

      const result = await repository.getRunStatsByAdministrationIds([administrationId]);

      const stats = result.get(administrationId);
      expect(stats).toBeDefined();
      // Only 1 distinct user
      expect(stats!.started).toBe(1);
      expect(stats!.completed).toBe(1);
    });
  });

  describe('getByAdministrationId', () => {
    it('returns a run when runs exist for the administration', async () => {
      const administrationId = faker.string.uuid();

      const createdRun = await RunFactory.create({ administrationId });

      const result = await repository.getByAdministrationId(administrationId);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(createdRun.id);
      expect(result!.administrationId).toBe(administrationId);
    });

    it('returns null when no runs exist for the administration', async () => {
      const administrationId = faker.string.uuid();

      const result = await repository.getByAdministrationId(administrationId);

      expect(result).toBeNull();
    });

    it('excludes soft-deleted runs', async () => {
      const administrationId = faker.string.uuid();

      await RunFactory.create({ administrationId, deletedAt: new Date(), deletedBy: faker.string.uuid() });

      const result = await repository.getByAdministrationId(administrationId);

      expect(result).toBeNull();
    });

    it('does not return runs belonging to other administrations', async () => {
      const targetAdministrationId = faker.string.uuid();
      const otherAdministrationId = faker.string.uuid();

      // Create run for a different administration
      await RunFactory.create({ administrationId: otherAdministrationId });

      const result = await repository.getByAdministrationId(targetAdministrationId);

      expect(result).toBeNull();
    });
  });

  describe('recomputeUseForReporting', () => {
    /**
     * Builds a fresh `(userId, administrationId, taskVariantId)` partition. Each test
     * isolates itself via unique UUIDs rather than truncation.
     */
    function newPartition() {
      return {
        userId: faker.string.uuid(),
        administrationId: faker.string.uuid(),
        taskVariantId: faker.string.uuid(),
      };
    }

    /**
     * Reads every non-deleted run in the partition. Tests that depend on identifying the
     * winner key into the resulting map by id.
     */
    async function readPartition(partition: { userId: string; administrationId: string; taskVariantId: string }) {
      const { AssessmentDbClient } = await import('../db/clients');
      const { runs } = await import('../db/schema/assessment');
      const { and, eq, isNull } = await import('drizzle-orm');
      return AssessmentDbClient.select()
        .from(runs)
        .where(
          and(
            eq(runs.userId, partition.userId),
            eq(runs.administrationId, partition.administrationId),
            eq(runs.taskVariantId, partition.taskVariantId),
            isNull(runs.deletedAt),
          ),
        );
    }

    /** Seeds a thetaSE score row for a run. */
    async function seedThetaSE(runId: string, value: string) {
      await RunScoreFactory.create({
        runId,
        type: SCORE_TYPE.RAW,
        domain: SCORE_DOMAIN.COMPOSITE,
        name: SCORE_NAME.THETA_SE,
        value,
        assessmentStage: ASSESSMENT_STAGE.TEST,
        categoryScore: null,
      });
    }

    /** Seeds a numAttempted score row for a run. */
    async function seedNumAttempted(runId: string, value: string) {
      await RunScoreFactory.create({
        runId,
        type: SCORE_TYPE.RAW,
        domain: SCORE_DOMAIN.COMPOSITE,
        name: SCORE_NAME.NUM_ATTEMPTED,
        value,
        assessmentStage: ASSESSMENT_STAGE.TEST,
        categoryScore: null,
      });
    }

    /** Builds a winner map keyed by run id. */
    function winnerMap(rows: Array<{ id: string; useForReporting: boolean }>) {
      return new Map(rows.map((r) => [r.id, r.useForReporting]));
    }

    it('selects the only candidate as the winner in a single-run partition', async () => {
      const p = newPartition();
      const run = await RunFactory.create({ ...p, completedAt: new Date(), reliableRun: true });

      await repository.recomputeUseForReporting(p);

      const rows = await readPartition(p);
      expect(rows).toHaveLength(1);
      expect(rows[0]!.id).toBe(run.id);
      expect(rows[0]!.useForReporting).toBe(true);
    });

    it('tier 1 (reliable + completed): earliest created_at wins', async () => {
      const p = newPartition();
      const earlier = await RunFactory.create({
        ...p,
        completedAt: new Date(),
        reliableRun: true,
      });
      // Sleep briefly so the second run has a strictly later created_at.
      await new Promise((r) => setTimeout(r, 5));
      const later = await RunFactory.create({
        ...p,
        completedAt: new Date(),
        reliableRun: true,
      });

      await repository.recomputeUseForReporting(p);

      const m = winnerMap(await readPartition(p));
      expect(m.get(earlier.id)).toBe(true);
      expect(m.get(later.id)).toBe(false);
    });

    it('tier 2 (reliable + incomplete): lowest thetaSE wins', async () => {
      const p = newPartition();
      const lowerTheta = await RunFactory.create({ ...p, completedAt: null, reliableRun: true });
      const higherTheta = await RunFactory.create({ ...p, completedAt: null, reliableRun: true });
      await seedThetaSE(lowerTheta.id, '0.2');
      await seedThetaSE(higherTheta.id, '0.5');

      await repository.recomputeUseForReporting(p);

      const m = winnerMap(await readPartition(p));
      expect(m.get(lowerTheta.id)).toBe(true);
      expect(m.get(higherTheta.id)).toBe(false);
    });

    it('tier 2 ties on thetaSE: highest numAttempted wins', async () => {
      const p = newPartition();
      const fewerAttempts = await RunFactory.create({ ...p, completedAt: null, reliableRun: true });
      const moreAttempts = await RunFactory.create({ ...p, completedAt: null, reliableRun: true });
      await seedThetaSE(fewerAttempts.id, '0.4');
      await seedThetaSE(moreAttempts.id, '0.4');
      await seedNumAttempted(fewerAttempts.id, '5');
      await seedNumAttempted(moreAttempts.id, '15');

      await repository.recomputeUseForReporting(p);

      const m = winnerMap(await readPartition(p));
      expect(m.get(moreAttempts.id)).toBe(true);
      expect(m.get(fewerAttempts.id)).toBe(false);
    });

    it('tier 3 (unreliable + completed): latest created_at wins', async () => {
      const p = newPartition();
      const earlier = await RunFactory.create({
        ...p,
        completedAt: new Date(),
        reliableRun: false,
      });
      await new Promise((r) => setTimeout(r, 5));
      const later = await RunFactory.create({
        ...p,
        completedAt: new Date(),
        reliableRun: false,
      });

      await repository.recomputeUseForReporting(p);

      const m = winnerMap(await readPartition(p));
      expect(m.get(later.id)).toBe(true);
      expect(m.get(earlier.id)).toBe(false);
    });

    it('tier 4 (unreliable + incomplete): lowest thetaSE wins, then numAttempted, then earliest', async () => {
      const p = newPartition();
      const winner = await RunFactory.create({ ...p, completedAt: null, reliableRun: false });
      const loserHigherTheta = await RunFactory.create({ ...p, completedAt: null, reliableRun: false });
      await seedThetaSE(winner.id, '0.2');
      await seedThetaSE(loserHigherTheta.id, '0.5');

      await repository.recomputeUseForReporting(p);

      const m = winnerMap(await readPartition(p));
      expect(m.get(winner.id)).toBe(true);
      expect(m.get(loserHigherTheta.id)).toBe(false);
    });

    it('cross-tier priority: reliable+completed beats reliable+incomplete with better scores', async () => {
      const p = newPartition();
      // Tier-1 reliable+completed run, no scores at all.
      const completed = await RunFactory.create({
        ...p,
        completedAt: new Date(),
        reliableRun: true,
      });
      // Tier-2 reliable+incomplete run with a great thetaSE — should still lose to tier 1.
      const incomplete = await RunFactory.create({
        ...p,
        completedAt: null,
        reliableRun: true,
      });
      await seedThetaSE(incomplete.id, '0.01');

      await repository.recomputeUseForReporting(p);

      const m = winnerMap(await readPartition(p));
      expect(m.get(completed.id)).toBe(true);
      expect(m.get(incomplete.id)).toBe(false);
    });

    it('reliable beats unreliable across completion states (tier 2 beats tier 3)', async () => {
      const p = newPartition();
      // Tier 2: reliable + incomplete.
      const tier2 = await RunFactory.create({ ...p, completedAt: null, reliableRun: true });
      // Tier 3: unreliable + completed.
      const tier3 = await RunFactory.create({ ...p, completedAt: new Date(), reliableRun: false });

      await repository.recomputeUseForReporting(p);

      const m = winnerMap(await readPartition(p));
      expect(m.get(tier2.id)).toBe(true);
      expect(m.get(tier3.id)).toBe(false);
    });

    it('excludes aborted runs from candidates and resets their use_for_reporting to false', async () => {
      const p = newPartition();
      const eligible = await RunFactory.create({ ...p, completedAt: new Date(), reliableRun: true });
      // Pre-existing aborted run with a stale use_for_reporting=true that needs resetting.
      const aborted = await RunFactory.create({
        ...p,
        completedAt: null,
        abortedAt: new Date(),
        reliableRun: true,
        useForReporting: true,
      });

      await repository.recomputeUseForReporting(p);

      const m = winnerMap(await readPartition(p));
      expect(m.get(eligible.id)).toBe(true);
      expect(m.get(aborted.id)).toBe(false);
    });

    it('excludes soft-deleted runs from both candidate ranking and the outer reset', async () => {
      const p = newPartition();
      const eligible = await RunFactory.create({ ...p, completedAt: new Date(), reliableRun: true });
      const deleted = await RunFactory.create({
        ...p,
        completedAt: new Date(),
        reliableRun: true,
        deletedAt: new Date(),
        deletedBy: faker.string.uuid(),
        useForReporting: true,
      });

      await repository.recomputeUseForReporting(p);

      // Soft-deleted rows are excluded from readPartition's filter.
      const m = winnerMap(await readPartition(p));
      expect(m.get(eligible.id)).toBe(true);
      expect(m.has(deleted.id)).toBe(false);
    });

    it('resets every use_for_reporting to false when no eligible candidates remain', async () => {
      const p = newPartition();
      const a = await RunFactory.create({
        ...p,
        completedAt: null,
        abortedAt: new Date(),
        useForReporting: true,
      });
      const b = await RunFactory.create({
        ...p,
        completedAt: null,
        abortedAt: new Date(),
        useForReporting: true,
      });

      await repository.recomputeUseForReporting(p);

      const m = winnerMap(await readPartition(p));
      expect(m.get(a.id)).toBe(false);
      expect(m.get(b.id)).toBe(false);
    });

    it('flips the winner when an existing thetaSE is updated to a lower value', async () => {
      const p = newPartition();
      const original = await RunFactory.create({ ...p, completedAt: null, reliableRun: true });
      const challenger = await RunFactory.create({ ...p, completedAt: null, reliableRun: true });
      await seedThetaSE(original.id, '0.3');
      await seedThetaSE(challenger.id, '0.5');

      // Initial recompute — original wins.
      await repository.recomputeUseForReporting(p);
      let m = winnerMap(await readPartition(p));
      expect(m.get(original.id)).toBe(true);
      expect(m.get(challenger.id)).toBe(false);

      // Challenger gets a better thetaSE in a follow-up score write.
      const { AssessmentDbClient } = await import('../db/clients');
      const { runScores } = await import('../db/schema/assessment');
      const { and, eq } = await import('drizzle-orm');
      await AssessmentDbClient.update(runScores)
        .set({ value: '0.1' })
        .where(and(eq(runScores.runId, challenger.id), eq(runScores.name, SCORE_NAME.THETA_SE)));

      await repository.recomputeUseForReporting(p);
      m = winnerMap(await readPartition(p));
      expect(m.get(challenger.id)).toBe(true);
      expect(m.get(original.id)).toBe(false);
    });

    it('does not affect runs in a different partition', async () => {
      const p1 = newPartition();
      const p2 = newPartition();
      const inP1 = await RunFactory.create({ ...p1, completedAt: new Date(), reliableRun: true });
      const inP2 = await RunFactory.create({
        ...p2,
        completedAt: new Date(),
        reliableRun: true,
        useForReporting: true,
      });

      await repository.recomputeUseForReporting(p1);

      const m1 = winnerMap(await readPartition(p1));
      const m2 = winnerMap(await readPartition(p2));
      expect(m1.get(inP1.id)).toBe(true);
      // p2 untouched.
      expect(m2.get(inP2.id)).toBe(true);
    });

    it('is idempotent — running twice with no intervening writes produces the same state', async () => {
      const p = newPartition();
      const a = await RunFactory.create({ ...p, completedAt: new Date(), reliableRun: true });
      // Second run in the same partition — its identity doesn't matter for the assertion
      // (the test only verifies that running recompute twice produces the same winner state).
      await RunFactory.create({ ...p, completedAt: new Date(), reliableRun: true });

      await repository.recomputeUseForReporting(p);
      const first = winnerMap(await readPartition(p));

      await repository.recomputeUseForReporting(p);
      const second = winnerMap(await readPartition(p));

      expect(second).toEqual(first);
      expect(first.get(a.id)).toBe(true);
    });
  });
});
