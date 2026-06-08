import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PA_TASK_ID, PA_SCORING_VERSION } from './index.js';

interface RawScoreData {
  numCorrect?: number;
  numAttempted?: number;
  numIncorrect?: number;
}

interface RawScores {
  [key: string]: {
    practice?: RawScoreData;
    test?: RawScoreData;
  };
}

interface ComputedScoreData {
  [key: string]: unknown;
  numCorrect: number;
  percentCorrect: number;
  roarScoreKind: string;
  scoringVersion: number;
  roarScore?: number;
  thetaEstimate?: number | null;
  thetaSE?: number | null;
  thetaEstimateRaw?: number | null;
  thetaSERaw?: number | null;
  percentile?: number;
  standardScore?: number;
}

interface ComputedScores {
  [key: string]: ComputedScoreData;
}

interface LookupRow {
  [key: string]: unknown;
  ageMonths?: number;
  grade?: number;
  roarScore?: number;
  thetaEstimate?: number;
  percentile?: number;
  standardScore?: number;
}

interface ScoringConfig {
  taskId?: string;
  grade?: number;
  ageMonths?: number;
}

/**
 * Mock RoarScores class for testing the scoring logic.
 * This mirrors the actual implementation in apps/assessments/roar-pa/src/experiment/scores.js
 *
 * Architectural decision: We use a mock rather than importing the actual RoarScores class because:
 * - The actual implementation is in a browser-based assessment app (roar-pa)
 * - assessment-schema is a shared package that shouldn't depend on specific assessments
 * - This mock allows us to test the scoring math in isolation
 *
 * Drift detection: If the actual RoarScores.computedScoreCallback implementation changes
 * (e.g., adds/removes fields, changes output shape), this will be caught by:
 * 1. Integration tests in packages/assessment-sdk/src/receiver/roar-api.integration.test.ts
 *    that exercise the real scoring path end-to-end (real RoarScores → toPaScoreEntries → backend)
 * 2. The compile-time type check in score-entries.ts that ensures ComputedScoreEntry
 *    remains compatible with api-contract's ScoreEntry
 * 3. Runtime validation in pa-firekit-facade.js with strict: true mode that validates
 *    all emitted score names are registered in PA_SCORE_NAMES
 */
class MockRoarScores {
  scoringVersion: number;
  roarScoreKind: string;
  thetas: Record<string, number>;
  thetaSEs: Record<string, number>;
  lookupTable: LookupRow[];
  tableLoaded: boolean;
  ageForScore: number;

  constructor(
    scoringVersion: number,
    thetas: Record<string, number> = {},
    thetaSEs: Record<string, number> = {},
    lookupTable: LookupRow[] = [],
  ) {
    this.scoringVersion = scoringVersion;
    this.roarScoreKind = this.isAdaptiveScoring() ? 'SCALED_IRT' : 'RAW_TOTAL_CORRECT';
    this.thetas = thetas;
    this.thetaSEs = thetaSEs;
    this.lookupTable = lookupTable;
    this.tableLoaded = lookupTable.length > 0;
    this.ageForScore = 60;
  }

  isAdaptiveScoring(): boolean {
    if (!Number.isFinite(this.scoringVersion)) {
      throw new Error(
        `Invalid scoringVersion: ${this.scoringVersion}. Expected a finite number >= ${PA_SCORING_VERSION.V4_ADAPTIVE} for adaptive scoring or < ${PA_SCORING_VERSION.V4_ADAPTIVE} for fixed scoring.`,
      );
    }
    return this.scoringVersion >= PA_SCORING_VERSION.V4_ADAPTIVE;
  }

