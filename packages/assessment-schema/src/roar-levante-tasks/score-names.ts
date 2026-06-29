import { THETA_SCORE_NAMES } from '../constants/theta-score-names.js';

export { LEVANTE_SCORE_DOMAINS } from './domains.js';

/**
 * Canonical run_scores.name strings for LEVANTE normed task scoring.
 *
 * Covers trog and roar-inference, which write IRT estimates from the CAT
 * algorithm plus normed scores (percentile, standardScore, roarScore) from
 * GCS lookup tables keyed by thetaEstimate × age.
 *
 * Raw entries (type=raw): thetaEstimateRaw, thetaSERaw — native-scale IRT
 * values written before the shared-scale transform is applied.
 *
 * Computed entries (type=computed): thetaEstimate, thetaSE (shared-scale IRT),
 * plus normed scores (roarScore, standardScore, percentile) and scoringVersion.
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
