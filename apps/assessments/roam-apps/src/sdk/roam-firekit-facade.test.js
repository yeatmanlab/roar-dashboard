import { vi, describe, test, expect, beforeEach } from 'vitest';
import { AssessmentStage } from '@roar-platform/assessment-schema';
import { toRoamFluencyScoreEntries, toRoamAlpacaScoreEntries } from '@roar-platform/assessment-schema/roam-apps';

// getFirekitCompat returns the facade object wireScoreAdapter mutates — capture a
// fresh plain object per test so we can drive the hooks it installs. store2 is mocked
// so we control the taskName _getScoreAdapter reads from config. The schema adapters
// are the real (pure) functions — only the SDK compat and the store are mocked.
const mockGetFirekitCompat = vi.hoisted(() => vi.fn());
const mockSessionGet = vi.hoisted(() => vi.fn());

vi.mock('@roar-platform/assessment-sdk/compat/firekit', () => ({
  getFirekitCompat: mockGetFirekitCompat,
}));
vi.mock('store2', () => ({
  default: { session: { get: mockSessionGet } },
}));

import { wireScoreAdapter } from './roam-firekit-facade.js';

const { PRACTICE, TEST } = AssessmentStage;

describe('wireScoreAdapter', () => {
  let facade;

  beforeEach(() => {
    vi.clearAllMocks();
    facade = {};
    mockGetFirekitCompat.mockReturnValue(facade);
    wireScoreAdapter();
  });

  describe('_accumulateRawScore / _getRawScores', () => {
    test('_getRawScores returns undefined before any trial is accumulated', () => {
      expect(facade._getRawScores()).toBeUndefined();
    });

    test('increments numCorrect/numIncorrect/numAttempted per subtask and stage', () => {
      facade._accumulateRawScore('addition', TEST, 1); // correct
      facade._accumulateRawScore('addition', TEST, 0); // incorrect
      facade._accumulateRawScore('addition', TEST, 1); // correct

      expect(facade._getRawScores()).toEqual({
        addition: { [TEST]: { numCorrect: 2, numIncorrect: 1, numAttempted: 3 } },
      });
    });

    test('collapses `${stage}_response` variants into their base scoring bucket', () => {
      facade._accumulateRawScore('geometry', `${PRACTICE}_response`, 1);
      facade._accumulateRawScore('geometry', PRACTICE, 0);
      facade._accumulateRawScore('geometry', `${TEST}_response`, 1);

      const raw = facade._getRawScores();
      // practice + practice_response fold into the practice bucket
      expect(raw.geometry[PRACTICE]).toEqual({ numCorrect: 1, numIncorrect: 1, numAttempted: 2 });
      // test_response folds into the test bucket
      expect(raw.geometry[TEST]).toEqual({ numCorrect: 1, numIncorrect: 0, numAttempted: 1 });
      expect(raw.geometry).not.toHaveProperty(`${PRACTICE}_response`);
      expect(raw.geometry).not.toHaveProperty(`${TEST}_response`);
    });

    test('accumulates multiple subtasks independently (roam keys by subtask, not just composite)', () => {
      facade._accumulateRawScore('addition', TEST, 1);
      facade._accumulateRawScore('subtraction', TEST, 0);

      const raw = facade._getRawScores();
      expect(Object.keys(raw).sort()).toEqual(['addition', 'subtraction']);
      expect(raw.addition[TEST].numCorrect).toBe(1);
      expect(raw.subtraction[TEST].numIncorrect).toBe(1);
    });

    test('_getRawScores returns a copy — mutating the result does not corrupt the accumulator', () => {
      facade._accumulateRawScore('addition', TEST, 1);
      facade._getRawScores().addition[TEST].numCorrect = 999;
      expect(facade._getRawScores().addition[TEST].numCorrect).toBe(1);
    });
  });

  describe('_getScoreAdapter task branch', () => {
    test('selects the roam-alpaca adapter when config.taskName is roam-alpaca', () => {
      mockSessionGet.mockReturnValue({ taskName: 'roam-alpaca' });
      const adapter = facade._getScoreAdapter();

      // 'geometry' is an alpaca subtask domain fluency doesn't recognize, so the
      // two adapters diverge on it — proving which one was selected.
      const computed = { geometry: { numCorrect: 5, numIncorrect: 1, numAttempted: 6 } };
      expect(adapter(computed)).toEqual(toRoamAlpacaScoreEntries(computed));
      expect(adapter(computed)).not.toEqual(toRoamFluencyScoreEntries(computed));
    });

    test.each(['fluency-arf', 'fluency-calf'])('selects the fluency adapter when config.taskName is %s', (taskName) => {
      mockSessionGet.mockReturnValue({ taskName });
      const adapter = facade._getScoreAdapter();

      // 'addition' is a fluency subtask domain alpaca doesn't recognize.
      const computed = { addition: { numCorrect: 5, numIncorrect: 1, numAttempted: 6 } };
      expect(adapter(computed)).toEqual(toRoamFluencyScoreEntries(computed));
      expect(adapter(computed)).not.toEqual(toRoamAlpacaScoreEntries(computed));
    });

    test('defaults to the fluency adapter when config/taskName is absent', () => {
      mockSessionGet.mockReturnValue(undefined);
      const adapter = facade._getScoreAdapter();

      const computed = { addition: { numCorrect: 3, numIncorrect: 0, numAttempted: 3 } };
      expect(adapter(computed)).toEqual(toRoamFluencyScoreEntries(computed));
    });

    test('reads taskName at call time, so a later config change picks a different adapter', () => {
      mockSessionGet.mockReturnValue({ taskName: 'fluency-arf' });
      const firstAdapter = facade._getScoreAdapter();
      const computed = { geometry: { numCorrect: 2, numIncorrect: 0, numAttempted: 2 } };
      // fluency doesn't recognize geometry → []
      expect(firstAdapter(computed)).toEqual([]);

      mockSessionGet.mockReturnValue({ taskName: 'roam-alpaca' });
      const secondAdapter = facade._getScoreAdapter();
      expect(secondAdapter(computed)).toEqual(toRoamAlpacaScoreEntries(computed));
    });
  });
});
