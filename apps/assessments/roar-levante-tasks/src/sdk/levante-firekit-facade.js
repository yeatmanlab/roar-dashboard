import { getFirekitCompat } from '@roar-platform/assessment-sdk/compat/firekit';
import { toLevanteScoreEntries } from '@roar-platform/assessment-schema/roar-levante-tasks';
import { AssessmentStage } from '@roar-platform/assessment-schema';
import { taskStore } from '../taskStore';

/**
 * Maps every SDK assessmentStage value to the two-bucket keys ('practice' / 'test')
 * that ScoringHandler expects in rawScores. The SDK emits separate stages for
 * stimulus display ('practice', 'test') and response collection ('practice_response',
 * 'test_response'); both should accumulate into the same bucket.
 */
const STAGE_TO_SCORING_KEY = {
  [AssessmentStage.PRACTICE]: AssessmentStage.PRACTICE,
  [`${AssessmentStage.PRACTICE}_response`]: AssessmentStage.PRACTICE,
  [AssessmentStage.TEST]: AssessmentStage.TEST,
  [`${AssessmentStage.TEST}_response`]: AssessmentStage.TEST,
};

/**
 * Wires the LEVANTE score computation pipeline into the Firekit facade.
 *
 * Overrides three facade hooks:
 *
 * - `_accumulateRawScore` — accumulates per-subtask, per-stage trial counts.
 * - `_getRawScores` — returns the accumulated counts and injects current CAT
 *   theta estimates from taskStore so ScoringHandler.getNormedScores can perform
 *   the GCS lookup (trog and roar-inference only).
 * - `_getScoreAdapter` — always returns toLevanteScoreEntries, which emits
 *   entries for whichever LEVANTE_SCORE_NAMES fields are present in the
 *   computed scores (normed fields for trog/roar-inference; count-based fields
 *   for all other tasks).
 *
 * The scoreCallback in trialSaving.ts (which reads taskStore().irtEstimates and
 * delegates to ScoringHandler) is already the computedScoreCallback passed to
 * writeTrial. This facade only wires the surrounding hooks.
 *
 * Must be called once during initialization, after initFirekitCompat and before
 * any writeTrial calls.
 *
 * @example
 * ```js
 * initFirekitCompat(ctx, { variantId, taskVersion });
 * wireScoreAdapter();
 * await startRun();
 * ```
 */
export function wireScoreAdapter() {
  const facade = getFirekitCompat();

  // Per-subtask, per-stage accumulator.
  // Shape: { [subtask]: { [stage]: { numCorrect, numIncorrect, numAttempted } } }
  const accumulator = {};

  facade._accumulateRawScore = (subtask, stage, correct) => {
    // ScoringHandler expects 'practice' and 'test' as the stage keys. The SDK emits
    // four distinct stages; collapse them into the two scoring buckets via the map.
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

    // Inject current theta estimates into the test data so ScoringHandler.getNormedScores
    // can find the thetaEstimate needed for the GCS lookup table (trog, roar-inference).
    // irtEstimates keys are CAT names (e.g. 'composite'); values are IrtEstimate objects
    // (src/tasks/shared/helpers/irtEstimates.ts). The IrtEstimate interface guarantees the
    // spread produces exactly the keys that LEVANTE_SCORE_NAMES.THETA_ESTIMATE_RAW and
    // THETA_SE_RAW expect ('thetaEstimateRaw', 'thetaSERaw'). If the CAT runtime ever
    // changes the key names in IrtEstimate, these fields will silently disappear from
    // run_scores — a TypeScript type error in irtEstimates.ts would be the signal.
    const irtEstimates = taskStore().irtEstimates;
    for (const [cat, estimate] of Object.entries(irtEstimates ?? {})) {
      if (!rawScores[cat]) rawScores[cat] = {};
      rawScores[cat].test = { ...(rawScores[cat].test ?? {}), ...estimate };
    }

    return rawScores;
  };

  facade._getScoreAdapter = () => toLevanteScoreEntries;
}
