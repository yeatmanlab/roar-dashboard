import { getFirekitCompat } from '@roar-platform/assessment-sdk/compat/firekit';
import { AssessmentStage } from '@roar-platform/assessment-schema';
import { toRoavAppsScoreEntries } from '@roar-platform/assessment-schema/roav-apps';

/**
 * Maps every SDK assessmentStage value to the two-bucket keys ('practice' / 'test') that
 * the score adapter expects nested under the composite domain. roav-apps writes response
 * trials with `${stage}_response` stages; both the stimulus stage and its response variant
 * accumulate into the same bucket.
 */
const STAGE_TO_SCORING_KEY = {
  [AssessmentStage.PRACTICE]: AssessmentStage.PRACTICE,
  [`${AssessmentStage.PRACTICE}_response`]: AssessmentStage.PRACTICE,
  [AssessmentStage.TEST]: AssessmentStage.TEST,
  [`${AssessmentStage.TEST}_response`]: AssessmentStage.TEST,
};

/**
 * Wires the roav-apps score computation pipeline into the Firekit facade.
 *
 * roav-apps writes raw count-based scores only (no IRT/normed computation), so the pipeline
 * is minimal:
 *
 * - `_accumulateRawScore` — accumulates per-stage trial counts under the default `composite`
 *   subtask (roav-apps trials carry no `subtask`, so the SDK falls back to 'composite').
 * - `_getRawScores` — returns the accumulated counts as `{ composite: { practice, test } }`,
 *   which is exactly the shape `toRoavAppsScoreEntries` consumes. There is no theta to inject.
 * - `_getScoreAdapter` — returns `toRoavAppsScoreEntries`.
 *
 * The passthrough `computedScoreCallback` in initTrialSaving.js is what `writeTrial` invokes;
 * this facade only wires the surrounding hooks. Must be called once during initialization,
 * after `initFirekitCompat` and before any `writeTrial` calls.
 */
export function wireScoreAdapter() {
  const facade = getFirekitCompat();

  // Per-subtask, per-stage accumulator.
  // Shape: { [subtask]: { [stage]: { numCorrect, numIncorrect, numAttempted } } }
  const accumulator = {};

  facade._accumulateRawScore = (subtask, stage, correct) => {
    // The score adapter expects 'practice' / 'test' stage keys; collapse the SDK's four
    // stages (incl. the `_response` variants roav-apps emits) into the two scoring buckets.
    const normalizedStage = STAGE_TO_SCORING_KEY[stage] ?? stage;

    if (!accumulator[subtask]) accumulator[subtask] = {};
    if (!accumulator[subtask][normalizedStage]) {
      accumulator[subtask][normalizedStage] = { numCorrect: 0, numIncorrect: 0, numAttempted: 0 };
    }
    if (correct === 1) {
      accumulator[subtask][normalizedStage].numCorrect++;
    } else {
      accumulator[subtask][normalizedStage].numIncorrect++;
    }
    accumulator[subtask][normalizedStage].numAttempted++;
  };

  facade._getRawScores = () => {
    if (Object.keys(accumulator).length === 0) return undefined;

    const rawScores = {};
    for (const [subtask, stages] of Object.entries(accumulator)) {
      rawScores[subtask] = {};
      for (const [stage, counts] of Object.entries(stages)) {
        rawScores[subtask][stage] = { ...counts };
      }
    }
    return rawScores;
  };

  facade._getScoreAdapter = () => toRoavAppsScoreEntries;
}
