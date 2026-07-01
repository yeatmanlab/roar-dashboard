import { describe, it, expect, beforeEach, vi } from 'vitest';
import store from 'store2';
import { RoarScores } from './scores';

// Stub store2, roar-utils, papaparse, the experiment harness, and the schema constants so the
// test exercises the REAL RoarScores computation and the REAL @roar-platform/scoring-tables
// selectNormRow lookup (not mocked) — a regression guard that migrating Letter's norm lookup
// onto the shared utility did not change the normed scores it attaches.

// store2's `session` is callable (`store.session(key)`) AND has `.get`/`.set`.
vi.mock('store2', () => {
  const data = {};
  const session = (key, value) => {
    if (value === undefined) return data[key];
    data[key] = value;
    return value;
  };
  session.get = (key) => data[key];
  session.set = (key, value) => {
    data[key] = value;
  };
  session.__reset = () => {
    for (const k of Object.keys(data)) delete data[k];
  };
  return { default: { session } };
});

vi.mock('@bdelab/roar-utils', () => ({ getGrade: vi.fn(() => 2) }));

vi.mock('papaparse', () => {
  const parse = vi.fn();
  return { parse, default: { parse } };
});

// Identity scaleTheta so the scaled thetaEstimate equals the raw clowder theta.
vi.mock('./experimentSetup', () => ({
  clowder: {
    theta: { composite: 1.5, composite_foundational: 1.5 },
    seMeasurement: { composite: 0.2, composite_foundational: 0.2 },
  },
  scaleTheta: (raw, se) => [raw, se],
}));
vi.mock('./helperFunctions', () => ({ makeFinite: (x) => x }));
vi.mock('./trials/stimulusLetterName', () => ({ getItemGroupStats: () => ({}) }));

vi.mock('@roar-platform/assessment-schema/roar-letter', () => ({
  LETTER_TASK_IDS: { EN: 'letter' },
  PHONICS_TASK_IDS: { EN: 'phonics' },
  LETTER_SCORE_TABLE_URL: (version) => `https://example.test/letter_v${version}.csv`,
}));
vi.mock('@roar-platform/assessment-schema', () => ({
  COMPOSITE_DOMAIN: 'composite',
  COMPOSITE_FOUNDATIONAL_DOMAIN: 'composite_foundational',
}));

const seedSession = (config) => {
  store.session.set('config', config);
  // Item lists read during the EN subtask mapping (each is `.join(',')`-ed).
  for (const key of [
    'lowerCorrectItems',
    'lowerIncorrectItems',
    'upperCorrectItems',
    'upperIncorrectItems',
    'phonemeCorrectItems',
    'phonemeIncorrectItems',
  ]) {
    store.session.set(key, []);
  }
  store.session.set('totalCorrect', 10);
  store.session.set('trialNumTotal', 12);
  store.session.set('totalPercentCorrect', 83);
};

beforeEach(() => {
  store.session.__reset();
});

describe('RoarScores.computedScoreCallback (Letter norm lookup via shared utility)', () => {
  it('returns null for a non-letter/phonics task', async () => {
    seedSession({ scoringVersion: 2, taskId: 'letter-es', userMetadata: { grade: '2', ageMonths: 96 } });
    const result = await new RoarScores().computedScoreCallback({
      total: { test: { numCorrect: 1, numAttempted: 1 } },
    });
    expect(result).toBeNull();
  });

  it('selects the norm row by age + theta@0.1 and merges the normed columns, unchanged by the migration', async () => {
    seedSession({ scoringVersion: 2, taskId: 'letter', userMetadata: { grade: '2', ageMonths: 96 } });

    const scores = new RoarScores();
    scores.tableLoaded = true; // short-circuit initTable; supply the table + ageForScore directly
    scores.ageForScore = 96;
    // clowder composite theta = 1.5 (identity scaleTheta) → matches the 1.5 row.
    scores.lookupTable = [
      { ageMonths: 96, thetaEstimate: 1.4, percentile: 40, standardScore: 96 },
      { ageMonths: 96, thetaEstimate: 1.5, percentile: 60, standardScore: 105 },
    ];

    const result = await scores.computedScoreCallback({
      total: { test: { numCorrect: 10, numAttempted: 12 } },
    });

    expect(result.composite).toMatchObject({ percentile: 60, standardScore: 105 });
  });
});
