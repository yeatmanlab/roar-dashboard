import { describe, it, expect, beforeEach, vi } from 'vitest';
import store from 'store2';
import { getGrade } from '@bdelab/roar-utils';
import * as Papa from 'papaparse';
import { pa } from '@roar-platform/assessment-schema';
import { RoarScores } from './scores';

// --- Mocks -------------------------------------------------------------------
// scores.js depends on store2 (session state), @bdelab/roar-utils (getGrade),
// papaparse (lookup-table download) and the schema constants. We stub those so the
// tests exercise the REAL RoarScores computation — they are NOT a re-implementation.

// store2: back the session with a plain object we can seed per test.
vi.mock('store2', () => {
  const session = {};
  return {
    default: {
      session: {
        get: (key) => session[key],
        set: (key, value) => {
          session[key] = value;
        },
        __reset: () => {
          for (const k of Object.keys(session)) delete session[k];
        },
      },
    },
  };
});

vi.mock('@bdelab/roar-utils', () => ({ getGrade: vi.fn() }));

// Single shared parse mock so the test and scores.js see the same fn.
vi.mock('papaparse', () => {
  const parse = vi.fn();
  return { parse, default: { parse } };
});

// Mirror of packages/assessment-schema/src/roar-pa/{config,trial-types}.ts. Stubbed
// (rather than imported) because the built dist can be stale and the src entry pulls
// in firebase-emulator; these constant values are stable and asserted via the same import.
vi.mock('@roar-platform/assessment-schema', () => ({
  COMPOSITE_DOMAIN: 'composite',
  pa: {
    PA_TASK_ID: 'pa',
    PA_SCORING_VERSION: { V3_FIXED: 3, V4_ADAPTIVE: 4, V5_ADAPTIVE: 5 },
    PA_SCORE_KIND: { RAW_TOTAL_CORRECT: 'raw_total_correct', SCALED_IRT: 'scaled_irt' },
    PA_COMPOSITE: 'composite',
    PA_COMPOSITE_FOUNDATIONAL: 'composite_foundational',
    PA_SCORE_TABLE_URL: (version) => `https://example.test/pa-score-table-${version}.csv`,
  },
}));

const { PA_TASK_ID, PA_SCORING_VERSION, PA_SCORE_KIND } = pa;

const setSession = ({ config, thetas, thetaSEs }) => {
  store.session.set('config', config);
  if (thetas) store.session.set('thetas', thetas);
  if (thetaSEs) store.session.set('thetaSEs', thetaSEs);
};

beforeEach(() => {
  store.session.__reset();
  vi.mocked(getGrade).mockReset();
  vi.mocked(Papa.parse).mockReset();
});

// --- Scoring math ------------------------------------------------------------
describe('RoarScores.computedScoreCallback', () => {
  it('returns null for a non-PA task (taskId guard)', async () => {
    setSession({ config: { scoringVersion: PA_SCORING_VERSION.V3_FIXED, taskId: 'swr' } });
    const result = await new RoarScores().computedScoreCallback({
      fsm: { test: { numCorrect: 3, numAttempted: 5 } },
    });
    expect(result).toBeNull();
  });

  it('fixed scoring (v3): roarScore = numCorrect, percentCorrect computed, no theta', async () => {
    setSession({ config: { scoringVersion: PA_SCORING_VERSION.V3_FIXED, taskId: PA_TASK_ID } });
    const result = await new RoarScores().computedScoreCallback({
      fsm: { test: { numCorrect: 8, numAttempted: 10 } },
      lsm: { test: { numCorrect: 6, numAttempted: 10 } },
    });
    expect(result.fsm).toMatchObject({
      roarScore: 8,
      numCorrect: 8,
      numAttempted: 10,
      percentCorrect: 80,
      roarScoreKind: PA_SCORE_KIND.RAW_TOTAL_CORRECT,
      scoringVersion: PA_SCORING_VERSION.V3_FIXED,
    });
    expect(result.lsm.percentCorrect).toBe(60);
    expect(result.fsm.thetaEstimate).toBeUndefined();
    // Composite raw counts = sum across subtasks (numCorrect 8+6, numAttempted 10+10).
    expect(result.composite).toMatchObject({ numCorrect: 14, numAttempted: 20 });
  });

  it('adaptive scoring (v5): attaches per-subtask thetas; composite uses scaled, composite_foundational its own', async () => {
    setSession({
      config: { scoringVersion: PA_SCORING_VERSION.V5_ADAPTIVE, taskId: PA_TASK_ID },
      thetas: { fsm: 0.5, scaled: 0.65, composite: 0.6, composite_foundational: -1.1 },
      thetaSEs: { fsm: 0.2, scaled: 0.15, composite: 0.16, composite_foundational: 0.3 },
    });
    const result = await new RoarScores().computedScoreCallback({
      fsm: { test: { numCorrect: 8, numAttempted: 10 } },
    });
    expect(result.fsm).toMatchObject({ thetaEstimate: 0.5, thetaSE: 0.2 });
    expect(result.fsm.roarScore).toBeUndefined(); // adaptive → no raw roarScore on subtasks
    expect(result.composite).toMatchObject({ thetaEstimate: 0.65, thetaEstimateRaw: 0.6 });
    expect(result.composite_foundational).toMatchObject({ thetaEstimate: -1.1, thetaSE: 0.3 });
  });

  it('merges normed lookup scores AND spreads composite_foundational into composite', async () => {
    setSession({
      config: {
        scoringVersion: PA_SCORING_VERSION.V3_FIXED,
        taskId: PA_TASK_ID,
        userMetadata: { grade: '2', ageMonths: 96 },
      },
    });
    vi.mocked(getGrade).mockReturnValue(2); // grade < 6 → lookup by ageForScore + totalScore

    const scores = new RoarScores();
    scores.tableLoaded = true; // short-circuit initTable; supply the table directly
    scores.ageForScore = 96;
    scores.lookupTable = [{ ageMonths: 96, roarScore: 14, percentile: 55, standardScore: 102 }];

    const result = await scores.computedScoreCallback({
      fsm: { test: { numCorrect: 8, numAttempted: 10 } }, // roarScore 8
      lsm: { test: { numCorrect: 6, numAttempted: 10 } }, // roarScore 6 → total 14
      composite: { test: { numCorrect: 1, numAttempted: 1 } },
      composite_foundational: { test: { numCorrect: 9, numAttempted: 9 } },
    });

    expect(result.composite).toMatchObject({ percentile: 55, standardScore: 102 });
    // Pins the `...computedScores.composite_foundational` merge: composite inherits the
    // foundational numCorrect (9), overriding the value it holds at that point (14, the
    // subtask sum 8+6 — the raw composite.test input of 1 was already replaced by the
    // composite-count step). This is a surprising side-effect worth confirming is intended —
    // exactly what this regression test exists to catch.
    expect(result.composite.numCorrect).toBe(9);
  });
});

