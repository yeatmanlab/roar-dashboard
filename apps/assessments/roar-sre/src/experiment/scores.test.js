import { describe, it, expect, beforeEach, vi } from 'vitest';
import store from 'store2';
import { RoarScores } from './scores';

// Stub store2, roar-utils, papaparse, and the schema constants so the test exercises the REAL
// RoarScores computation and the REAL @roar-platform/scoring-tables selectNormRow lookup (not
// mocked). This guards that migrating the norm lookup onto the shared utility did not change the
// normed scores SRE attaches.

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

vi.mock('@bdelab/roar-utils', () => ({ getGrade: vi.fn(() => 5) }));

vi.mock('papaparse', () => {
  const parse = vi.fn();
  return { parse, default: { parse } };
});

vi.mock('@roar-platform/assessment-schema', () => ({
  COMPOSITE_DOMAIN: 'composite',
  COMPOSITE_FOUNDATIONAL_DOMAIN: 'composite_foundational',
  PRACTICE_DOMAIN: 'practice',
  TRIAL_COUNT_SCORE_NAMES: { NUM_CORRECT: 'numCorrect', NUM_INCORRECT: 'numIncorrect' },
  domainToAssessmentStage: (domain) => (domain === 'practice' ? 'practice' : 'test'),
}));

vi.mock('@roar-platform/assessment-schema/roar-sre', () => ({
  SRE_COMPOSITE_FOUNDATIONAL_IRT_PARAMS: { TRANSFORMATION_SCALE: 1, TRANSFORMATION_SHIFT: 0 },
  SRE_SCORE_TABLE_URL: (taskId, version) => `https://example.test/${taskId}_v${version}.csv`,
  SRE_SCORING_VERSION: { V1: 1, V3: 3, V4: 4 },
  SRE_SUBTASK_DOMAINS: { LAB: 'lab', AI_V1_P1: 'aiV1P1', AI_V1_P2: 'aiV1P2' },
  SRE_TASK_IDS: { EN: 'sre', ES: 'sre-es' },
}));

const setSession = (config) => store.session.set('config', config);

beforeEach(() => {
  store.session.__reset();
});

describe('RoarScores.computedScoreCallback (SRE norm lookup via shared utility)', () => {
  it('returns null for a non-SRE task', async () => {
    setSession({ scoringVersion: 3, taskId: 'swr', userMode: 'default' });
    const result = await new RoarScores().computedScoreCallback({ lab: { test: { numCorrect: 1, numIncorrect: 0 } } });
    expect(result).toBeNull();
  });

  it('selects the norm row by sreScore (exact) and merges the normed columns, unchanged by the migration', async () => {
    setSession({ scoringVersion: 3, taskId: 'sre', userMode: 'default', userMetadata: { grade: '5' } });

    const scores = new RoarScores();
    // Short-circuit initTable: supply a pre-filtered (by grade/age) lookup table directly.
    scores.isValidForScoring = true;
    scores.tableLoaded = true;
    scores.aiTableLoaded = true;
    scores.lookupTable = [
      { sreScore: 9, tosrecSS: 92, tosrecPercentile: 30 },
      { sreScore: 10, tosrecSS: 95, tosrecPercentile: 40 },
    ];

    // lab sreScore = numCorrect - numIncorrect = 12 - 2 = 10 → composite, then norm lookup at 10.
    const result = await scores.computedScoreCallback({
      lab: { test: { numCorrect: 12, numIncorrect: 2 } },
    });

    expect(result.composite).toMatchObject({ sreScore: 10, tosrecSS: 95, tosrecPercentile: 40 });
  });

  it('attaches no normed columns when no row matches the composite sreScore', async () => {
    setSession({ scoringVersion: 3, taskId: 'sre', userMode: 'default', userMetadata: { grade: '5' } });

    const scores = new RoarScores();
    scores.isValidForScoring = true;
    scores.tableLoaded = true;
    scores.aiTableLoaded = true;
    scores.lookupTable = [{ sreScore: 99, tosrecSS: 130, tosrecPercentile: 99 }];

    const result = await scores.computedScoreCallback({
      lab: { test: { numCorrect: 12, numIncorrect: 2 } }, // sreScore 10, no row at 10
    });

    expect(result.composite.sreScore).toBe(10);
    expect(result.composite.tosrecSS).toBeUndefined();
  });
});
