import { getFirekitCompat, makeLazyComputedCallback } from '@roar-platform/assessment-sdk/compat/firekit';
import { AssessmentStage, buildRawCountEntries } from '@roar-platform/assessment-schema';
import { PA_SCORE_DOMAINS, PA_SUBTASK_KEYS, toPaScoreEntries } from '@roar-platform/assessment-schema/roar-pa';
import { RoarScores } from '../experiment/scores';

/**
 * Wires the PA score computation pipeline into the Firekit facade and returns
 * the `computedScoreCallback` to pass to `writeTrial`.
 *
 * Internally:
 * 1. Creates a `RoarScores` instance that handles test-phase computed scoring.
 * 2. Overrides `_getRawScores`, `_getScoreAdapter`, and `_accumulateRawScore` on
 *    the facade so that every `writeTrial` call:
 *    - Accumulates per-trial raw counts (correct/attempted/incorrect) by subtask and stage.
 *    - Passes accumulated raw counts to `computedScoreCallback` for test-phase norming.
 *    - Converts computed scores + practice raw counts to `ScoreEntry[]` for backend persistence.
 * 3. Returns a lazy callback that instantiates `RoarScores` on the first `writeTrial` call
 *    and delegates to its `computedScoreCallback`. Instantiation is deferred because
 *    `RoarScores` reads `store.session.get('config').scoringVersion` in its constructor,
 *    which is only available after `initStore()` runs.
 *
 * Must be called after `initFirekitCompat` and before `startRun`.
 *
 * @returns {Function} lazy computedScoreCallback — pass to `writeTrial` on each trial
 *
 * @example
 * ```js
 * initFirekitCompat(ctx, { variantId, taskVersion, isAnonymous });
 * const computedScoreCallback = wireScoreAdapter();
 * await startRun();
 * writeTrial(data, computedScoreCallback);
 * ```
 */
export function wireScoreAdapter() {
  const facade = getFirekitCompat();

  // Accumulated raw scores keyed by subtask (lowercase: 'fsm', 'lsm', 'del')
  // then by stage ('practice' | 'test').
  const accumulatedRawScores = {};

  /**
   * @param {string} subtaskRaw - Subtask key from trial data (e.g. 'FSM', 'LSM', 'DEL')
   * @param {string} stage - Assessment stage ('practice' or 'test')
   * @param {number} correct - 1 for correct, 0 for incorrect
   */
  function accumulateRawScore(subtaskRaw, stage, correct) {
    // trial_type values are uppercase ('FSM', 'LSM', 'DEL'); RoarScores.computedScoreCallback
    // and toPaScoreEntries both expect lowercase subtask keys ('fsm', 'lsm', 'del').
    const subtask = subtaskRaw.toLowerCase();

    if (!accumulatedRawScores[subtask]) {
      accumulatedRawScores[subtask] = {
        [AssessmentStage.PRACTICE]: { numCorrect: 0, numAttempted: 0, numIncorrect: 0 },
        [AssessmentStage.TEST]: { numCorrect: 0, numAttempted: 0, numIncorrect: 0 },
      };
    }

    const stageScores = accumulatedRawScores[subtask][stage];
    if (!stageScores) return;
    stageScores.numAttempted += 1;
    if (correct === 1) {
      stageScores.numCorrect += 1;
    } else {
      stageScores.numIncorrect += 1;
    }
  }

  facade._accumulateRawScore = accumulateRawScore;

  facade._getRawScores = () => {
    return Object.keys(accumulatedRawScores).length > 0 ? accumulatedRawScores : undefined;
  };

  facade._getScoreAdapter = () => {
    return (computedScores) => {
      // Test-phase entries via toPaScoreEntries (assessmentStage='test').
      const entries = toPaScoreEntries(computedScores, { strict: true });

      // Practice raw counts — emitted directly from the accumulator because
      // computedScoreCallback only processes test-phase data and ignores practice.
      // We emit numCorrect, numAttempted, numIncorrect for each PA subtask so
      // that run_scores always has a record of practice performance.
      for (const subtaskKey of PA_SUBTASK_KEYS) {
        const lower = subtaskKey.toLowerCase();
        const practiceData = accumulatedRawScores[lower]?.[AssessmentStage.PRACTICE];
        if (!practiceData || practiceData.numAttempted === 0) continue;

        const domain = PA_SCORE_DOMAINS[subtaskKey];
        entries.push(...buildRawCountEntries(domain, practiceData, AssessmentStage.PRACTICE));
      }

      return entries;
    };
  };

  return makeLazyComputedCallback(RoarScores);
}