// --- initTable race-condition handling (commit 09ce3f7c) ---------------------
describe('RoarScores.initTable (race condition)', () => {
  const adaptiveConfig = {
    scoringVersion: PA_SCORING_VERSION.V4_ADAPTIVE,
    taskId: PA_TASK_ID,
    userMetadata: { grade: '2', ageMonths: 96 },
  };

  it('dedups concurrent loads into a single parse and shares one promise', async () => {
    setSession({ config: adaptiveConfig });
    vi.mocked(getGrade).mockReturnValue(2);
    let captured;
    vi.mocked(Papa.parse).mockImplementation((_url, cfg) => {
      captured = cfg;
    });

    const scores = new RoarScores();
    const p1 = scores.initTable();
    const p2 = scores.initTable();

    expect(Papa.parse).toHaveBeenCalledTimes(1); // one network request despite two concurrent calls

    captured.complete();
    await expect(p1).resolves.toBeUndefined();
    await expect(p2).resolves.toBeUndefined(); // the second caller resolves off the same load
    expect(scores.tableLoaded).toBe(true);
    expect(scores.tableLoadingPromise).toBeNull();
  });

  it('short-circuits when the table is already loaded (no parse)', async () => {
    setSession({ config: adaptiveConfig });
    const scores = new RoarScores();
    scores.tableLoaded = true;

    await expect(scores.initTable()).resolves.toBeUndefined();
    expect(Papa.parse).not.toHaveBeenCalled();
  });

  it('on parse error: rejects, resets lookupTable, and clears the loading promise so a retry can start fresh', async () => {
    setSession({ config: adaptiveConfig });
    vi.mocked(getGrade).mockReturnValue(2);
    let captured;
    vi.mocked(Papa.parse).mockImplementation((_url, cfg) => {
      captured = cfg;
    });

    const scores = new RoarScores();
    scores.lookupTable = [{ stale: true }];
    const p = scores.initTable();
    captured.error(new Error('network down'));

    await expect(p).rejects.toThrow('network down');
    expect(scores.lookupTable).toEqual([]);
    expect(scores.tableLoadingPromise).toBeNull();
    expect(scores.tableLoaded).toBe(false);
  });

  it('computedScoreCallback swallows a table-load error and still returns scores', async () => {
    setSession({ config: { ...adaptiveConfig, scoringVersion: PA_SCORING_VERSION.V3_FIXED } });
    vi.mocked(getGrade).mockReturnValue(2);
    vi.mocked(Papa.parse).mockImplementation((_url, cfg) => {
      queueMicrotask(() => cfg.error(new Error('boom'))); // network errors are async
    });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const scores = new RoarScores();
    const result = await scores.computedScoreCallback({
      fsm: { test: { numCorrect: 8, numAttempted: 10 } },
    });

    expect(result).toBeDefined(); // did not throw
    expect(result.fsm).toMatchObject({ roarScore: 8 });
    expect(result.composite?.percentile).toBeUndefined(); // table failed → no normed merge
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });
});
