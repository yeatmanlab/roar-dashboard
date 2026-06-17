import { TRIAL_COUNT_SCORE_NAMES } from '../constants/trial-count-score-names.js';
import { THETA_SCORE_NAMES } from '../constants/theta-score-names.js';

/**
 * Canonical run_scores.domain strings for SWR score entries.
 */
export const SWR_SCORE_DOMAINS = {
  COMPOSITE: 'composite',
} as const;

/**
 * Canonical run_scores.name strings written by the SWR scoring callback.
 * This is the single source of truth — both the assessment and the backend
 * scoring registry import from here to prevent field-name drift.
 *
 * English and Spanish produce normed scores (percentile, standardScore, roarScore).
 * Italian, Portuguese, and German produce raw counts only (numAttempted, numCorrect,
 * numIncorrect, percentCorrect) — no normed scoring exists for these languages.
 */
export const SWR_SCORE_NAMES = {
  // CAT ability estimates — all languages.
  // SWR defines the shared IRT scale, so the native theta IS the shared theta:
  // thetaEstimateRaw (type=raw) and thetaEstimate (type=computed) carry the same
  // value. Both are written so every IRT-scored assessment exposes a native-scale
  // and a shared-scale theta in run_scores.
  // SE is not currently written by SWR — use the individual keys rather than
  // spreading THETA_SCORE_NAMES to avoid implying SE support.
  THETA_ESTIMATE_RAW: THETA_SCORE_NAMES.THETA_ESTIMATE_RAW,
  THETA_ESTIMATE: THETA_SCORE_NAMES.THETA_ESTIMATE,

  // Normed scores — English and Spanish only
  PERCENTILE: 'percentile',
  WJ_PERCENTILE: 'wjPercentile', // legacy field name used before scoring version 7
  STANDARD_SCORE: 'standardScore',
  RAW_SCORE: 'roarScore',

  // Raw counts — Italian, Portuguese, and German produce only these (no normed scores)
  ...TRIAL_COUNT_SCORE_NAMES,
  PERCENT_CORRECT: 'percentCorrect',
} as const;

export type SwrScoreName = (typeof SWR_SCORE_NAMES)[keyof typeof SWR_SCORE_NAMES];

/**
 * Score names that map to type='raw' entries — live state captured per trial
 * (trial counts) and thetaEstimateRaw (the native-scale IRT estimate written
 * as raw). thetaEstimate is type='computed': the shared-scale IRT estimate.
 * For SWR both carry the same value because SWR defines the shared scale.
 */
export const SWR_RAW_SCORE_NAMES = new Set<SwrScoreName>([
  SWR_SCORE_NAMES.THETA_ESTIMATE_RAW,
  SWR_SCORE_NAMES.NUM_ATTEMPTED,
  SWR_SCORE_NAMES.NUM_CORRECT,
  SWR_SCORE_NAMES.NUM_INCORRECT,
  SWR_SCORE_NAMES.PERCENT_CORRECT,
]);
