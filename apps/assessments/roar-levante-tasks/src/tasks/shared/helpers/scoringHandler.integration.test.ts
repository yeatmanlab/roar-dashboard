import { vi, describe, test, expect, beforeEach, afterEach, type MockInstance } from 'vitest';
import { ScoringHandler } from './scoringHandler.js';
import { toLevanteScoreEntries, LEVANTE_SCORE_NAMES } from '@roar-platform/assessment-schema/roar-levante-tasks';
import fs from 'fs';
import path from 'node:path';
import papaparse from 'papaparse';

// Issue with importing getGrade from roar-utils, so we mock it
vi.mock('@bdelab/roar-utils', () => ({
  getGrade: () => 1,
}));

const getCsvContent = (input: string) => {
  const filename = input.split('/').pop();
  const csvPath = path.join(__dirname, '__fixtures__', filename!);
  return fs.readFileSync(csvPath, 'utf-8');
};

/**
 * Lookup tables contain only a subset of data for testing purposes
 *
 * TROG:
 * V1 - ageMonths - 72-168 (csv contains 72-75, 168)
 *
 * ROAR-INFERENCE:
 * V1 - ageMonths - 84-180 (csv contains 84-88, 180)
 */
describe('ScoringHandler Integration Tests', () => {
  // papaparse.parse is heavily overloaded (one overload returns a Duplex stream), so the
  // precise spy type rejects the loose `(input, config) => void` mock below. MockInstance<any>
  // matches the vitest-3 API while keeping the mock implementation flexible.
  let papaParseSpy: MockInstance<any>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  const originalParse = papaparse.parse;

  beforeEach(() => {
    papaParseSpy = vi.spyOn(papaparse, 'parse');
    papaParseSpy.mockImplementation((input: any, config: any) => {
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

  // ── age min clamping ──────────────────────────────────────────────────────

  test('should clamp age to minimum (72 months) for trog when age is below ageMin', async () => {
    const handler = new ScoringHandler('trog', 1, { age: 60 }); // 60 months < ageMin of 72
    await handler.initTable();

    expect(handler.ageForScore).toBe(72);
    expect(handler.lookupTableLoaded).toBe(true);
    expect(handler.lookupTable.length).toBeGreaterThan(0);
    expect(handler.lookupTable.every((row) => row.ageMonths === 72)).toBe(true);
  });

  test('should clamp age to minimum (84 months) for roar-inference when age is below ageMin', async () => {
    const handler = new ScoringHandler('roar-inference', 1, { age: 60 }); // 60 months < ageMin of 84
    await handler.initTable();

    expect(handler.ageForScore).toBe(84);
    expect(handler.lookupTableLoaded).toBe(true);
    expect(handler.lookupTable.length).toBeGreaterThan(0);
    expect(handler.lookupTable.every((row) => row.ageMonths === 84)).toBe(true);
  });

  // ── age max clamping ──────────────────────────────────────────────────────

  test('should clamp age to maximum (168 months) for trog when age is above ageMax', async () => {
    const handler = new ScoringHandler('trog', 1, { age: 220 }); // 220 months > ageMax of 168
    await handler.initTable();

    expect(handler.ageForScore).toBe(168);
    expect(handler.lookupTableLoaded).toBe(true);
    expect(handler.lookupTable.length).toBeGreaterThan(0);
    expect(handler.lookupTable.every((row) => row.ageMonths === 168)).toBe(true);
  });

  test('should clamp age to maximum (180 months) for roar-inference when age is above ageMax', async () => {
    const handler = new ScoringHandler('roar-inference', 1, { age: 220 }); // 220 months > ageMax of 180
    await handler.initTable();

    expect(handler.ageForScore).toBe(180);
    expect(handler.lookupTableLoaded).toBe(true);
    expect(handler.lookupTable.length).toBeGreaterThan(0);
    expect(handler.lookupTable.every((row) => row.ageMonths === 180)).toBe(true);
  });

  // ── clamped ages produce correct normed scores ────────────────────────────

  test('should return trog normed scores using clamped min age (72) when age is below ageMin', async () => {
    const handler = new ScoringHandler('trog', 1, { age: 60 });
    const result = await handler.computedScoreCallback({
      composite: { test: { thetaEstimate: 1.0 } },
    });

    // trog_lookup_v1.csv: ageMonths=72, thetaEstimate=1.0
    expect(result.composite.thetaEstimate).toBe(1.0);
    expect(result.composite.roarScore).toBe(567);
    expect(result.composite.standardScore).toBe(128);
    expect(result.composite.percentile).toBe(97);
  });

  test('should return trog normed scores using clamped max age (168) when age is above ageMax', async () => {
    const handler = new ScoringHandler('trog', 1, { age: 220 });
    const result = await handler.computedScoreCallback({
      composite: { test: { thetaEstimate: -1.0 } },
    });

    // trog_lookup_v1.csv: ageMonths=168, thetaEstimate=-1.0
    expect(result.composite.thetaEstimate).toBe(-1.0);
    expect(result.composite.roarScore).toBe(433);
    expect(result.composite.standardScore).toBe(72);
    expect(result.composite.percentile).toBe(3);
  });

  test('should return roar-inference normed scores using clamped min age (84) when age is below ageMin', async () => {
    const handler = new ScoringHandler('roar-inference', 1, { age: 60 });
    const result = await handler.computedScoreCallback({
      composite: { test: { thetaEstimate: 2.0 } },
    });

    // inference_lookup_v1.csv: ageMonths=84, thetaEstimate=2.0
    expect(result.composite.thetaEstimate).toBe(2.0);
    expect(result.composite.roarScore).toBe(633);
    expect(result.composite.standardScore).toBe('>135');
    expect(result.composite.percentile).toBe('>99');
  });

  test('should return roar-inference normed scores using clamped max age (180) when age is above ageMax', async () => {
    const handler = new ScoringHandler('roar-inference', 1, { age: 220 });
    const result = await handler.computedScoreCallback({
      composite: { test: { thetaEstimate: -2.0 } },
    });

    // inference_lookup_v1.csv: ageMonths=180, thetaEstimate=-2.0
    expect(result.composite.thetaEstimate).toBe(-2.0);
    expect(result.composite.roarScore).toBe(367);
    expect(result.composite.standardScore).toBe('<65');
    expect(result.composite.percentile).toBe('<1');
  });

  // ── no matching ageMonths row ─────────────────────────────────────────────

  test('should still report thetaEstimate when ageMonths has no matching row in lookup table', async () => {
    // age=100 months is within the valid trog range (72–168) so it is not clamped,
    // but the fixture only contains ages 72–75 and 168, so no rows will match.
    const handler = new ScoringHandler('trog', 1, { age: 100 });
    const result = await handler.computedScoreCallback({
      composite: { test: { thetaEstimate: 1.0 } },
    });

    expect(handler.lookupTableLoaded).toBe(true);
    expect(handler.ageForScore).toBe(100);
    expect(handler.lookupTable.length).toBe(0);

    expect(result.composite.thetaEstimate).toBe(1.0);
    expect(result.composite.roarScore).toBeUndefined();
    expect(result.composite.standardScore).toBeUndefined();
    expect(result.composite.percentile).toBeUndefined();
  });

  // ── no age or grade ───────────────────────────────────────────────────────

  test('should still report thetaEstimate and fail gracefully when no age or grade is available', async () => {
    // Lookup table still loads, but ageForScore cannot be determined so no normed scores
    const handler = new ScoringHandler('trog', 1, {}); // no age, no grade
    const result = await handler.computedScoreCallback({
      composite: { test: { thetaEstimate: 1.0 } },
    });

    expect(handler.lookupTableLoaded).toBe(true);
    expect(handler.ageForScore).toBeUndefined();
    expect(handler.lookupTable).toEqual([]);

    expect(result.composite.thetaEstimate).toBe(1.0);
    expect(result.composite.roarScore).toBeUndefined();
    expect(result.composite.standardScore).toBeUndefined();
    expect(result.composite.percentile).toBeUndefined();
  });

  // ── grade only (no age) ───────────────────────────────────────────────────

  test('should derive ageForScore from grade when no age is provided', async () => {
    // getGrade is mocked to return 1 regardless of input, so:
    //   ageForScore = 66 + 1 * 12 = 78
    // 78 is within the valid trog range (72–168) so it is not clamped, but
    // the fixture only contains ages 72–75 and 168, so no rows will match.
    const handler = new ScoringHandler('trog', 1, { grade: 1 }); // grade 1, no age
    const result = await handler.computedScoreCallback({
      composite: { test: { thetaEstimate: 0.5 } },
    });

    expect(handler.lookupTableLoaded).toBe(true);
    expect(handler.ageForScore).toBe(78); // 66 + getGrade(1) * 12 = 66 + 1 * 12
    expect(handler.lookupTable.length).toBe(0);

    expect(result.composite.thetaEstimate).toBe(0.5);
    expect(result.composite.roarScore).toBeUndefined();
    expect(result.composite.standardScore).toBeUndefined();
    expect(result.composite.percentile).toBeUndefined();
  });

  // ── unnormed scoring ──────────────────────────────────────────────────────

  test('should return unnormed scores and skip table load when scoring version is 0', async () => {
    const handler = new ScoringHandler('roar-inference', 0, { age: 108 });
    const result = await handler.computedScoreCallback({
      composite: { test: { numCorrect: 10, numAttempted: 25, thetaEstimate: 1.0 } },
    });

    expect(papaParseSpy).not.toHaveBeenCalled();
    expect(result.composite.totalNumAttempted).toBe(25);
    expect(result.composite.totalCorrect).toBe(0);
    expect(result.composite.totalPercentCorrect).toBe(0);
    expect(result.composite.thetaEstimate).toBeUndefined();
    expect(result.composite.roarScore).toBeUndefined();
  });

  test('should return thetaEstimate and log an error when scoring version has no corresponding lookup table', async () => {
    // scoringVersion=2 is > 0 so the normed path is taken, but trog_lookup_v2.csv
    // does not exist in the fixtures, causing the table load to fail.
    const handler = new ScoringHandler('trog', 2, { age: 108 });
    const result = await handler.computedScoreCallback({
      composite: { test: { thetaEstimate: -0.5 } },
    });

    expect(papaParseSpy).toHaveBeenCalled();
    expect(handler.lookupTableLoaded).toBe(false);
    expect(handler.lookupTableError).toBeTruthy();
    expect(consoleErrorSpy).toHaveBeenCalled();

    expect(result.composite.thetaEstimate).toBe(-0.5);
    expect(result.composite.roarScore).toBeUndefined();
    expect(result.composite.standardScore).toBeUndefined();
    expect(result.composite.percentile).toBeUndefined();
  });

  // ── race conditions ───────────────────────────────────────────────────────

  test('should load the lookup table only once when multiple calls are made concurrently', async () => {
    const handler = new ScoringHandler('trog', 1, { age: 72 });
    const rawScores = { composite: { test: { thetaEstimate: 0.0 } } };

    const [result1, result2, result3] = await Promise.all([
      handler.computedScoreCallback(rawScores),
      handler.computedScoreCallback(rawScores),
      handler.computedScoreCallback(rawScores),
    ]);

    // Only one network request despite three concurrent calls
    expect(papaParseSpy).toHaveBeenCalledTimes(1);
    expect(handler.lookupTableLoaded).toBe(true);

    // All three calls should resolve to the same correct normed scores
    for (const result of [result1, result2, result3]) {
      expect(result.composite.thetaEstimate).toBe(0.0);
      expect(result.composite.roarScore).toBe(500);
      expect(result.composite.standardScore).toBe(114);
      expect(result.composite.percentile).toBe(82);
    }
  });

  test('should not reload the lookup table on subsequent sequential calls after initial load', async () => {
    const handler = new ScoringHandler('trog', 1, { age: 72 });

    // First trial
    const result1 = await handler.computedScoreCallback({
      composite: { test: { thetaEstimate: 0.0 } },
    });
    expect(papaParseSpy).toHaveBeenCalledTimes(1);
    expect(result1.composite.roarScore).toBe(500);

    // Second trial — table already loaded, no new network request
    const result2 = await handler.computedScoreCallback({
      composite: { test: { thetaEstimate: 1.0 } },
    });
    expect(papaParseSpy).toHaveBeenCalledTimes(1);
    expect(result2.composite.roarScore).toBe(567);
  });

  test('should not re-log the same error on repeated failed load attempts', async () => {
    // scoringVersion=2 causes a load failure; subsequent calls with the same
    // error should be silently swallowed to avoid flooding logs.
    const handler = new ScoringHandler('trog', 2, { age: 72 });
    const rawScores = { composite: { test: { thetaEstimate: 0.0 } } };

    await handler.computedScoreCallback(rawScores);
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);

    // Second call reuses the same rejected promise — same error, not re-logged
    await handler.computedScoreCallback(rawScores);
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
  });

  test('should retry loading the table and return correct normed scores after an initial load failure', async () => {
    // The first call fails via config.error(), which resets lookupTablePromise to null
    // (see the error handler in initTable). The second call can then retry and succeed.
    let hasFailed = false;

    papaParseSpy.mockImplementation((input: any, config: any) => {
      if (hasFailed) {
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
        hasFailed = true;
        setTimeout(() => {
          config.error(new Error('Simulated network failure'));
        }, 100);
      }
    });

    const handler = new ScoringHandler('trog', 1, { age: 72 });

    // First call: table load fails
    const result1 = await handler.computedScoreCallback({
      composite: { test: { thetaEstimate: 0.0 } },
    });

    expect(handler.lookupTableLoaded).toBe(false);
    expect(handler.lookupTableError).toBeTruthy();
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(result1.composite.thetaEstimate).toBe(0.0);
    expect(result1.composite.roarScore).toBeUndefined();

    // Second call: lookupTablePromise was reset to null by the error handler,
    // so initTable() is called again and this time succeeds.
    const result2 = await handler.computedScoreCallback({
      composite: { test: { thetaEstimate: 1.0 } },
    });

    expect(papaParseSpy).toHaveBeenCalledTimes(2);
    expect(handler.lookupTableLoaded).toBe(true);
    expect(result2.composite.thetaEstimate).toBe(1.0);
    expect(result2.composite.roarScore).toBe(567);
    expect(result2.composite.standardScore).toBe(128);
    expect(result2.composite.percentile).toBe(97);
  });

  // ── normed + unnormed score merge ─────────────────────────────────────────

  test('should merge normed IRT scores with raw counts for a normed task', async () => {
    // Verifies that computedScoreCallback merges both getNormedScores and
    // getUnnormedScores into a single composite object, so run_scores receives
    // both IRT/normed fields and count fields for trog/roar-inference.
    const handler = new ScoringHandler('trog', 1, { age: 72 });
    handler.totalCorrect = 12;

    const result = await handler.computedScoreCallback({
      composite: { test: { thetaEstimate: 1.0, numAttempted: 15, numCorrect: 12 } },
    });

    // Normed IRT fields (trog_lookup_v1.csv: ageMonths=72, thetaEstimate=1.0)
    expect(result.composite.thetaEstimate).toBe(1.0);
    expect(result.composite.roarScore).toBe(567);
    expect(result.composite.standardScore).toBe(128);
    expect(result.composite.percentile).toBe(97);
    expect(result.composite.scoringVersion).toBe(1);

    // Count fields merged alongside — normed fields take precedence on collision
    expect(result.composite.totalCorrect).toBe(12);
    expect(result.composite.totalNumAttempted).toBe(15);
    expect(result.composite.totalPercentCorrect).toBe(80);
  });

  // ── toLevanteScoreEntries integration ─────────────────────────────────────

  test('toLevanteScoreEntries emits both IRT and count entries for a normed task', async () => {
    const handler = new ScoringHandler('trog', 1, { age: 72 });
    handler.totalCorrect = 12;

    const computed = await handler.computedScoreCallback({
      composite: { test: { thetaEstimate: 1.0, numAttempted: 15 } },
    });

    const entries = toLevanteScoreEntries(computed, { strict: true });

    expect(entries).toContainEqual(
      expect.objectContaining({ name: LEVANTE_SCORE_NAMES.THETA_ESTIMATE, type: 'computed' }),
    );
    expect(entries).toContainEqual(
      expect.objectContaining({ name: LEVANTE_SCORE_NAMES.ROAR_SCORE, type: 'computed', value: '567' }),
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

  test('toLevanteScoreEntries emits only count entries for an unnormed task', async () => {
    const handler = new ScoringHandler('roar-inference', 0, { age: 108 });
    handler.totalCorrect = 7;

    const computed = await handler.computedScoreCallback({
      composite: { test: { numAttempted: 10 } },
    });

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
    expect(papaParseSpy).not.toHaveBeenCalled();
  });
});
