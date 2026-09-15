import { getFirekitCompat, makeLazyComputedCallback } from '@roar-platform/assessment-sdk/compat/firekit';
import { TRIAL_COUNT_SCORE_NAMES } from '@roar-platform/assessment-schema';
import { toMultichoiceScoreEntries } from '@roar-platform/assessment-schema/roar-multichoice';
import { RoarScores } from '../experiment/scores';

/**
 * Wires the multichoice score computation pipeline into the Firekit facade.
 *
 * Overrides the facade's three score hooks to accumulate per-stage counts for the
 * composite domain, convert computed scores to ScoreEntry[] for backend persistence,
 * and emit all domains on every trial.
 *
 * Must be called once during multichoice initialization, after initFirekitCompat and before
 * startRun.
 *
 * @returns {Function} computedScoreCallback — pass to writeTrial on each trial
 */
export function wireScoreAdapter() {
  const facade = getFirekitCompat();

  // Per-stage accumulator nested under 'composite'.
  // Multichoice has no named subtasks — the SDK always calls _accumulateRawScore with
  // subtask='composite' (the default fallback in writeTrial when trialData.subtask is absent).
  // Shape: { composite: { [stage]: { numCorrect, numIncorrect, numAttempted } } }
  const accumulator = { composite: {} };

  facade._accumulateRawScore = (_subtask, stage, correct) => {
    if (!accumulator.composite[stage]) {
      accumulator.composite[stage] = {
        [TRIAL_COUNT_SCORE_NAMES.NUM_CORRECT]: 0,
        [TRIAL_COUNT_SCORE_NAMES.NUM_INCORRECT]: 0,
        [TRIAL_COUNT_SCORE_NAMES.NUM_ATTEMPTED]: 0,
      };
    }
    if (correct === 1) {
      accumulator.composite[stage][TRIAL_COUNT_SCORE_NAMES.NUM_CORRECT]++;
    } else {
      accumulator.composite[stage][TRIAL_COUNT_SCORE_NAMES.NUM_INCORRECT]++;
    }
    accumulator.composite[stage][TRIAL_COUNT_SCORE_NAMES.NUM_ATTEMPTED] =
      accumulator.composite[stage][TRIAL_COUNT_SCORE_NAMES.NUM_CORRECT] +
      accumulator.composite[stage][TRIAL_COUNT_SCORE_NAMES.NUM_INCORRECT];
  };

  // Return undefined before the first trial to avoid triggering scoring prematurely.
  facade._getRawScores = () => (Object.keys(accumulator.composite).length > 0 ? { ...accumulator } : undefined);

  facade._getScoreAdapter = () => (computed) => toMultichoiceScoreEntries(computed);

  return makeLazyComputedCallback(RoarScores);
}
