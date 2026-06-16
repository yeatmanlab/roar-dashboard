import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest';
import { RoarScores } from '../experiment/scores.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import store from 'store2';
import papaparse from 'papaparse';

// Issue with importing getGrade from roar-utils, so we mock it
vi.mock('@bdelab/roar-utils', () => ({
  getGrade: (grade) => grade,
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
 * SRE:
 * V3 - grade 2-4
 * V4 - ageMonths 84-90
 *
 * SRE-ES:
 * V1 - ageMonths 84-86
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
        }
      } else {
        // Normal parse for local CSV strings
        originalParse(input, config);
      }
    });

    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    papaParseSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  test('should load and parse both CSV lookup tables (main + AI equating)', async () => {
    store.session.get = vi.fn(() => ({
      scoringVersion: 4,
      userMetadata: { ageMonths: 85 },
      taskId: 'sre',
    }));

    const scores = new RoarScores();

    await scores.initTable();

    expect(papaParseSpy).toHaveBeenCalledTimes(2);
    expect(papaParseSpy).toHaveBeenCalledWith(
      'https://storage.googleapis.com/roar-sre/scores/sre_lookup_v4.csv',
      expect.anything(),
    );
    expect(papaParseSpy).toHaveBeenCalledWith(
      'https://storage.googleapis.com/roar-sre/scores/sre_parallel_equating_lookup.csv',
      expect.anything(),
    );

    expect(scores.tableLoaded).toBe(true);
    expect(scores.aiTableLoaded).toBe(true);
    expect(scores.lookupTable.length).toBeGreaterThan(0);
    expect(scores.aiLookupTable.length).toBeGreaterThan(0);
    expect(scores.lookupTable.every((row) => row.ageMonths === 85)).toBe(true);
  });

  test('should return v3 scores for given sreScore and grade', async () => {
    store.session.get = vi.fn(() => ({
      scoringVersion: 3,
      userMetadata: { grade: 2, ageMonths: 84 },
      taskId: 'sre',
    }));

    const scores = new RoarScores();
    const rawScores = {
      lab: {
        test: { numCorrect: 25, numIncorrect: 0 },
      },
    };

    const result = await scores.computedScoreCallback(rawScores);

    expect(result.composite.sreScore).toBe(25);
    expect(result.composite.tosrecSS).toBe(90);
    expect(result.composite.tosrecPercentile).toBe(25);
    expect(result.composite.scoringVersion).toBe(3);
  });

  test('should return v4 scores for given sreScore and age', async () => {
    store.session.get = vi.fn(() => ({
      scoringVersion: 4,
      userMetadata: { grade: 2, ageMonths: 84 },
      taskId: 'sre',
    }));

    const scores = new RoarScores();
    const rawScores = {
      lab: {
        test: { numCorrect: 30, numIncorrect: 0 },
      },
    };

    const result = await scores.computedScoreCallback(rawScores);

    expect(scores.tableLoaded).toBe(true);
    expect(scores.aiTableLoaded).toBe(true);
    expect(result.composite.sreScore).toBe(30);
    expect(result.composite.standardScore).toBe(113);
    expect(result.composite.percentile).toBe(80);
    expect(result.composite.scoringVersion).toBe(4);
  });

  test('should convert grade to ageMonths for v4 scoring when ageMonths not provided', async () => {
    store.session.get = vi.fn(() => ({
      scoringVersion: 4,
      userMetadata: { grade: 2 }, // Grade 2, no ageMonths
      taskId: 'sre',
    }));

    const scores = new RoarScores();
    const rawScores = {
      lab: {
        test: { numCorrect: 20, numIncorrect: 0 },
      },
    };

    const result = await scores.computedScoreCallback(rawScores);

    expect(scores.tableLoaded).toBe(true);
    expect(scores.aiTableLoaded).toBe(true);
    expect(result.composite.sreScore).toBe(20);
    expect(result.composite.standardScore).toBe(101);
    expect(result.composite.percentile).toBe(53);
    expect(result.composite.scoringVersion).toBe(4);
  });

  test('should skip loading norm tables for sre-es when scoringVersion < 1', async () => {
    store.session.get = vi.fn(() => ({
      userMetadata: { ageMonths: 84 },
      taskId: 'sre-es',
    }));

    const scores = new RoarScores();
    const rawScores = {
      subtest1: {
        test: { numCorrect: 10, numIncorrect: 2 },
      },
      subtest2: {
        test: { numCorrect: 8, numIncorrect: 1 },
      },
    };

    await scores.computedScoreCallback(rawScores);

    expect(papaParseSpy).not.toHaveBeenCalled();
    expect(scores.tableLoaded).toBe(false);
    expect(scores.lookupTable).toEqual([]);
  });

  test('should return unnormed scores for sre-es with scoringVersion 0', async () => {
    store.session.get = vi.fn(() => ({
      userMetadata: {}, // No ageMonths, no grade
      taskId: 'sre-es',
      scoringVersion: 0,
    }));

    const scores = new RoarScores();
    const rawScores = {
      subtest1: { test: { numCorrect: 10, numIncorrect: 2 } },
      subtest2: { test: { numCorrect: 8, numIncorrect: 1 } },
    };

    const result = await scores.computedScoreCallback(rawScores);

    // Should not load tables
    expect(papaParseSpy).not.toHaveBeenCalled();
    expect(scores.tableLoaded).toBe(false);

    // Should still return scores (unnormed)
    expect(result.subtest1.sreScore).toBe(8); // 10 - 2
    expect(result.subtest2.sreScore).toBe(7); // 8 - 1
    expect(result.composite.sreScore).toBe(15); // 8 + 7

    // Should not have standardScore or percentile (unnormed)
    expect(result.composite.standardScore).toBeUndefined();
    expect(result.composite.percentile).toBeUndefined();
  });

  test('should return sre-es v1 scores for given sreScore and age', async () => {
    store.session.get = vi.fn(() => ({
      scoringVersion: 1,
      userMetadata: { ageMonths: 85 },
      taskId: 'sre-es',
    }));

    const scores = new RoarScores();
    const rawScores = {
      subtest1: {
        test: { numCorrect: 8, numIncorrect: 0 },
      },
      subtest2: {
        test: { numCorrect: 2, numIncorrect: 0 },
      },
    };

    const result = await scores.computedScoreCallback(rawScores);

    expect(scores.tableLoaded).toBe(true);
    expect(scores.aiTableLoaded).toBe(false);
    expect(result.composite.sreScore).toBe(10);
    expect(result.composite.standardScore).toBe(108);
    expect(result.composite.percentile).toBe(71);
    expect(result.composite.scoringVersion).toBe(1);
  });

  test('should use AI equating table to convert aiV1P1 scores to composite sreScore', async () => {
    store.session.get = vi.fn(() => ({
      scoringVersion: 4,
      userMetadata: { ageMonths: 84 },
      taskId: 'sre',
    }));

    const scores = new RoarScores();
    const rawScores = {
      aiV1P1: {
        test: { numCorrect: 20, numIncorrect: 0 },
      },
    };

    const result = await scores.computedScoreCallback(rawScores);

    expect(scores.tableLoaded).toBe(true);
    expect(scores.aiTableLoaded).toBe(true);
    // aiV1P1 rawScore 20 -> equated sreScore 21 (from parallel table)
    expect(result.aiV1P1.sreScore).toBe(20);
    expect(result.composite.sreScore).toBe(21);
    expect(result.composite.standardScore).toBe(105);
    expect(result.composite.percentile).toBe(62);
    expect(result.composite.scoringVersion).toBe(4);
  });

  test('should use AI equating table to convert aiV1P2 scores to composite sreScore', async () => {
    store.session.get = vi.fn(() => ({
      scoringVersion: 4,
      userMetadata: { ageMonths: 84 },
      taskId: 'sre',
    }));

    const scores = new RoarScores();
    const rawScores = {
      aiV1P2: {
        test: { numCorrect: 30, numIncorrect: 0 },
      },
    };

    const result = await scores.computedScoreCallback(rawScores);

    expect(scores.tableLoaded).toBe(true);
    expect(scores.aiTableLoaded).toBe(true);
    // aiV1P2 rawScore 30 -> equated sreScore 31 (from parallel table)
    expect(result.aiV1P2.sreScore).toBe(30);
    expect(result.composite.sreScore).toBe(31);
    expect(result.composite.standardScore).toBe(113);
    expect(result.composite.percentile).toBe(81);
    expect(result.composite.scoringVersion).toBe(4);
  });

  test('should prevent race condition when multiple concurrent calls request the same tables', async () => {
    store.session.get = vi.fn(() => ({
      scoringVersion: 4,
      userMetadata: { ageMonths: 85 },
      taskId: 'sre',
    }));

    const scores = new RoarScores();
    const rawScores = { lab: { test: { numCorrect: 15, numIncorrect: 0 } } };

    const promises = [
      scores.computedScoreCallback(rawScores),
      scores.computedScoreCallback(rawScores),
      scores.computedScoreCallback(rawScores),
    ];

    await Promise.all(promises);

    expect(papaParseSpy).toHaveBeenCalledTimes(2);
    expect(scores.tableLoaded).toBe(true);
    expect(scores.aiTableLoaded).toBe(true);
  });

  test('should continue scoring when table load fails', async () => {
    let callCount = 0;
    papaParseSpy.mockImplementation((input, config) => {
      if (config.download) {
        callCount++;

        // First attempt: fail both tables
        if (callCount <= 2) {
          setTimeout(() => {
            config.error(new Error('Simulated failure'));
          }, 100);
        } else {
          // Second attempt: succeed
          const csvContent = getCsvContent(input);
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

    store.session.get = vi.fn(() => ({
      scoringVersion: 4,
      userMetadata: { grade: 2, ageMonths: 84 },
      taskId: 'sre',
    }));

    const scores = new RoarScores();
    const rawScores = { lab: { test: { numCorrect: 25, numIncorrect: 0 } } };

    // First call should fail but continue without normed scores
    await scores.computedScoreCallback(rawScores);

    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(scores.tableLoaded).toBe(false);
    expect(scores.aiTableLoaded).toBe(false);

    // Second call should retry and succeed (both promises reset after error)
    const result2 = await scores.computedScoreCallback(rawScores);

    expect(scores.tableLoaded).toBe(true);
    expect(scores.aiTableLoaded).toBe(true);
    expect(result2.composite.sreScore).toBe(25);
    expect(result2.composite.standardScore).toBe(108);
    expect(result2.composite.percentile).toBe(70);
  });

  test('should not flood logs when partial table failure repeats with same error', async () => {
    papaParseSpy.mockImplementation((input, config) => {
      if (config.download) {
        const filename = input.split('/').pop();

        if (filename === 'sre_lookup_v4.csv') {
          // Main table always succeeds
          const csvContent = getCsvContent(input);
          setTimeout(() => {
            originalParse(csvContent, { ...config, download: false, complete: config.complete });
          }, 100);
        } else {
          // AI table always fails with the same error
          setTimeout(() => {
            config.error(new Error('AI table simulated failure'));
          }, 100);
        }
      } else {
        originalParse(input, config);
      }
    });

    store.session.get = vi.fn(() => ({
      scoringVersion: 4,
      userMetadata: { grade: 2, ageMonths: 84 },
      taskId: 'sre',
    }));

    const scores = new RoarScores();
    const rawScores = { lab: { test: { numCorrect: 25, numIncorrect: 0 } } };

    // First call: partial failure — should log once
    await scores.computedScoreCallback(rawScores);
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);

    // Second and third calls: same error — should NOT log again
    await scores.computedScoreCallback(rawScores);
    await scores.computedScoreCallback(rawScores);
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
  });

  test('should only retry failed table when one succeeds', async () => {
    let mainTableCalls = 0;
    let aiTableCalls = 0;

    papaParseSpy.mockImplementation((input, config) => {
      if (config.download) {
        const filename = input.split('/').pop();

        if (filename === 'sre_lookup_v4.csv') {
          mainTableCalls++;
          // Main table succeeds on first call
          const csvContent = getCsvContent(input);
          setTimeout(() => {
            originalParse(csvContent, {
              ...config,
              download: false,
              complete: config.complete,
            });
          }, 100);
        } else if (filename === 'sre_parallel_equating_lookup.csv') {
          aiTableCalls++;
          // AI table fails first time, succeeds second time
          if (aiTableCalls === 1) {
            setTimeout(() => {
              config.error(new Error('AI table simulated failure'));
            }, 100);
          } else {
            const csvContent = getCsvContent(input);
            setTimeout(() => {
              originalParse(csvContent, {
                ...config,
                download: false,
                complete: config.complete,
              });
            }, 100);
          }
        }
      } else {
        originalParse(input, config);
      }
    });

    store.session.get = vi.fn(() => ({
      scoringVersion: 4,
      userMetadata: { grade: 2, ageMonths: 84 },
      taskId: 'sre',
    }));

    const scores = new RoarScores();
    const rawScores = { lab: { test: { numCorrect: 25, numIncorrect: 0 } } };

    // First call: main table succeeds, AI table fails
    await scores.computedScoreCallback(rawScores);

    expect(scores.tableLoaded).toBe(true);
    expect(scores.aiTableLoaded).toBe(false);
    expect(mainTableCalls).toBe(1);
    expect(aiTableCalls).toBe(1);

    // Second call: only AI table should retry (main table already loaded)
    const result2 = await scores.computedScoreCallback(rawScores);

    expect(scores.tableLoaded).toBe(true);
    expect(scores.aiTableLoaded).toBe(true);
    expect(mainTableCalls).toBe(1); // Main table NOT called again
    expect(aiTableCalls).toBe(2); // AI table retried
    expect(result2.composite.sreScore).toBe(25);
    expect(result2.composite.standardScore).toBe(108);
    expect(result2.composite.percentile).toBe(70);
  });

  test('should handle 90s2BlocksFixedForms mode for English SRE', async () => {
    store.session.get = vi.fn(() => ({
      userMetadata: { ageMonths: 85 },
      taskId: 'sre',
      userMode: '90s2BlocksFixedForms',
      scoringVersion: 4, // 90s2BlocksFixedForms defaults to v4 in initConfig
    }));

    const scores = new RoarScores();
    const rawScores = {
      fixedForm1: { test: { numCorrect: 25, numIncorrect: 5 } },
      fixedForm2: { test: { numCorrect: 22, numIncorrect: 8 } },
    };

    const result = await scores.computedScoreCallback(rawScores);

    // Verify all tables loaded including fixed form equating table
    expect(scores.tableLoaded).toBe(true);
    expect(scores.aiTableLoaded).toBe(true);
    expect(scores.fixedFormEquatingTableLoaded).toBe(true);

    // Verify individual form scores are preserved (raw scores)
    expect(result.fixedForm1.sreScore).toBe(20); // 25 - 5
    expect(result.fixedForm2.sreScore).toBe(14); // 22 - 8

    // Verify composite score uses fixed form equating from sre_parallel_90s_form_equating_lookup.csv
    // fixedForm1 rawScore 20 -> equated 37, fixedForm2 rawScore 14 -> equated 28
    // Composite is ceiling of average: Math.ceil((37 + 28) / 2) = 33
    expect(result.composite.sreScore).toBe(33);
    // From sre_lookup_v4.csv: ageMonths 85, sreScore 33 -> standardScore 114, percentile 83
    expect(result.composite.standardScore).toBe(114);
    expect(result.composite.percentile).toBe(83);
  });

  test('should not use 90s2BlocksFixedForms logic for non-SRE tasks', async () => {
    store.session.get = vi.fn(() => ({
      scoringVersion: 1,
      userMetadata: { ageMonths: 85 },
      taskId: 'sre-es',
      userMode: '90s2BlocksFixedForms',
    }));

    const scores = new RoarScores();
    const rawScores = {
      subtest1: { test: { numCorrect: 15, numIncorrect: 5 } },
      subtest2: { test: { numCorrect: 12, numIncorrect: 3 } },
    };

    const result = await scores.computedScoreCallback(rawScores);

    // For sre-es, should use sum logic, not fixed form equating
    expect(result.composite.sreScore).toBe(19); // (15-5) + (12-3)
  });

  test('should gracefully degrade when fixed form equating table fails to load', async () => {
    // Mock Papa.parse to fail for fixed form equating table and AI table
    papaParseSpy.mockImplementation((input, config) => {
      if (config.download) {
        const filename = input.split('/').pop();

        // Main table succeeds
        if (filename === 'sre_lookup_v4.csv') {
          const csvContent = getCsvContent(input);
          setTimeout(() => {
            originalParse(csvContent, {
              ...config,
              download: false,
              complete: config.complete,
            });
          }, 100);
        }
        // Fixed form equating table fails
        else if (filename === 'sre_parallel_90s_form_equating_lookup.csv') {
          setTimeout(() => {
            config.error(new Error('Failed to load fixed form equating table'));
          }, 100);
        }
        // AI table fails
        else if (filename === 'sre_parallel_equating_lookup.csv') {
          setTimeout(() => {
            config.error(new Error('Failed to load AI equating table'));
          }, 100);
        }
      } else {
        originalParse(input, config);
      }
    });

    store.session.get = vi.fn(() => ({
      userMetadata: { ageMonths: 85 },
      taskId: 'sre',
      userMode: '90s2BlocksFixedForms',
      scoringVersion: 4,
    }));

    const scores = new RoarScores();
    const rawScores = {
      fixedForm1: { test: { numCorrect: 25, numIncorrect: 5 } },
      fixedForm2: { test: { numCorrect: 22, numIncorrect: 8 } },
    };

    const result = await scores.computedScoreCallback(rawScores);

    // Should still return raw subtask scores
    expect(result.fixedForm1.sreScore).toBe(20); // 25 - 5
    expect(result.fixedForm2.sreScore).toBe(14); // 22 - 8

    // Composite is not set when fixed form equating fails (no fallback)
    expect(result.composite).toBeUndefined();

    // Tables should reflect failure state
    expect(scores.tableLoaded).toBe(true); // Main table loaded
    expect(scores.aiTableLoaded).toBe(false); // AI table failed
    expect(scores.fixedFormEquatingTableLoaded).toBe(false); // Fixed form table failed

    // Should have logged errors
    expect(consoleErrorSpy).toHaveBeenCalled();
  });
});
