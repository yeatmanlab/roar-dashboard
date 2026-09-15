import { getFirekitCompat } from '@roar-platform/assessment-sdk/compat/firekit';
import {
  toRoamFluencyScoreEntries,
  toRoamAlpacaScoreEntries,
  ROAM_ALPACA_TASK_IDS,
} from '@roar-platform/assessment-schema/roam-apps';
import { AssessmentStage, buildRawCountEntries, COMPOSITE_DOMAIN } from '@roar-platform/assessment-schema';
import store from 'store2';

/**
 * Maps the SDK's four assessmentStage values down to the two buckets
 * (`practice` / `test`) that `computedScoreCallback` in `scores.js` expects
 * under each subtask (it only reads the `AssessmentStage.TEST` bucket). The
 * `_response` variants aren't in the enum, so they're composed off it.
 */
const STAGE_TO_SCORING_KEY = {
  [AssessmentStage.PRACTICE]: AssessmentStage.PRACTICE,
  [`${AssessmentStage.PRACTICE}_response`]: AssessmentStage.PRACTICE,
  [AssessmentStage.TEST]: AssessmentStage.TEST,
  [`${AssessmentStage.TEST}_response`]: AssessmentStage.TEST,
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
 * - `_getScoreAdapter` — returns a function that converts computed scores to
 *   ScoreEntry[] arrays. Internally:
 *   1. Calls the task-specific entry adapter (`toRoamAlpacaScoreEntries` for
 *      roam-alpaca, `toRoamFluencyScoreEntries` for fluency-arf/fluency-calf) to
 *      generate test-phase entries from computedScoreCallback output.
 *   2. Appends practice raw count entries (numCorrect, numAttempted, numIncorrect)
 *      for each subtask and composite domain from the accumulator, since
 *      computedScoreCallback only processes test-phase data.
 *   taskName is read from config at call time so it reflects the running task.
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

  // Select the entry adapter by task family. taskName is the base task ID
  // ('roam-alpaca', 'fluency-arf', 'fluency-calf') carried in config — the same
  // string scores.js branches on — read at call time so it reflects the running
  // task. Called with `computed` only (strict defaults off), so an unrecognized
  // corpus-derived domain is skipped rather than throwing mid-run.
  facade._getScoreAdapter = () => {
    const taskName = store.session.get('config')?.taskName;
    return (computed) => {
      // Test-phase entries via task-specific adapter (assessmentStage='test').
      const entries =
        taskName === ROAM_ALPACA_TASK_IDS.EN ? toRoamAlpacaScoreEntries(computed) : toRoamFluencyScoreEntries(computed);

      // computedScoreCallback only processes test-phase data and ignores practice.
      const compositePractice = { numCorrect: 0, numAttempted: 0, numIncorrect: 0 };

      for (const [subtask, stages] of Object.entries(accumulator)) {
        const practiceData = stages[AssessmentStage.PRACTICE];
        if (!practiceData || practiceData.numAttempted === 0) continue;

        entries.push(...buildRawCountEntries(subtask, practiceData, AssessmentStage.PRACTICE));

        if (subtask !== COMPOSITE_DOMAIN) {
          compositePractice.numCorrect += practiceData.numCorrect ?? 0;
          compositePractice.numAttempted += practiceData.numAttempted ?? 0;
          compositePractice.numIncorrect += practiceData.numIncorrect ?? 0;
        }
      }

      if (compositePractice.numAttempted > 0) {
        entries.push(...buildRawCountEntries(COMPOSITE_DOMAIN, compositePractice, AssessmentStage.PRACTICE));
      }

      return entries;
    };
  };
}
