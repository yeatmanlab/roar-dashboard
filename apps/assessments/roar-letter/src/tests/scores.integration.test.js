import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest';
import { RoarScores } from '../experiment/scores.js';
import { toLetterScoreEntries, LETTER_COMPOSITE_SCORE_NAMES } from '@roar-platform/assessment-schema/roar-letter';
import fs from 'fs';
import path from 'path';
import papaparse from 'papaparse';
import { fileURLToPath } from 'url';

vi.mock('@bdelab/roar-utils', () => ({
  getGrade: () => 3,
}));

// scaleTheta is mocked as identity so the CSV lookup uses the raw theta value without
// scaling — this keeps fixture values simple and avoids hyperParam coupling in tests.
const mockClowder = vi.hoisted(() => ({
  theta: { composite: 0, composite_foundational: 0 },
  seMeasurement: { composite: 1, composite_foundational: 1 },
}));

vi.mock('../experiment/experimentSetup', () => ({
  clowder: mockClowder,
  scaleTheta: (raw, se) => [raw, se],
}));

vi.mock('../experiment/helperFunctions', () => ({
  makeFinite: (x) => x,
}));

vi.mock('../experiment/trials/stimulusLetterName', () => ({
  getItemGroupStats: vi.fn(() => ({ correct: 0, attempted: 0 })),
}));

const sessionStore = vi.hoisted(() => ({}));

