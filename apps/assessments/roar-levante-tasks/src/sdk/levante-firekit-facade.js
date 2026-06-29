import { getFirekitCompat } from '@roar-platform/assessment-sdk/compat/firekit';
import { toLevanteScoreEntries } from '@roar-platform/assessment-schema/roar-levante-tasks';
import { taskStore } from '../taskStore';

/** Tasks with normed GCS lookup scoring. */
const NORMED_TASKS = new Set(['trog', 'roar-inference']);

/**
 * Wires the LEVANTE score computation pipeline into the Firekit facade.
 *
 * Overrides three facade hooks:
 *
 * - `_accumulateRawScore` — accumulates per-subtask, per-stage trial counts.
 * - `_getRawScores` — returns the accumulated counts and injects current CAT
 *   theta estimates from taskStore so ScoringHandler.getNormedScores can perform
 *   the GCS lookup (trog and roar-inference only).
 * - `_getScoreAdapter` — returns toLevanteScoreEntries for normed tasks, or a
 *   no-op for unnormed tasks (no scoring config yet; follow-on PR).
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
    // irtEstimates keys are CAT names (e.g. 'composite'); values are IrtEstimate objects.
    const irtEstimates = taskStore().irtEstimates;
    for (const [cat, estimate] of Object.entries(irtEstimates ?? {})) {
      if (!rawScores[cat]) rawScores[cat] = {};
      rawScores[cat].test = { ...(rawScores[cat].test ?? {}), ...estimate };
    }

    return rawScores;
  };

  facade._getScoreAdapter = () => {
    const task = taskStore().task;
    if (!NORMED_TASKS.has(task)) return () => [];
    return toLevanteScoreEntries;
  };
}
