import { getFirekitCompat, makeLazyComputedCallback } from '@roar-platform/assessment-sdk/compat/firekit';
import { TRIAL_COUNT_SCORE_NAMES } from '@roar-platform/assessment-schema';
import { toSreScoreEntries } from '@roar-platform/assessment-schema/roar-sre';
import { RoarScores } from '../experiment/scores';

/**
 * Wires the SRE score computation pipeline into the Firekit facade.
 *
 * Overrides the facade's three score hooks to accumulate per-subtask, per-stage counts,
 * convert computed scores to ScoreEntry[] for backend persistence, and emit all domains
 * on every trial.
 *
 * Must be called once during SRE initialization, after initFirekitCompat, before any
 * trials are written.
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

  // Per-subtask, per-stage accumulator: { [subtask]: { [stage]: { numCorrect, numIncorrect } } }
  // Shape matches the input expected by RoarScores.computedScoreCallback.
  const accumulator = {};

  // Accumulate raw counts per subtask and stage.
  // The SDK calls this for every saved trial with the trial's subtask and assessment_stage fields.
  facade._accumulateRawScore = (subtask, stage, correct) => {
    if (!accumulator[subtask]) accumulator[subtask] = {};
    if (!accumulator[subtask][stage]) {
      accumulator[subtask][stage] = {
        [TRIAL_COUNT_SCORE_NAMES.NUM_CORRECT]: 0,
        [TRIAL_COUNT_SCORE_NAMES.NUM_INCORRECT]: 0,
      };
    }
    if (correct === 1) {
      accumulator[subtask][stage][TRIAL_COUNT_SCORE_NAMES.NUM_CORRECT]++;
    } else {
      accumulator[subtask][stage][TRIAL_COUNT_SCORE_NAMES.NUM_INCORRECT]++;
    }
  };

  // Return accumulated raw scores to trigger the scoring pipeline on every trial.
  // Returns undefined when no trials have been saved yet.
  facade._getRawScores = () => {
    return Object.keys(accumulator).length > 0 ? { ...accumulator } : undefined;
  };

  // Convert computed scores to ScoreEntry[]. All domains are emitted on every trial.
  facade._getScoreAdapter = () => (computed) => toSreScoreEntries(computed);

  // Deferred instantiation — RoarScores reads store.session.get('config').scoringVersion
  // in its constructor, which is only available after initStore() runs.
  return makeLazyComputedCallback(RoarScores);
}