vi.mock('store2', () => {
  const session = vi.fn((key) => sessionStore[key]);
  session.get = vi.fn((key) => sessionStore[key]);
  return { default: { session } };
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const getCsvContent = (input) => {
  const filename = input.split('/').pop();
  const csvPath = path.join(__dirname, '__fixtures__', filename);
  return fs.readFileSync(csvPath, 'utf-8');
};

// Minimal letter raw scores: two subtasks with test-phase trial data.
const LETTER_RAW_SCORES = {
  LowercaseNames: { test: { numCorrect: 8, numIncorrect: 2, numAttempted: 10 } },
  UppercaseNames: { test: { numCorrect: 7, numIncorrect: 3, numAttempted: 10 } },
};

describe('RoarScores Integration Tests', () => {
  let papaParseSpy;
  let consoleErrorSpy;
  const originalParse = papaparse.parse;

  beforeEach(() => {
    // Reset sessionStore to clean letter-en defaults before each test.
    for (const key of Object.keys(sessionStore)) delete sessionStore[key];
    Object.assign(sessionStore, {
      config: {
        task: 'letter',
        taskId: 'letter',
        scoringVersion: 1,
        userMetadata: { ageMonths: 72 },
      },
      lowerCorrectItems: [],
      lowerIncorrectItems: [],
      upperCorrectItems: [],
      upperIncorrectItems: [],
      phonemeCorrectItems: [],
      phonemeIncorrectItems: [],
      totalCorrect: 5,
      totalPercentCorrect: 50,
      trialNumTotal: 10,
    });

    // Reset clowder to neutral values.
    mockClowder.theta.composite = 0;
    mockClowder.theta.composite_foundational = 0;
    mockClowder.seMeasurement.composite = 1;
    mockClowder.seMeasurement.composite_foundational = 1;

    papaParseSpy = vi.spyOn(papaparse, 'parse');
    papaParseSpy.mockImplementation((input, config) => {
      if (config.download) {
        const csvContent = getCsvContent(input);
        if (config.complete) {
          setTimeout(() => {
            originalParse(csvContent, { ...config, download: false, complete: config.complete });
          }, 100);
        }
      } else {
        originalParse(input, config);
      }
    });

    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    papaParseSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  test('should load and parse CSV lookup table for given age', async () => {
    const scores = new RoarScores();

    await scores.initTable();

    expect(papaParseSpy).toHaveBeenCalledWith(
      'https://storage.googleapis.com/roar-ak/scores/letter_lookup_v1.csv',
      expect.anything(),
    );
    expect(scores.tableLoaded).toBe(true);
    expect(scores.lookupTable.length).toBeGreaterThan(0);
    expect(scores.lookupTable.every((row) => row.ageMonths === 72)).toBe(true);
  });

  test('should return v1 normed scores for given theta and age', async () => {
    mockClowder.theta.composite = -1.0;

    const scores = new RoarScores();
    const result = await scores.computedScoreCallback(LETTER_RAW_SCORES);

    expect(result.composite.thetaEstimateRaw).toBe(-1.0);
    expect(result.composite.thetaEstimate).toBe(-1.0);
    expect(result.composite.roarScore).toBe(430);
    expect(result.composite.standardScore).toBe(95);
    expect(result.composite.percentile).toBe(37);
    expect(result.composite.scoringVersion).toBe(1);
  });

  test('should populate composite_foundational with theta estimates', async () => {
    mockClowder.theta.composite = -1.0;
    mockClowder.theta.composite_foundational = -1.0;
    mockClowder.seMeasurement.composite_foundational = 0.8;

    const scores = new RoarScores();
    const result = await scores.computedScoreCallback(LETTER_RAW_SCORES);

    expect(result.composite_foundational.thetaEstimateRaw).toBe(-1.0);
    expect(result.composite_foundational.thetaEstimate).toBe(-1.0);
    expect(result.composite_foundational.thetaSERaw).toBe(0.8);
    expect(result.composite_foundational.roarScoreKind).toBe('scaled_irt');
    expect(result.composite_foundational.scoringVersion).toBe(1);
  });

  test('should clamp age to minimum (60 months) when age is below ageMin', async () => {
    sessionStore.config.userMetadata = { ageMonths: 40 };

    const scores = new RoarScores();
    await scores.initTable();

    expect(scores.ageForScore).toBe(60);
  });

  test('should clamp age to maximum (96 months) when age is above ageMax', async () => {
    sessionStore.config.userMetadata = { ageMonths: 120 };

    const scores = new RoarScores();
    await scores.initTable();

    expect(scores.ageForScore).toBe(96);
  });

  test('should prevent race condition when multiple concurrent calls request the same table', async () => {
    mockClowder.theta.composite = 0.5;

    const scores = new RoarScores();

    await Promise.all([
      scores.computedScoreCallback(LETTER_RAW_SCORES),
      scores.computedScoreCallback(LETTER_RAW_SCORES),
      scores.computedScoreCallback(LETTER_RAW_SCORES),
    ]);

    expect(papaParseSpy).toHaveBeenCalledTimes(1);
    expect(scores.tableLoaded).toBe(true);
  });

  test('should compute theta without normed scores after failed load, then succeed on retry', async () => {
    let hasFailed = false;

    papaParseSpy.mockImplementation((input, config) => {
      if (hasFailed) {
        const csvContent = getCsvContent(input);
        if (config.complete) {
          originalParse(csvContent, { ...config, download: false, complete: config.complete });
        }
      } else {
        hasFailed = true;
        setTimeout(() => {
          config.error(new Error('Simulated download failure'));
        }, 100);
      }
    });

    mockClowder.theta.composite = -1.0;
    const scores = new RoarScores();

    // First call — table load fails; result has theta but no normed scores.
    const resultA = await scores.computedScoreCallback(LETTER_RAW_SCORES);

    expect(scores.tableLoaded).toBe(false);
    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(resultA.composite.thetaEstimate).toBe(-1.0);
    expect(resultA.composite.roarScore).toBeUndefined();

    // Second call — retries and succeeds.
    mockClowder.theta.composite = 0.5;
    const resultB = await scores.computedScoreCallback(LETTER_RAW_SCORES);

    expect(scores.tableLoaded).toBe(true);
    expect(resultB.composite.thetaEstimate).toBe(0.5);
    expect(resultB.composite.roarScore).toBe(535);
    expect(resultB.composite.standardScore).toBe(105);
    expect(papaParseSpy).toHaveBeenCalledTimes(2);
  });

  test('should return null for non-English letter tasks (letter-es, letter-en-ca)', async () => {
    sessionStore.config = {
      task: 'letter',
      taskId: 'letter-es',
      scoringVersion: 1,
      userMetadata: { ageMonths: 72 },
    };

    const scores = new RoarScores();
    const result = await scores.computedScoreCallback({});

    expect(result).toBeNull();
    expect(papaParseSpy).not.toHaveBeenCalled();
  });

  test('should join subtask item arrays as comma-separated strings', async () => {
    sessionStore.lowerCorrectItems = ['a', 'b', 'c'];
    sessionStore.lowerIncorrectItems = ['d'];
    sessionStore.upperCorrectItems = ['A', 'B'];
    sessionStore.upperIncorrectItems = [];

    mockClowder.theta.composite = 0;
    const scores = new RoarScores();
    const result = await scores.computedScoreCallback(LETTER_RAW_SCORES);

    expect(result.LowercaseNames.lowerCorrect).toBe('a,b,c');
    expect(result.LowercaseNames.lowerIncorrect).toBe('d');
    expect(result.LowercaseNames.upperCorrect).toBe('A,B');
    expect(result.LowercaseNames.upperIncorrect).toBe('');
  });

  test('toLetterScoreEntries on real callback output produces valid entries with no empty values', async () => {
    mockClowder.theta.composite = -1.0;
    mockClowder.theta.composite_foundational = -1.0;

    const scores = new RoarScores();
    const computed = await scores.computedScoreCallback(LETTER_RAW_SCORES);
    const entries = toLetterScoreEntries(computed);

    // No entry should have an empty string value — the empty-string guard must hold.
    expect(entries.every((e) => e.value !== '')).toBe(true);

    // Composite domain: theta raw/computed pair, normed scores from CSV lookup.
    expect(entries).toContainEqual(
      expect.objectContaining({ name: LETTER_COMPOSITE_SCORE_NAMES.THETA_ESTIMATE_RAW, type: 'raw', value: '-1' }),
    );
    expect(entries).toContainEqual(
      expect.objectContaining({ name: LETTER_COMPOSITE_SCORE_NAMES.THETA_ESTIMATE, type: 'computed', value: '-1' }),
    );
    expect(entries).toContainEqual(
      expect.objectContaining({ name: LETTER_COMPOSITE_SCORE_NAMES.ROAR_SCORE, type: 'computed', value: '430' }),
    );
    expect(entries).toContainEqual(
      expect.objectContaining({ name: LETTER_COMPOSITE_SCORE_NAMES.TOTAL_CORRECT, type: 'raw', value: '5' }),
    );

    // Subtask domain: subScore should appear, but empty item lists should not.
    expect(entries).toContainEqual(
      expect.objectContaining({ name: 'subScore', domain: 'LowercaseNames', type: 'computed' }),
    );
    expect(entries.some((e) => e.name === 'lowerCorrect')).toBe(false);
  });

  test('should handle missing userMetadata gracefully', async () => {
    sessionStore.config = {
      task: 'letter',
      taskId: 'letter',
      scoringVersion: 1,
    };

    mockClowder.theta.composite = 0.5;
    const scores = new RoarScores();
    const result = await scores.computedScoreCallback(LETTER_RAW_SCORES);

    // No age available → no norm table load, no normed scores.
    expect(result.composite.thetaEstimate).toBe(0.5);
    expect(result.composite.roarScore).toBeUndefined();
    expect(result.composite.percentile).toBeUndefined();
    expect(papaParseSpy).not.toHaveBeenCalled();
  });
});
