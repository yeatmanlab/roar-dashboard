// scoring.integration.test.js
import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest';
import { ScoringHandler } from '../tasks/shared/helpers/scoringHandler.ts';
import { toLevanteScoreEntries, LEVANTE_SCORE_NAMES } from '@roar-platform/assessment-schema/roar-levante-tasks';
import fs from 'fs';
import papaparse from 'papaparse';

// getGrade is used to derive ageForScore from grade when age is absent.
// Mock it to return a deterministic value so tests don't depend on the real implementation.
vi.mock('@bdelab/roar-utils', () => ({
  getGrade: () => 3,
}));

/**
 * Lookup table fixtures contain a subset of real data for testing purposes:
 *   trog:      ageMonths 72 / 108 / 216, thetaEstimate -1.0 / 0.0 / 1.0
 *   inference: ageMonths 72 / 108 / 216, thetaEstimate -1.0 / 0.0 / 1.0
 */
const getCsvContent = (input) => {
  const filename = input.split('/').pop();
  // import.meta.dirname is polyfilled by Vitest. Avoid path.join — jsdom
  // resolves 'path' to a browser shim that lacks util.isString.
  const csvPath = `${import.meta.dirname}/__fixtures__/${filename}`;
  return fs.readFileSync(csvPath, 'utf-8');
};

