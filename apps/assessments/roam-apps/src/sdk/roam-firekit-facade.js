import { getFirekitCompat } from '@roar-platform/assessment-sdk/compat/firekit';
import { toRoamAppsScoreEntries } from './score-entries';

/**
 * Maps the SDK's four assessmentStage values down to the two buckets
 * (`practice` / `test`) that `computedScoreCallback` in `scores.js` expects
 * under each subtask (it only reads `subtaskScores.test`).
 */
const STAGE_TO_SCORING_KEY = {
  practice: 'practice',
  practice_response: 'practice',
  test: 'test',
  test_response: 'test',
};

/**
 * Wires the roam-apps score computation pipeline into the Firekit facade.
 *
 * Overrides three facade hooks:
 *
 * - `_accumulateRawScore` — accumulates per-subtask, per-stage trial counts.
 *   roam trial data carries a `subtask` field (operator name for fluency,
 *   sub-skill domain for roam-alpaca, or `numberLine`); trials without one
 *   fall back to `'composite'` per the SDK's default.
 * - `_getRawScores` — returns the accumulated counts in the
 *   `{ [subtask]: { practice: {...}, test: {...} } }` shape `computedScoreCallback`
 *   expects as its `rawScores` argument.
 * - `_getScoreAdapter` — always returns `toRoamAppsScoreEntries`, which flattens
 *   whatever `computedScoreCallback` returns into `ScoreEntry[]`.
 *
 * `computedScoreCallback` (passed to `writeTrial` in `initTrialSaving.js`) is
 * unchanged — it already reads session-store state (theta estimates, grade
 * estimates, skills-to-work-on) that this facade doesn't need to inject.
 *
 * Must be called once during initialization, after the facade has been
 * created via `initFirekitCompat` and before any `writeTrial` calls.
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

  // Per-subtask, per-stage accumulator: { [subtask]: { [stage]: { numCorrect, numIncorrect, numAttempted } } }
  const accumulator = {};

  facade._accumulateRawScore = (subtask, stage, correct) => {
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

  facade._getScoreAdapter = () => toRoamAppsScoreEntries;
}
