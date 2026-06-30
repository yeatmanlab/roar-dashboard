import { THETA_SCORE_NAMES } from '../constants/theta-score-names.js';

export { LEVANTE_SCORE_DOMAINS } from './domains.js';

/**
 * Canonical run_scores.name strings for LEVANTE task scoring.
 *
 * Normed tasks (trog, roar-inference) write IRT estimates from the CAT algorithm
 * plus normed scores (percentile, standardScore, roarScore) from GCS lookup
 * tables keyed by thetaEstimate × age.
 *
 * Unnormed tasks (egma-math, matrix-reasoning, etc.) write raw count-based scores:
 * totalCorrect, totalNumAttempted, totalPercentCorrect.
 *
 * Raw entries (type=raw): thetaEstimateRaw, thetaSERaw — native-scale IRT
 * values written before the shared-scale transform is applied.
 *
 * Computed entries (type=computed): all other fields.
 */
export const LEVANTE_SCORE_NAMES = {
  // CAT ability estimates — shared constants reused across ROAR IRT assessments
  THETA_ESTIMATE_RAW: THETA_SCORE_NAMES.THETA_ESTIMATE_RAW,
  THETA_SE_RAW: THETA_SCORE_NAMES.THETA_SE_RAW,
  THETA_ESTIMATE: THETA_SCORE_NAMES.THETA_ESTIMATE,
  THETA_SE: THETA_SCORE_NAMES.THETA_SE,

  // Normed scores from GCS lookup table
  SCORING_VERSION: 'scoringVersion',
  ROAR_SCORE: 'roarScore',
  STANDARD_SCORE: 'standardScore',
  PERCENTILE: 'percentile',

  // Unnormed count-based scores (all tasks without a GCS lookup table)
  TOTAL_CORRECT: 'totalCorrect',
  TOTAL_NUM_ATTEMPTED: 'totalNumAttempted',
  PERCENT_CORRECT: 'totalPercentCorrect',
} as const;

export type LevanteScoreName = (typeof LEVANTE_SCORE_NAMES)[keyof typeof LEVANTE_SCORE_NAMES];

/**
 * Score names that map to type='raw' entries — native-scale IRT estimates
 * captured directly from the CAT algorithm before scaling.
 */
export const LEVANTE_RAW_SCORE_NAMES = new Set<LevanteScoreName>([
  LEVANTE_SCORE_NAMES.THETA_ESTIMATE_RAW,
  LEVANTE_SCORE_NAMES.THETA_SE_RAW,
]);
