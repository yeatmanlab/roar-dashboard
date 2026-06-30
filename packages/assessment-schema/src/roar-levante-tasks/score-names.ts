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
 * values written before the shared-scale transform is applied; totalCorrect
 * and totalNumAttempted — direct per-trial measurements.
 *
 * Computed entries (type=computed): all other fields, including
 * totalPercentCorrect (derived from a division).
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
  TOTAL_PERCENT_CORRECT: 'totalPercentCorrect',
} as const;

export type LevanteScoreName = (typeof LEVANTE_SCORE_NAMES)[keyof typeof LEVANTE_SCORE_NAMES];

/**
 * Score names that map to type='raw' entries — direct measurements captured
 * without derivation: native-scale IRT estimates from the CAT algorithm, and
 * trial counts (totalCorrect, totalNumAttempted) written per-trial.
 * Matches the convention in roar-letter and roar-multichoice.
 */
export const LEVANTE_RAW_SCORE_NAMES = new Set<LevanteScoreName>([
  LEVANTE_SCORE_NAMES.THETA_ESTIMATE_RAW,
  LEVANTE_SCORE_NAMES.THETA_SE_RAW,
  LEVANTE_SCORE_NAMES.TOTAL_CORRECT,
  LEVANTE_SCORE_NAMES.TOTAL_NUM_ATTEMPTED,
]);
