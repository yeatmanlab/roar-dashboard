import { getFirekitCompat } from '@yeatmanlab/assessment-sdk/compat/firekit';
import { toPaScoreEntries } from '@roar-dashboard/assessment-schema/pa';

/**
 * Wires the PA score computation pipeline into the Firekit facade.
 *
 * This function overrides the facade's score methods to:
 * 1. Accumulate and return raw scores from trials via _getRawScores()
 * 2. Return the toPaScoreEntries adapter that converts computed scores to ScoreEntry[]
 * 3. Enable score emission during writeTrial()
 *
 * Must be called once during PA initialization (in serve.js) before any trials are written.
 *
 * @example
 * ```js
 * initFirekitCompat(ctx, { variantId, taskVersion, isAnonymous });
 * wireScoreAdapter(); // Wire PA score computation
 * await startRun();
 * ```
 */
export function wireScoreAdapter() {
  const facade = getFirekitCompat();

  // Accumulate raw scores from trials
  // Structure: { subtask: { practice: {...}, test: {...} }, ... }
  const accumulatedRawScores = {};

  /**
   * Accumulates raw scores from a trial into the running totals.
   * Called internally to build up the raw scores object that will be passed to the callback.
   *
   * @param {string} subtask - The subtask key (e.g., 'fsm', 'lsm', 'del', 'composite')
   * @param {string} stage - The assessment stage ('practice' or 'test')
   * @param {number} correct - Whether the trial was correct (1 or 0)
   */
  function accumulateRawScore(subtask, stage, correct) {
    if (!accumulatedRawScores[subtask]) {
      accumulatedRawScores[subtask] = {
        practice: { numCorrect: 0, numAttempted: 0, numIncorrect: 0 },
        test: { numCorrect: 0, numAttempted: 0, numIncorrect: 0 },
      };
    }

    const stageScores = accumulatedRawScores[subtask][stage];
    stageScores.numAttempted += 1;
    if (correct === 1) {
      stageScores.numCorrect += 1;
    } else {
      stageScores.numIncorrect += 1;
    }
  }

  // Override _getRawScores to return accumulated raw scores from trials
  facade._getRawScores = () => {
    // Return the accumulated raw scores object
    // This will be passed to the computedScoreCallback
    return Object.keys(accumulatedRawScores).length > 0 ? accumulatedRawScores : undefined;
  };

  // Override _getScoreAdapter to return the PA score mapping function
  facade._getScoreAdapter = () => {
    // Return the toPaScoreEntries adapter that converts PA computed scores to backend format
    return (scores) => {
      // scores is the ComputedScores object from RoarScores.computedScoreCallback
      // toPaScoreEntries converts it to ScoreEntry[] for backend persistence
      // Use strict: true to fail loudly on unregistered score names in CI
      return toPaScoreEntries(scores, { strict: true });
    };
  };

  // Store the accumulation function on the facade so it can be called from writeTrial
  facade._accumulateRawScore = accumulateRawScore;
}
