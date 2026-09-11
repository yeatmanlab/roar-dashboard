import { describe, it, expect, beforeEach, vi } from 'vitest';
import store from 'store2';
import { scaleTheta } from './experimentSetup';
import { RoarScores } from './scores';

// --- Mocks -------------------------------------------------------------------
// scores.js depends on store2 (session state), @bdelab/roar-utils (getGrade),
// papaparse (lookup-table download), and ./experimentSetup (clowder + scaleTheta) /
// ./helperFunctions (clampPositive) for the adaptive IRT path. We stub those so the
// test exercises the REAL RoarScores computation — and crucially the REAL
// @roar-platform/scoring-tables selectNormRow lookup, which is NOT mocked. This is the
// regression guard that the migration onto the shared utility did not change the
// normed scores Multichoice attaches.

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

// scaleTheta is stubbed so the scaled theta (the lookup key) is deterministic; clowder
// only needs the theta/seMeasurement shape scores.js reads via optional chaining.
vi.mock('./experimentSetup', () => ({
  clowder: {
    theta: { core: 0.5, composite_comprehension: 0.4 },
    seMeasurement: { core: 0.2, composite_comprehension: 0.3 },
  },
  scaleTheta: vi.fn(),
}));

vi.mock('./helperFunctions', () => ({ clampPositive: (value) => value }));

const setSession = (config) => store.session.set('config', config);

beforeEach(() => {
  store.session.__reset();
  scaleTheta.mockReset();
});

describe('RoarScores.computedScoreCallback (Multichoice lookup via shared utility)', () => {
  it('merges the normed scores from the (ageMonths, theta@0.1) row, unchanged by the migration', async () => {
    setSession({ task: 'morphology', scoringVersion: '1', isAdaptive: true, userMetadata: { ageMonths: 96 } });
    // scaleTheta returns [thetaEstimate, thetaSE, comprehensionThetaEstimate, comprehensionThetaSE].
    scaleTheta.mockReturnValue([1.46, 0.2, 1.3, 0.3]);

    const scores = new RoarScores();
    scores.tableLoaded = true; // short-circuit initTable; supply the table + ageForScore directly
    scores.ageForScore = 96;
    scores.lookupTable = [
      { ageMonths: 96, thetaEstimate: 1.4, percentile: 40, standardScore: 95 },
      { ageMonths: 96, thetaEstimate: 1.5, percentile: 50, standardScore: 100, wjPercentile: 42 },
    ];

    // theta 1.46 rounds to 1.5 → matches the second row (the same rule the old `.find` used).
    const result = await scores.computedScoreCallback({
      total: { test: { numCorrect: 30, numAttempted: 40 } },
    });

    expect(result.composite).toMatchObject({
      thetaEstimate: 1.46,
      percentile: 50,
      standardScore: 100,
      wjPercentile: 42,
      scoringVersion: 1,
    });
    // The key columns are stripped, not leaked into the composite score.
    expect(result.composite.ageMonths).toBeUndefined();
    expect(result.composite.thetaEstimate).toBe(1.46);
  });

  it('attaches no normed scores when no row matches the theta (theta still written)', async () => {
    setSession({ task: 'morphology', scoringVersion: '1', isAdaptive: true, userMetadata: { ageMonths: 96 } });
    scaleTheta.mockReturnValue([9.9, 0.2, 1.3, 0.3]); // no row at theta 9.9

    const scores = new RoarScores();
    scores.tableLoaded = true;
    scores.ageForScore = 96;
    scores.lookupTable = [{ ageMonths: 96, thetaEstimate: 1.5, percentile: 50 }];

    const result = await scores.computedScoreCallback({
      total: { test: { numCorrect: 10, numAttempted: 40 } },
    });

    expect(result.composite.thetaEstimate).toBe(9.9);
    expect(result.composite.percentile).toBeUndefined();
  });

  it('does not run the lookup for non-adaptive tasks', async () => {
    setSession({ task: 'morphology', scoringVersion: '1', isAdaptive: false, userMetadata: { ageMonths: 96 } });

    const scores = new RoarScores();
    scores.tableLoaded = true;
    scores.ageForScore = 96;
    scores.lookupTable = [{ ageMonths: 96, thetaEstimate: 1.5, percentile: 50 }];

    const result = await scores.computedScoreCallback({
      total: { test: { numCorrect: 10, numAttempted: 40 } },
    });

    // Non-adaptive → no composite IRT block, so no lookup and no composite key.
    expect(result.composite).toBeUndefined();
    expect(result.total).toMatchObject({ subScore: 10, subPercentCorrect: 25 });
  });
});
