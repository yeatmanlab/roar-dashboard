import { vi, describe, test, expect, beforeEach } from 'vitest';
import { AssessmentStage } from '@roar-platform/assessment-schema';
import { toRoavAppsScoreEntries } from '@roar-platform/assessment-schema/roav-apps';

// getFirekitCompat returns the facade object that wireScoreAdapter mutates — capture a fresh
// plain object per test so we can drive the hooks it installs. toRoavAppsScoreEntries is the
// real (pure) adapter; only the SDK compat is mocked.
const mockGetFirekitCompat = vi.hoisted(() => vi.fn());
vi.mock('@roar-platform/assessment-sdk/compat/firekit', () => ({
  getFirekitCompat: mockGetFirekitCompat,
}));

import { wireScoreAdapter } from './roav-apps-firekit-facade.js';

const COMPOSITE = 'composite';
const { PRACTICE, TEST } = AssessmentStage;

describe('wireScoreAdapter', () => {
  let facade;

  beforeEach(() => {
    vi.clearAllMocks();
    facade = {};
    mockGetFirekitCompat.mockReturnValue(facade);
    wireScoreAdapter();
  });

  test('_getRawScores returns undefined before any trial is accumulated', () => {
    expect(facade._getRawScores()).toBeUndefined();
  });

  test('_accumulateRawScore increments numCorrect, numIncorrect, and numAttempted', () => {
    facade._accumulateRawScore(COMPOSITE, TEST, 1); // correct
    facade._accumulateRawScore(COMPOSITE, TEST, 0); // incorrect
    facade._accumulateRawScore(COMPOSITE, TEST, 1); // correct

    expect(facade._getRawScores()).toEqual({
      [COMPOSITE]: { [TEST]: { numCorrect: 2, numIncorrect: 1, numAttempted: 3 } },
    });
  });

  test('collapses `${stage}_response` variants into their base scoring bucket', () => {
    facade._accumulateRawScore(COMPOSITE, `${PRACTICE}_response`, 1);
    facade._accumulateRawScore(COMPOSITE, PRACTICE, 0);
    facade._accumulateRawScore(COMPOSITE, `${TEST}_response`, 1);

    const raw = facade._getRawScores();
    // practice + practice_response fold into the practice bucket
    expect(raw[COMPOSITE][PRACTICE]).toEqual({ numCorrect: 1, numIncorrect: 1, numAttempted: 2 });
    // test_response folds into the test bucket
    expect(raw[COMPOSITE][TEST]).toEqual({ numCorrect: 1, numIncorrect: 0, numAttempted: 1 });
    // no leftover `_response` keys
    expect(raw[COMPOSITE]).not.toHaveProperty(`${PRACTICE}_response`);
    expect(raw[COMPOSITE]).not.toHaveProperty(`${TEST}_response`);
  });

  test('an unmapped stage falls through to its raw key', () => {
    facade._accumulateRawScore(COMPOSITE, 'warmup', 1);
    expect(facade._getRawScores()[COMPOSITE]).toHaveProperty('warmup');
  });

  test('_getRawScores returns the { composite: { practice, test } } shape the adapter consumes', () => {
    facade._accumulateRawScore(COMPOSITE, PRACTICE, 1);
    facade._accumulateRawScore(COMPOSITE, TEST, 1);

    const raw = facade._getRawScores();
    expect(Object.keys(raw)).toEqual([COMPOSITE]);
    expect(Object.keys(raw[COMPOSITE]).sort()).toEqual([PRACTICE, TEST].sort());

    // The accumulated shape feeds toRoavAppsScoreEntries directly (composite domain, staged).
    const entries = toRoavAppsScoreEntries(raw);
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.every((e) => e.domain === COMPOSITE)).toBe(true);
  });

  test('_getRawScores returns a copy — mutating the result does not corrupt the accumulator', () => {
    facade._accumulateRawScore(COMPOSITE, TEST, 1);
    facade._getRawScores()[COMPOSITE][TEST].numCorrect = 999;
    expect(facade._getRawScores()[COMPOSITE][TEST].numCorrect).toBe(1);
  });

  test('_getScoreAdapter returns toRoavAppsScoreEntries', () => {
    expect(facade._getScoreAdapter()).toBe(toRoavAppsScoreEntries);
  });
});
