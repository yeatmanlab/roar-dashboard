import { describe, it, expect, beforeEach, vi } from 'vitest';
import store from 'store2';
import { RoarScores } from './scores';

// --- Mocks -------------------------------------------------------------------
// scores.js depends on store2 (session state), @bdelab/roar-utils (getGrade),
// papaparse (lookup-table download), and the SWR_TASK_IDS schema constant. We stub
// those so the test exercises the REAL RoarScores computation — and crucially the
// REAL @roar-platform/scoring-tables selectNormRow lookup, which is NOT mocked. This
// is the regression guard that the migration onto the shared utility did not change
// the normed scores SWR attaches.

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

vi.mock('@bdelab/roar-utils', () => ({ getGrade: vi.fn(() => undefined) }));

vi.mock('papaparse', () => {
  const parse = vi.fn();
  return { parse, default: { parse } };
});

vi.mock('@roar-platform/assessment-schema/roar-swr', () => ({
  SWR_TASK_IDS: { SWR: 'swr', SWR_ES: 'swr-es' },
}));

const setSession = (config) => store.session.set('config', config);

beforeEach(() => {
  store.session.__reset();
});

describe('RoarScores.computedScoreCallback (SWR lookup via shared utility)', () => {
  it('returns null for a non-SWR task', async () => {
    setSession({ scoringVersion: '1', taskId: 'pa', userMetadata: { ageMonths: 96 } });
    const result = await new RoarScores().computedScoreCallback({ composite: { test: { thetaEstimate: 1.5 } } });
    expect(result).toBeNull();
  });

  it('merges the normed scores from the (ageMonths, theta@0.1) row, unchanged by the migration', async () => {
    setSession({ scoringVersion: '1', taskId: 'swr', userMetadata: { ageMonths: 96 } });

    const scores = new RoarScores();
    scores.tableLoaded = true; // short-circuit initTable; supply the table + ageForScore directly
    scores.ageForScore = 96;
    scores.lookupTable = [
      { ageMonths: 96, thetaEstimate: 1.4, percentile: 40, standardScore: 95 },
      { ageMonths: 96, thetaEstimate: 1.5, percentile: 50, standardScore: 100, wjPercentile: 42 },
    ];

    // theta 1.46 rounds to 1.5 → matches the second row (same rule the old `.find` used).
    const result = await scores.computedScoreCallback({
      composite: { test: { thetaEstimate: 1.46, thetaSE: 0.2, numCorrect: 30, numAttempted: 40 } },
    });

    expect(result.composite).toMatchObject({
      thetaEstimate: 1.46,
      percentile: 50,
      standardScore: 100,
      wjPercentile: 42,
      scoringVersion: 1,
    });
    // The key columns are stripped, not leaked into the computed score.
    expect(result.composite.ageMonths).toBeUndefined();
    // SWR mirrors composite → composite_foundational, so the normed scores propagate.
    expect(result.composite_foundational).toMatchObject({ percentile: 50, standardScore: 100 });
  });

  it('attaches no normed scores when no row matches the theta (theta still written)', async () => {
    setSession({ scoringVersion: '1', taskId: 'swr', userMetadata: { ageMonths: 96 } });

    const scores = new RoarScores();
    scores.tableLoaded = true;
    scores.ageForScore = 96;
    scores.lookupTable = [{ ageMonths: 96, thetaEstimate: 1.5, percentile: 50 }];

    const result = await scores.computedScoreCallback({
      composite: { test: { thetaEstimate: 9.9, thetaSE: 0.2 } }, // no row at theta 9.9
    });

    expect(result.composite.thetaEstimate).toBe(9.9);
    expect(result.composite.percentile).toBeUndefined();
  });
});