describe('ScoringHandler Integration Tests', () => {
  let papaParseSpy;
  let consoleErrorSpy;
  const originalParse = papaparse.parse;

  beforeEach(() => {
    papaParseSpy = vi.spyOn(papaparse, 'parse');
    papaParseSpy.mockImplementation((input, config) => {
      if (config.download) {
        const csvContent = getCsvContent(input);
        if (config.complete) {
          setTimeout(() => {
            originalParse(csvContent, {
              ...config,
              download: false,
              complete: config.complete,
            });
          }, 100);
        }
      } else {
        originalParse(input, config);
      }
    });

    consoleErrorSpy = vi.spyOn(console, 'error');
  });

  afterEach(() => {
    papaParseSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  test('should load and parse trog lookup table for given age', async () => {
    const handler = new ScoringHandler('trog', 1, { age: 108 });

    await handler.initTable();

    expect(papaParseSpy).toHaveBeenCalledWith(
      'https://storage.googleapis.com/roar-syntax/scores/trog_lookup_v1.csv',
      expect.anything(),
    );
    expect(handler.lookupTableLoaded).toBe(true);
    expect(handler.lookupTable.length).toBeGreaterThan(0);
    expect(handler.lookupTable.every((row) => row.ageMonths === 108)).toBe(true);
  });

  test('should return trog normed scores for given theta and age', async () => {
    const handler = new ScoringHandler('trog', 1, { age: 108 });
    handler.totalCorrect = 0;
    handler.irtEstimates = null;

    const rawScores = {
      composite: { test: { thetaEstimate: -1.0, numAttempted: 10, numCorrect: 0 } },
    };

    const result = await handler.computedScoreCallback(rawScores);

    expect(result.composite.thetaEstimate).toBe(-1.0);
    expect(result.composite.roarScore).toBe(430);
    expect(result.composite.standardScore).toBe(87);
    expect(result.composite.percentile).toBe(19);
    expect(result.composite.scoringVersion).toBe(1);
  });

  test('should return roar-inference normed scores for given theta and age', async () => {
    const handler = new ScoringHandler('roar-inference', 1, { age: 108 });
    handler.totalCorrect = 0;
    handler.irtEstimates = null;

    const rawScores = {
      composite: { test: { thetaEstimate: 0.0, numAttempted: 10, numCorrect: 0 } },
    };

    const result = await handler.computedScoreCallback(rawScores);

    expect(papaParseSpy).toHaveBeenCalledWith(
      'https://storage.googleapis.com/roar-inference/scores/inference_lookup_v1.csv',
      expect.anything(),
    );
    expect(result.composite.thetaEstimate).toBe(0.0);
    expect(result.composite.roarScore).toBe(485);
    expect(result.composite.standardScore).toBe(99);
    expect(result.composite.percentile).toBe(47);
    expect(result.composite.scoringVersion).toBe(1);
  });

  test('normed task output merges IRT scores with raw counts', async () => {
    const handler = new ScoringHandler('trog', 1, { age: 108 });
    handler.totalCorrect = 12;
    handler.irtEstimates = null;

    const rawScores = {
      composite: { test: { thetaEstimate: 1.0, numAttempted: 15, numCorrect: 12 } },
    };

    const result = await handler.computedScoreCallback(rawScores);

    // Normed IRT scores
    expect(result.composite.thetaEstimate).toBe(1.0);
    expect(result.composite.roarScore).toBe(550);
    expect(result.composite.standardScore).toBe(113);
    expect(result.composite.scoringVersion).toBe(1);

    // Raw counts merged alongside — normed fields take precedence on collision
    expect(result.composite.totalCorrect).toBe(12);
    expect(result.composite.totalNumAttempted).toBe(15);
    expect(result.composite.totalPercentCorrect).toBe(80);
  });

  test('unnormed task returns count-based scores without loading a lookup table', async () => {
    const handler = new ScoringHandler('egma-math', 0, { age: 108 });
    handler.totalCorrect = 8;
    handler.irtEstimates = null;

    const rawScores = {
      composite: { test: { numAttempted: 10, numCorrect: 8 } },
    };

    const result = await handler.computedScoreCallback(rawScores);

    expect(papaParseSpy).not.toHaveBeenCalled();
    expect(result.composite.totalCorrect).toBe(8);
    expect(result.composite.totalNumAttempted).toBe(10);
    expect(result.composite.totalPercentCorrect).toBe(80);
    expect(result.composite.roarScore).toBeUndefined();
    expect(result.composite.percentile).toBeUndefined();
  });

  test('should clamp age to minimum when age is below ageMin', async () => {
    const handler = new ScoringHandler('trog', 1, { age: 30 }); // below min of 72

    await handler.initTable();

    expect(handler.ageForScore).toBe(72);
  });

  test('should clamp age to maximum when age is above ageMax', async () => {
    const handler = new ScoringHandler('trog', 1, { age: 300 }); // above max of 216

    await handler.initTable();

    expect(handler.ageForScore).toBe(216);
  });

  test('should derive age from grade when age is absent', async () => {
    // getGrade is mocked to return 3; ageForScore = 66 + 3*12 = 102
    const handler = new ScoringHandler('trog', 1, { grade: 3 });

    await handler.initTable();

    expect(handler.ageForScore).toBe(102);
  });

  test('should prevent race condition when multiple concurrent calls use the same table', async () => {
    const handler = new ScoringHandler('trog', 1, { age: 108 });
    handler.totalCorrect = 0;
    handler.irtEstimates = null;

    const rawScores = { composite: { test: { thetaEstimate: 0.0, numAttempted: 10 } } };

    const promises = [
      handler.computedScoreCallback(rawScores),
      handler.computedScoreCallback(rawScores),
      handler.computedScoreCallback(rawScores),
    ];

    await Promise.all(promises);

    expect(papaParseSpy).toHaveBeenCalledTimes(1);
    expect(handler.lookupTableLoaded).toBe(true);
  });

  test('should compute most recent theta value after failed initial load', async () => {
    let hasFailed = false;

    papaParseSpy.mockImplementation((input, config) => {
      if (hasFailed) {
        const csvContent = getCsvContent(input);
        if (config.complete) {
          originalParse(csvContent, { ...config, download: false, complete: config.complete });
        }
      } else {
        hasFailed = true;
        setTimeout(() => config.error(new Error('Simulated download failure')), 250);
      }
    });

    const handler = new ScoringHandler('trog', 1, { age: 108 });
    handler.totalCorrect = 0;
    handler.irtEstimates = null;

    const rawScoresA = { composite: { test: { thetaEstimate: -1.0, numAttempted: 5 } } };
    const rawScoresB = { composite: { test: { thetaEstimate: 0.0, numAttempted: 10 } } };

    // First call — table load fails
    const resultA = await handler.computedScoreCallback(rawScoresA);

    expect(handler.lookupTableLoaded).toBe(false);
    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(resultA.composite.thetaEstimate).toBe(-1.0);
    expect(resultA.composite.roarScore).toBeUndefined();

    // Second call — retries and succeeds
    const resultB = await handler.computedScoreCallback(rawScoresB);

    expect(handler.lookupTableLoaded).toBe(true);
    expect(resultB.composite.thetaEstimate).toBe(0.0);
    expect(resultB.composite.roarScore).toBe(490);
    expect(papaParseSpy).toHaveBeenCalledTimes(2);
  });

  test('toLevanteScoreEntries on normed callback output emits both IRT and count entries', async () => {
    const handler = new ScoringHandler('trog', 1, { age: 108 });
    handler.totalCorrect = 12;
    handler.irtEstimates = null;

    const rawScores = {
      composite: { test: { thetaEstimate: 1.0, numAttempted: 15 } },
    };

    const computed = await handler.computedScoreCallback(rawScores);
    const entries = toLevanteScoreEntries(computed, { strict: true });

    expect(entries).toContainEqual(
      expect.objectContaining({ name: LEVANTE_SCORE_NAMES.THETA_ESTIMATE, type: 'computed' }),
    );
    expect(entries).toContainEqual(
      expect.objectContaining({ name: LEVANTE_SCORE_NAMES.ROAR_SCORE, type: 'computed', value: '550' }),
    );
    expect(entries).toContainEqual(
      expect.objectContaining({ name: LEVANTE_SCORE_NAMES.TOTAL_CORRECT, type: 'raw', value: '12' }),
    );
    expect(entries).toContainEqual(
      expect.objectContaining({ name: LEVANTE_SCORE_NAMES.TOTAL_NUM_ATTEMPTED, type: 'raw', value: '15' }),
    );
    expect(entries).toContainEqual(
      expect.objectContaining({ name: LEVANTE_SCORE_NAMES.TOTAL_PERCENT_CORRECT, type: 'computed', value: '80' }),
    );
  });

  test('toLevanteScoreEntries on unnormed callback output emits only count entries', async () => {
    const handler = new ScoringHandler('egma-math', 0, { age: 108 });
    handler.totalCorrect = 7;
    handler.irtEstimates = null;

    const rawScores = {
      composite: { test: { numAttempted: 10 } },
    };

    const computed = await handler.computedScoreCallback(rawScores);
    const entries = toLevanteScoreEntries(computed, { strict: true });

    expect(entries).toContainEqual(
      expect.objectContaining({ name: LEVANTE_SCORE_NAMES.TOTAL_CORRECT, type: 'raw', value: '7' }),
    );
    expect(entries).toContainEqual(
      expect.objectContaining({ name: LEVANTE_SCORE_NAMES.TOTAL_NUM_ATTEMPTED, type: 'raw', value: '10' }),
    );
    expect(entries).toContainEqual(
      expect.objectContaining({ name: LEVANTE_SCORE_NAMES.TOTAL_PERCENT_CORRECT, type: 'computed', value: '70' }),
    );
    expect(entries).not.toContainEqual(expect.objectContaining({ name: LEVANTE_SCORE_NAMES.ROAR_SCORE }));
    expect(entries).not.toContainEqual(expect.objectContaining({ name: LEVANTE_SCORE_NAMES.PERCENTILE }));
  });
});
