import { getFirekitCompat, makeLazyComputedCallback } from '@roar-platform/assessment-sdk/compat/firekit';
import { AssessmentStage, buildRawCountEntries } from '@roar-platform/assessment-schema';
import { toSwrScoreEntries, SWR_SCORE_DOMAINS } from '@roar-platform/assessment-schema/roar-swr';
// Namespace import for lazy access — experiment.js imports from config.js,
// so we avoid a circular-dep evaluation-order issue by only reading .cat
// inside function closures (at call time, not at module evaluation time).
import * as experimentModule from '../experiment/experiment';
import { RoarScores } from '../experiment/scores';

/**
 * Wires the SWR score computation pipeline into the Firekit facade.
 *
 * Overrides the facade's three score hooks to accumulate per-stage state,
 * drive the computedScoreCallback with CAT theta and trial counts on test
 * trials, and convert the resulting computed scores to ScoreEntry[] for
 * backend persistence.
 *
 * All SWR language variants (EN, ES, IT, PT, DE) flow through the same path.
 * Non-normed languages emit theta and trial counts; normed languages additionally
 * emit percentile, standardScore, and roarScore via the RoarScores lookup table.
 *
 * Must be called once during SWR initialization, after initFirekitCompat,
 * before any trials are written.
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

  let currentStage = null;
  let practiceNumAttempted = 0;
  let practiceNumCorrect = 0;
  let testNumAttempted = 0;
  let testNumCorrect = 0;

  // Track stage and accumulate counts for both practice and test.
  // The SDK calls this for every saved trial (subtask defaults to 'composite'
  // for assessments like SWR that don't use named subtasks).
  facade._accumulateRawScore = (_subtask, stage, correct) => {
    currentStage = stage;
    if (stage === AssessmentStage.PRACTICE) {
      practiceNumAttempted++;
      if (correct === 1) practiceNumCorrect++;
    } else if (stage === AssessmentStage.TEST) {
      testNumAttempted++;
      if (correct === 1) testNumCorrect++;
    }
  };

  // Return raw scores to trigger the scoring pipeline.
  // Test: includes CAT theta (null if unavailable) and accumulated counts so
  //   computedScoreCallback can forward them to the score adapter. Gated on
  //   testNumAttempted so no scores are written before any test trials.
  // Practice: placeholder so computedScoreCallback fires and preloads the norm
  //   table during practice (latency hidden before first test trial). The
  //   computed result is discarded — _getScoreAdapter reads currentStage directly.
  facade._getRawScores = () => {
    if (currentStage === AssessmentStage.TEST) {
      if (testNumAttempted === 0) return undefined;
      const { cat } = experimentModule;
      const theta = cat?.theta ?? null;
      return {
        composite: {
          test: {
            // SWR defines the shared IRT scale, so the native theta IS the shared
            // theta. Write both so run_scores has thetaEstimateRaw (type=raw) and
            // thetaEstimate (type=computed) with equal values, matching the PA shape.
            // thetaSERaw (type=raw) is the native-scale SE used by recomputeUseForReporting;
            // no computed thetaSE is written because SWR has no cross-scale SE transform.
            thetaEstimateRaw: theta,
            thetaEstimate: theta,
            thetaSERaw: cat != null && cat.seMeasurement !== Infinity ? cat.seMeasurement : null,
            numCorrect: testNumCorrect,
            numAttempted: testNumAttempted,
            numIncorrect: testNumAttempted - testNumCorrect,
            percentCorrect: (testNumCorrect / testNumAttempted) * 100,
          },
        },
      };
    }
    // Only trigger the pipeline once we have at least one practice trial.
    return practiceNumAttempted > 0 ? { composite: {} } : undefined;
  };

  // Convert computed scores to ScoreEntry[].
  // Test: delegate to toSwrScoreEntries — theta and counts are forwarded from
  //   _getRawScores through computedScoreCallback; normed scores (percentile,
  //   standardScore, roarScore) are added by computedScoreCallback for EN/ES
  //   via the RoarScores lookup table.
  // Practice: write accumulated counts with assessmentStage = 'practice'.
  facade._getScoreAdapter = () => (computed) => {
    if (currentStage === AssessmentStage.TEST) {
      return toSwrScoreEntries(computed, { strict: true });
    }

    return buildRawCountEntries(
      SWR_SCORE_DOMAINS.COMPOSITE,
      {
        numCorrect: practiceNumCorrect,
        numAttempted: practiceNumAttempted,
        numIncorrect: practiceNumAttempted - practiceNumCorrect,
      },
      AssessmentStage.PRACTICE,
    );
  };

  // Deferred instantiation — RoarScores reads store.session.get('config').scoringVersion
  // in its constructor, which is only available after initStore() runs.
  return makeLazyComputedCallback(RoarScores);
}
