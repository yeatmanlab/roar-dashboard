import store from 'store2';
import { getFirekitCompat, makeLazyComputedCallback } from '@roar-platform/assessment-sdk/compat/firekit';
import { toLetterScoreEntries, toPhonicsScoreEntries } from '@roar-platform/assessment-schema/roar-letter';
import { RoarScores } from '../experiment/scores';

/**
 * Wires the letter/phonics score computation pipeline into the Firekit facade.
 *
 * Overrides three facade hooks to accumulate per-subtask, per-stage counts,
 * convert computed scores to ScoreEntry[] for backend persistence, and emit
 * all domains on every trial.
 *
 * Theta estimation is NOT accumulated here — scores.js reads theta directly
 * from the `clowder` export in experimentSetup.js (the same pattern as roar-swr).
 *
 * Must be called once during initialization, after initFirekitCompat and before
 * startRun (but strictly before any writeTrial call).
 *
 * @returns {Function} computedScoreCallback — pass to writeTrial on each trial
 *
 * @example
 * ```js
 * initFirekitCompat(ctx, { variantId, taskVersion });
 * const computedScoreCallback = wireScoreAdapter();
 * // later, in on_data_update:
 * writeTrial(data, computedScoreCallback);
 * ```
 */
export function wireScoreAdapter() {
  const facade = getFirekitCompat();

  // Per-subtask, per-stage accumulator.
  // Shape matches the input expected by RoarScores.computedScoreCallback:
  // { [subtask]: { [stage]: { numCorrect, numIncorrect, numAttempted } } }
  const accumulator = {};

  facade._accumulateRawScore = (subtask, stage, correct) => {
    if (!accumulator[subtask]) accumulator[subtask] = {};
    if (!accumulator[subtask][stage]) {
      accumulator[subtask][stage] = { numCorrect: 0, numIncorrect: 0, numAttempted: 0 };
    }
    if (correct === 1) {
      accumulator[subtask][stage].numCorrect++;
    } else {
      accumulator[subtask][stage].numIncorrect++;
    }
    accumulator[subtask][stage].numAttempted++;
  };

  // Return accumulated raw scores. Returns undefined until at least one trial is saved.
  facade._getRawScores = () => {
    return Object.keys(accumulator).length > 0 ? { ...accumulator } : undefined;
  };

  // Select the entry adapter based on which task is running.
  // task is read from config at call time so it reflects the actual running task.
  facade._getScoreAdapter = () => {
    const task = store.session.get('config')?.task ?? 'letter';
    return (computed) => (task === 'phonics' ? toPhonicsScoreEntries(computed) : toLetterScoreEntries(computed));
  };

  // Deferred instantiation — RoarScores reads store.session.get('config').scoringVersion
  // in its constructor, which is only available after initStore() runs.
  return makeLazyComputedCallback(RoarScores);
}