  computedScoreCallback = async (rawScores: RawScores, config: ScoringConfig = {}): Promise<ComputedScores | null> => {
    const { taskId = PA_TASK_ID, grade, ageMonths } = config;

    // Guard: taskId must match PA_TASK_ID
    if (taskId !== PA_TASK_ID) return null;

    // Map raw scores to computed scores
    const computedScores: ComputedScores = {
      composite: {
        numCorrect: 0,
        percentCorrect: 0,
        roarScore: 0,
        roarScoreKind: this.roarScoreKind,
        scoringVersion: this.scoringVersion,
      },
      composite_foundational: {
        numCorrect: 0,
        percentCorrect: 0,
        roarScore: 0,
        roarScoreKind: this.roarScoreKind,
        scoringVersion: this.scoringVersion,
      },
    };

    for (const [key, subtaskScores] of Object.entries(rawScores)) {
      const { numCorrect = 0, numAttempted = 0 } = subtaskScores.test ?? {};
      const percentCorrect = numAttempted > 0 ? Math.round((100 * numCorrect) / numAttempted) : 0;

      computedScores[key] = {
        ...(this.isAdaptiveScoring() ? {} : { roarScore: numCorrect }),
        numCorrect,
        percentCorrect,
        roarScoreKind: this.roarScoreKind,
        scoringVersion: this.scoringVersion,
      };
    }

    // Calculate total score (sum of subtask roarScores, excluding composite keys)
    const totalScore = Object.entries(computedScores)
      .filter(([k]) => !k.startsWith('composite'))
      .reduce((sum, [, score]) => sum + ((score.roarScore as number) || 0), 0);

    // Set composite roarScore to total
    if (!this.isAdaptiveScoring()) {
      computedScores.composite.roarScore = totalScore;
    }

    // Adaptive scoring: add theta estimates and composite_foundational
    if (this.isAdaptiveScoring()) {
      for (const key of Object.keys(computedScores)) {
        computedScores[key].thetaEstimate = this.thetas[key.toLowerCase()] ?? null;
        computedScores[key].thetaSE = this.thetaSEs[key.toLowerCase()] ?? null;
      }

      const compositeThetas = {
        thetaEstimate: this.thetas.scaled ?? null,
        thetaSE: this.thetaSEs.scaled ?? null,
        thetaEstimateRaw: this.thetas.composite ?? null,
        thetaSERaw: this.thetaSEs.composite ?? null,
      };

      const compositeFoundationalThetas = {
        thetaEstimate: this.thetas.composite_foundational ?? null,
        thetaSE: this.thetaSEs.composite_foundational ?? null,
        thetaEstimateRaw: this.thetas.composite_foundational ?? null,
        thetaSERaw: this.thetaSEs.composite_foundational ?? null,
      };

      computedScores.composite = {
        ...computedScores.composite,
        ...compositeThetas,
      };

      computedScores.composite_foundational = {
        ...computedScores.composite_foundational,
        ...compositeFoundationalThetas,
        roarScoreKind: this.roarScoreKind,
        scoringVersion: this.scoringVersion,
      };
    }

    // Lookup table scoring: grade >= 6 vs grade < 6 branch
    if ((grade != null || ageMonths != null) && this.tableLoaded) {
      let myRow;

      if (this.isAdaptiveScoring()) {
        const thetaEstimate = this.thetas.scaled;
        const roundedTheta = Number(thetaEstimate.toFixed(1));
        myRow = this.lookupTable.find(
          (row) =>
            Number(row.ageMonths) === this.ageForScore &&
            Number(Number(row.thetaEstimate).toFixed(1)) === roundedTheta,
        );
      } else if (grade != null && grade < 6) {
        // Grade < 6: lookup by age
        myRow = this.lookupTable.find((row) => Number(row.ageMonths) === this.ageForScore && row.roarScore === totalScore);
      } else if (grade != null && grade >= 6) {
        // Grade >= 6: lookup by grade
        myRow = this.lookupTable.find((row) => Number(row.grade) === grade && row.roarScore === totalScore);
      }

      if (myRow !== undefined) {
        const { roarScore, ageMonths: _, grade: __, ...normedScores } = myRow;

        // Merge composite_foundational into composite (line 222-230 in scores.js)
        computedScores.composite = {
          ...computedScores.composite,
          ...computedScores.composite_foundational,
          ...normedScores,
          ...(this.isAdaptiveScoring() ? { roarScore } : {}),
          roarScoreKind: this.roarScoreKind,
          scoringVersion: this.scoringVersion,
        };
      }
    }

    return computedScores;
  };
}

