import { getFirekitCompat } from '@roar-platform/assessment-sdk/compat/firekit';
import { AssessmentStage, ScoreType } from '@roar-platform/assessment-schema';
import { toSwrScoreEntries, SWR_SCORE_NAMES, SWR_SCORE_DOMAINS } from '@roar-platform/assessment-schema/roar-swr';
// Namespace import for lazy access — experiment.js imports from config.js,
// so we avoid a circular-dep evaluation-order issue by only reading .cat
// inside function closures (at call time, not at module evaluation time).
import * as experimentModule from '../experiment/experiment';
import { RoarScores } from '../experiment/scores';

/**
 * Wires the SWR score computation pipeline into the Firekit facade.
 *
 * Overrides the facade's three score hooks to accumulate per-stage state,
 * drive the computedScoreCallback with CAT theta on test trials, and convert
 * the resulting computed scores to ScoreEntry[] for backend persistence.
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
  const roarScores = new RoarScores();

  let currentStage = null;
  let practiceNumAttempted = 0;
  let practiceNumCorrect = 0;

  // Track stage and accumulate practice counts.
  // The SDK calls this for every saved trial (subtask defaults to 'composite'
  // for assessments like SWR that don't use named subtasks).
  facade._accumulateRawScore = (_subtask, stage, correct) => {
    currentStage = stage;
    if (currentStage === 'practice') {
      practiceNumAttempted++;
      if (correct === 1) practiceNumCorrect++;
    }
  };

  // Return raw scores to trigger the scoring pipeline.
  // Test trials: CAT theta drives computedScoreCallback → normed scores.
  // Practice trials: empty placeholder so the adapter can write practice counts.
  facade._getRawScores = () => {
    if (currentStage === 'test') {
      const { cat } = experimentModule;
      const theta = cat?.theta;
      if (!cat || theta == null) return undefined;
      return {
        composite: {
          test: {
            thetaEstimate: theta,
            thetaSE: cat.seMeasurement === Infinity ? null : cat.seMeasurement,
          },
        },
      };
    }
    // Only trigger the pipeline once we have at least one practice trial.
    return practiceNumAttempted > 0 ? { composite: {} } : undefined;
  };

  // Convert computed scores to ScoreEntry[].
  // Test trials: delegate to toSwrScoreEntries (theta + normed scores).
  // Practice trials: write accumulated counts with assessmentStage = 'practice'.
  facade._getScoreAdapter = () => (computed) => {
    if (currentStage === 'test') {
      return toSwrScoreEntries(computed, { strict: true });
    }
    const numIncorrect = practiceNumAttempted - practiceNumCorrect;
    return [
      { type: ScoreType.RAW, domain: SWR_SCORE_DOMAINS.COMPOSITE, name: SWR_SCORE_NAMES.NUM_ATTEMPTED, value: String(practiceNumAttempted), assessmentStage: AssessmentStage.PRACTICE },
      { type: ScoreType.RAW, domain: SWR_SCORE_DOMAINS.COMPOSITE, name: SWR_SCORE_NAMES.NUM_CORRECT, value: String(practiceNumCorrect), assessmentStage: AssessmentStage.PRACTICE },
      { type: ScoreType.RAW, domain: SWR_SCORE_DOMAINS.COMPOSITE, name: SWR_SCORE_NAMES.NUM_INCORRECT, value: String(numIncorrect), assessmentStage: AssessmentStage.PRACTICE },
    ];
  };

  return roarScores.computedScoreCallback.bind(roarScores);
}
