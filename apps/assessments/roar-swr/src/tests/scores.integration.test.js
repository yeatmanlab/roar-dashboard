// scores.integration.test.js
import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest';
import { RoarScores } from '../experiment/scores.js';
import fs from 'fs';
import path from 'path';
import store from 'store2';
import papaparse from 'papaparse';
import { fileURLToPath } from 'url';

// Issue with importing getGrade from roar-utils, so we mock it
vi.mock('@bdelab/roar-utils', () => ({
  getGrade: () => 3,
}));

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const getCsvContent = (input) => {
  const filename = input.split('/').pop();
  const csvPath = path.join(__dirname, '__fixtures__', filename);
  return fs.readFileSync(csvPath, 'utf-8');
};

/**
 * Lookup table contain only subset of data for testing purposes
 *
 * SWR:
 * V6 - ageMonths 108-110
 * V7 - ageMonths 108-110
 *
 * SWR-ES:
 * V1 - ageMonths 108-110
 */
describe('RoarScores Integration Tests', () => {
  let papaParseSpy;
  let consoleErrorSpy;
  let originalParse = papaparse.parse;

  beforeEach(() => {
    papaParseSpy = vi.spyOn(papaparse, 'parse');
    papaParseSpy.mockImplementation((input, config) => {
      if (config.download) {
        // Instead of downloading, read local CSV
        const csvContent = getCsvContent(input);

        // Call the complete callback with parsed data
        if (config.complete) {
          setTimeout(() => {
            originalParse(csvContent, {
              ...config,
              download: false, // disable recursive download
              complete: config.complete,
            });
          }, 100);
          // Don't call originalParse again, just let the first one complete
        }
      } else {
        // Normal parse for local CSV strings
        originalParse(input, config);
      }
    });

    consoleErrorSpy = vi.spyOn(console, 'error');
  });

  afterEach(() => {
    papaParseSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  test('should load and parse CSV lookup table for given age', async () => {
    store.session.get = vi.fn(() => ({
      scoringVersion: 6,
      userMetadata: { ageMonths: 108 },
      taskId: 'swr',
    }));

    const scores = new RoarScores();

    await scores.initTable('swr');

    expect(papaParseSpy).toHaveBeenCalledWith(
      'https://storage.googleapis.com/roar-swr/scores/swr_lookup_v6.csv',
      expect.anything(),
    );

    expect(scores.tableLoaded).toBe(true);
    expect(scores.lookupTable.length).toBeGreaterThan(0);
    expect(scores.lookupTable.every((row) => row.ageMonths === 108)).toBe(true);
  });

  test('should return v6 scores for given theta and age', async () => {
    store.session.get = vi.fn(() => ({
      scoringVersion: 6,
      userMetadata: { ageMonths: 108 },
      taskId: 'swr',
    }));

    const scores = new RoarScores();
    const rawScores = {
      composite: {
        test: { thetaEstimate: -1.0 },
      },
    };

    const result = await scores.computedScoreCallback(rawScores);

    expect(result.composite.thetaEstimate).toBe(-1.0);
    expect(result.composite.roarScore).toBe(433);
    expect(result.composite.standardScore).toBe(99);
    expect(result.composite.wjPercentile).toBe(47.5);
    expect(result.composite.scoringVersion).toBe(6);
  });

  test('should return v7 scores for given theta and age', async () => {
    store.session.get = vi.fn(() => ({
      scoringVersion: 7,
      userMetadata: { ageMonths: 108 },
      taskId: 'swr',
    }));

    const scores = new RoarScores();
    const rawScores = {
      composite: {
        test: { thetaEstimate: -1.0 },
      },
    };

    const result = await scores.computedScoreCallback(rawScores);

    expect(result.composite.thetaEstimate).toBe(-1.0);
    expect(result.composite.roarScore).toBe(433);
    expect(result.composite.standardScore).toBe(98);
    expect(result.composite.percentile).toBe(44);
    expect(result.composite.scoringVersion).toBe(7);
  });

  test('should skip loading norm tables for swr-es when scoringVersion < 1', async () => {
    store.session.get = vi.fn(() => ({
      scoringVersion: 0,
      userMetadata: { ageMonths: 108 },
      taskId: 'swr-es',
    }));

    const scores = new RoarScores();
    const rawScores = {
      composite: {
        test: { thetaEstimate: 0.5 },
      },
    };

    const result = await scores.computedScoreCallback(rawScores);

    expect(papaParseSpy).not.toHaveBeenCalled();
    expect(scores.tableLoaded).toBe(false);
    expect(scores.lookupTable).toEqual([]);
    expect(result.composite.thetaEstimate).toBe(0.5);
    expect(result.composite.roarScore).toBeUndefined();
  });

  test('should return swr-es v1 scores for given theta and age', async () => {
    store.session.get = vi.fn(() => ({
      scoringVersion: 1,
      userMetadata: { ageMonths: 108 },
      taskId: 'swr-es',
    }));

    const scores = new RoarScores();
    const rawScores = {
      composite: {
        test: { thetaEstimate: 0.5 },
      },
    };

    const result = await scores.computedScoreCallback(rawScores);

    expect(result.composite.thetaEstimate).toBe(0.5);
    expect(result.composite.roarScore).toBe(533);
    expect(result.composite.standardScore).toBe(108);
    expect(result.composite.percentile).toBe(70);
    expect(result.composite.scoringVersion).toBe(1);
  });

  test('should clamp age to minimum (72 months) when age is below ageMin', async () => {
    store.session.get = vi.fn(() => ({
      scoringVersion: 6,
      userMetadata: { ageMonths: 60 }, // Below ageMin of 72
      taskId: 'swr',
    }));

    const scores = new RoarScores();

    await scores.initTable('swr');

    expect(scores.ageForScore).toBe(72);
  });

  test('should clamp age to maximum (216 months) when age is above ageMax', async () => {
    store.session.get = vi.fn(() => ({
      scoringVersion: 6,
      userMetadata: { ageMonths: 250 }, // Above ageMax of 216
      taskId: 'swr',
    }));

    const scores = new RoarScores();

    await scores.initTable('swr');

    // Should clamp to 216 months
    expect(scores.ageForScore).toBe(216);
  });

  test('should prevent race condition when multiple concurrent calls request the same table', async () => {
    store.session.get = vi.fn(() => ({
      scoringVersion: 6,
      userMetadata: { ageMonths: 108 },
      taskId: 'swr',
    }));

    const scores = new RoarScores();
    const rawScores = { composite: { test: { thetaEstimate: 0.5 } } };

    const promises = [
      scores.computedScoreCallback(rawScores),
      scores.computedScoreCallback(rawScores),
      scores.computedScoreCallback(rawScores),
    ];

    await Promise.all(promises);

    expect(papaParseSpy).toHaveBeenCalledTimes(1);
    expect(scores.tableLoaded).toBe(true);
  });

  test('should compute most recent theta value after failed initial load', async () => {
    let hasFailed = false;

    papaParseSpy.mockImplementation((input, config) => {
      if (hasFailed) {
        const csvContent = getCsvContent(input);

        if (config.complete) {
          originalParse(csvContent, {
            ...config,
            download: false,
            complete: config.complete,
          });
        }
      } else {
        hasFailed = true;
        setTimeout(() => {
          config.error(new Error('Simulated download failure'));
        }, 250);
      }
    });

    store.session.get = vi.fn(() => ({
      scoringVersion: 7,
      userMetadata: { ageMonths: 108 },
      taskId: 'swr',
    }));

    const scores = new RoarScores();

    // First trial with theta = -1.0
    const rawScoresA = { composite: { test: { thetaEstimate: -1.0 } } };

    // Second trial with theta = 0.5 (different score)
    const rawScoresB = { composite: { test: { thetaEstimate: 0.5 } } };

    // First call with rawScoresA fails to load table
    const resultA_failed = await scores.computedScoreCallback(rawScoresA);

    expect(scores.tableLoaded).toBe(false);
    expect(consoleErrorSpy).toHaveBeenCalled();

    // rawScoresA should NOT have computed normed scores (only raw theta)
    expect(resultA_failed.composite.thetaEstimate).toBe(-1.0);
    expect(resultA_failed.composite.roarScore).toBeUndefined();
    expect(resultA_failed.composite.standardScore).toBeUndefined();
    expect(resultA_failed.composite.percentile).toBeUndefined();

    // Second call with rawScoresB - retries and succeeds, updating the same score instance
    const resultB = await scores.computedScoreCallback(rawScoresB);

    // Verify the score instance now has the lookup table loaded
    expect(scores.tableLoaded).toBe(true);
    expect(scores.lookupTable.length).toBeGreaterThan(0);

    // Verify it computed scores for rawScoresB correctly using the newly loaded table
    expect(resultB.composite.thetaEstimate).toBe(0.5);
    expect(resultB.composite.roarScore).toBe(533);
    expect(resultB.composite.standardScore).toBe(111);
    expect(resultB.composite.percentile).toBe(76);

    // Only 2 Papa.parse calls: 1 failed (rawScoresA), 1 succeeded (rawScoresB)
    expect(papaParseSpy).toHaveBeenCalledTimes(2);

    // The scores instance's lookup table is now loaded and ready for future calls
    expect(scores.tableLoaded).toBe(true);
  });

  test('should return null for non-SWR or SWR-ES taskIds', async () => {
    store.session.get = vi.fn(() => ({
      userMetadata: { ageMonths: 84 },
      taskId: 'sre',
    }));

    const scores = new RoarScores();

    const result = await scores.computedScoreCallback({});

    expect(result).toBeNull();
  });

  test('should handle missing userMetadata gracefully', async () => {
    store.session.get = vi.fn(() => ({
      scoringVersion: 7,
      taskId: 'swr',
    }));

    const scores = new RoarScores();
    const rawScores = {
      composite: {
        test: { thetaEstimate: 0.5 },
      },
    };

    const result = await scores.computedScoreCallback(rawScores);

    expect(result.composite.thetaEstimate).toBe(0.5);
    expect(result.composite.roarScore).toBeUndefined();
    expect(result.composite.standardScore).toBeUndefined();
    expect(result.composite.percentile).toBeUndefined();
  });
});