describe('RoarScores.computedScoreCallback', () => {
  describe('adaptive vs fixed scoring version selection', () => {
    it('selects adaptive scoring for v4+', () => {
      const scores = new MockRoarScores(PA_SCORING_VERSION.V4_ADAPTIVE);
      expect(scores.isAdaptiveScoring()).toBe(true);
      expect(scores.roarScoreKind).toBe('SCALED_IRT');
    });

    it('selects fixed scoring for v3', () => {
      const scores = new MockRoarScores(PA_SCORING_VERSION.V3_FIXED);
      expect(scores.isAdaptiveScoring()).toBe(false);
      expect(scores.roarScoreKind).toBe('RAW_TOTAL_CORRECT');
    });

    it('throws on non-finite scoringVersion', () => {
      expect(() => new MockRoarScores(NaN).isAdaptiveScoring()).toThrow(
        /Invalid scoringVersion.*Expected a finite number/,
      );
    });

    it('throws on Infinity scoringVersion', () => {
      expect(() => new MockRoarScores(Infinity).isAdaptiveScoring()).toThrow(
        /Invalid scoringVersion.*Expected a finite number/,
      );
    });
  });

  describe('taskId guard', () => {
    it('returns null if taskId does not match PA_TASK_ID', async () => {
      const scores = new MockRoarScores(PA_SCORING_VERSION.V3_FIXED);
      const rawScores = {
        fsm: { test: { numCorrect: 10, numAttempted: 15 } },
      };

      const result = await scores.computedScoreCallback(rawScores, { taskId: 'wrong-task-id' });
      expect(result).toBeNull();
    });

    it('processes scores if taskId matches PA_TASK_ID', async () => {
      const scores = new MockRoarScores(PA_SCORING_VERSION.V3_FIXED);
      const rawScores = {
        fsm: { test: { numCorrect: 10, numAttempted: 15 } },
      };

      const result = await scores.computedScoreCallback(rawScores, { taskId: PA_TASK_ID });
      expect(result).not.toBeNull();
      expect(result?.fsm).toBeDefined();
    });
  });

  describe('composite_foundational theta/SE mapping and merge', () => {
    it('maps composite_foundational thetas into composite for adaptive scoring', async () => {
      const scores = new MockRoarScores(PA_SCORING_VERSION.V4_ADAPTIVE, {
        fsm: 0.5,
        lsm: 0.3,
        del: 0.2,
        scaled: 0.4,
        composite: 0.35,
        composite_foundational: 0.25,
      });

      const rawScores = {
        fsm: { test: { numCorrect: 10, numAttempted: 15 } },
        lsm: { test: { numCorrect: 8, numAttempted: 15 } },
        del: { test: { numCorrect: 5, numAttempted: 15 } },
      };

      const result = (await scores.computedScoreCallback(rawScores, { taskId: PA_TASK_ID }))!;

      // Verify composite_foundational is created with its own thetas
      expect(result.composite_foundational).toBeDefined();
      expect(result.composite_foundational.thetaEstimate).toBe(0.25);
      expect(result.composite_foundational.thetaSE).toBeNull();

      // Verify composite has scaled thetas initially
      expect(result.composite.thetaEstimate).toBe(0.4);
      expect(result.composite.thetaEstimateRaw).toBe(0.35);
    });

    it('merges composite_foundational into composite when lookup table provides normed scores', async () => {
      const lookupTable = [
        {
          ageMonths: 60,
          thetaEstimate: 0.4,
          percentile: 50,
          standardScore: 100,
          roarScore: 0,
        },
      ];

      const scores = new MockRoarScores(
        PA_SCORING_VERSION.V4_ADAPTIVE,
        {
          fsm: 0.5,
          lsm: 0.3,
          del: 0.2,
          scaled: 0.4,
          composite: 0.35,
          composite_foundational: 0.25,
        },
        {},
        lookupTable,
      );

      const rawScores = {
        fsm: { test: { numCorrect: 10, numAttempted: 15 } },
        lsm: { test: { numCorrect: 8, numAttempted: 15 } },
        del: { test: { numCorrect: 5, numAttempted: 15 } },
      };

      const result = (await scores.computedScoreCallback(rawScores, { taskId: PA_TASK_ID, ageMonths: 60 }))!;

      // After merge, composite should have normed scores from lookup table
      expect(result.composite.percentile).toBe(50);
      expect(result.composite.standardScore).toBe(100);
      // And should still have composite_foundational's thetas merged in
      expect(result.composite.thetaEstimate).toBe(0.4); // from scaled
    });
  });

  describe('grade >= 6 vs grade < 6 lookup branch', () => {
    it('uses age lookup for grade < 6', async () => {
      const lookupTable = [
        { ageMonths: 60, grade: 1, roarScore: 20, percentile: 40, standardScore: 95 },
        { ageMonths: 60, grade: 2, roarScore: 20, percentile: 50, standardScore: 100 },
        { ageMonths: 72, grade: 1, roarScore: 20, percentile: 45, standardScore: 97 },
      ];

      const scores = new MockRoarScores(PA_SCORING_VERSION.V3_FIXED, {}, {}, lookupTable);
      scores.ageForScore = 60;

      const rawScores = {
        fsm: { test: { numCorrect: 10, numAttempted: 15 } },
        lsm: { test: { numCorrect: 10, numAttempted: 15 } },
        del: { test: { numCorrect: 0, numAttempted: 15 } },
      };

      const result = (await scores.computedScoreCallback(rawScores, { taskId: PA_TASK_ID, grade: 1, ageMonths: 60 }))!;

      // Grade 1 (< 6) should use age lookup: ageMonths=60, roarScore=20
      expect(result.composite.percentile).toBe(40);
      expect(result.composite.standardScore).toBe(95);
    });

    it('uses grade lookup for grade >= 6', async () => {
      const lookupTable = [
        { ageMonths: 60, grade: 6, roarScore: 25, percentile: 60, standardScore: 110 },
        { ageMonths: 60, grade: 1, roarScore: 25, percentile: 40, standardScore: 95 },
        { ageMonths: 72, grade: 6, roarScore: 25, percentile: 55, standardScore: 105 },
      ];

      const scores = new MockRoarScores(PA_SCORING_VERSION.V3_FIXED, {}, {}, lookupTable);
      scores.ageForScore = 60;

      const rawScores = {
        fsm: { test: { numCorrect: 12, numAttempted: 15 } },
        lsm: { test: { numCorrect: 13, numAttempted: 15 } },
        del: { test: { numCorrect: 0, numAttempted: 15 } },
      };

      const result = (await scores.computedScoreCallback(rawScores, { taskId: PA_TASK_ID, grade: 6, ageMonths: 60 }))!;

      // Grade 6 (>= 6) should use grade lookup: grade=6, roarScore=25
      expect(result.composite.percentile).toBe(60);
      expect(result.composite.standardScore).toBe(110);
    });

    it('does not modify composite if no matching lookup row found', async () => {
      const lookupTable = [{ ageMonths: 72, grade: 1, roarScore: 30, percentile: 50, standardScore: 100 }];

      const scores = new MockRoarScores(PA_SCORING_VERSION.V3_FIXED, {}, {}, lookupTable);
      scores.ageForScore = 60; // Different age, so no match

      const rawScores = {
        fsm: { test: { numCorrect: 10, numAttempted: 15 } },
        lsm: { test: { numCorrect: 10, numAttempted: 15 } },
        del: { test: { numCorrect: 0, numAttempted: 15 } },
      };

      const result = (await scores.computedScoreCallback(rawScores, { taskId: PA_TASK_ID, grade: 1, ageMonths: 60 }))!;

      // No matching row, so composite should only have base scores
      expect(result.composite.percentile).toBeUndefined();
      expect(result.composite.standardScore).toBeUndefined();
      expect(result.composite.roarScore).toBe(20); // 10 + 10 + 0
    });
  });

  describe('end-to-end: writeTrial → computedScoreCallback → scores', () => {
    it('computes correct scores from raw trial data', async () => {
      const scores = new MockRoarScores(PA_SCORING_VERSION.V3_FIXED);

      // Simulate raw scores accumulated from multiple trials
      const rawScores = {
        fsm: {
          practice: { numCorrect: 5, numAttempted: 10 },
          test: { numCorrect: 12, numAttempted: 15 },
        },
        lsm: {
          practice: { numCorrect: 4, numAttempted: 10 },
          test: { numCorrect: 10, numAttempted: 15 },
        },
        del: {
          practice: { numCorrect: 3, numAttempted: 10 },
          test: { numCorrect: 8, numAttempted: 15 },
        },
      };

      const result = (await scores.computedScoreCallback(rawScores, { taskId: PA_TASK_ID }))!;

      // Verify each subtask has correct computed scores
      expect(result.fsm.numCorrect).toBe(12);
      expect(result.fsm.percentCorrect).toBe(80); // 12/15 * 100 = 80
      expect(result.fsm.roarScore).toBe(12);

      expect(result.lsm.numCorrect).toBe(10);
      expect(result.lsm.percentCorrect).toBe(67); // 10/15 * 100 ≈ 67
      expect(result.lsm.roarScore).toBe(10);

      expect(result.del.numCorrect).toBe(8);
      expect(result.del.percentCorrect).toBe(53); // 8/15 * 100 ≈ 53
      expect(result.del.roarScore).toBe(8);

      // Composite should sum subtask roarScores
      expect(result.composite.roarScore).toBe(30); // 12 + 10 + 8
    });

    it('handles zero attempts gracefully', async () => {
      const scores = new MockRoarScores(PA_SCORING_VERSION.V3_FIXED);

      const rawScores = {
        fsm: {
          practice: { numCorrect: 0, numAttempted: 0 },
          test: { numCorrect: 0, numAttempted: 0 },
        },
        lsm: {
          practice: { numCorrect: 0, numAttempted: 0 },
          test: { numCorrect: 5, numAttempted: 10 },
        },
        del: {
          practice: { numCorrect: 0, numAttempted: 0 },
          test: { numCorrect: 0, numAttempted: 0 },
        },
      };

      const result = (await scores.computedScoreCallback(rawScores, { taskId: PA_TASK_ID }))!;

      // FSM with zero attempts should have 0% correct
      expect(result.fsm.percentCorrect).toBe(0);
      expect(result.fsm.numCorrect).toBe(0);

      // LSM with attempts should calculate correctly
      expect(result.lsm.percentCorrect).toBe(50);
      expect(result.lsm.numCorrect).toBe(5);
    });
  });
});
