import { getFirekitCompat } from '@yeatmanlab/assessment-sdk/compat/firekit';
import { toPaScoreEntries } from '@roar-dashboard/assessment-schema/pa';

/**
 * Wires the PA score computation pipeline into the Firekit facade.
 *
 * This function overrides the facade's score adapter methods to:
 * 1. Return the toPaScoreEntries adapter that converts computed scores to ScoreEntry[]
 * 2. Enable score emission during writeTrial()
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

  // Override _getScoreAdapter to return the PA score mapping function
  facade._getScoreAdapter = () => {
    // Return the toPaScoreEntries adapter that converts PA computed scores to backend format
    return (scores) => {
      // scores is the ComputedScores object from RoarScores.computedScoreCallback
      // toPaScoreEntries converts it to ScoreEntry[] for backend persistence
      return toPaScoreEntries(scores);
    };
  };
}
