/**
 * IRT theta estimate score names shared across ROAR assessments.
 *
 * Raw variants (thetaEstimateRaw, thetaSERaw) are the native-scale estimates
 * captured directly from the IRT engine — written as type='raw'. Shared-scale
 * variants (thetaEstimate, thetaSE) are calibrated to a common cross-assessment
 * scale — written as type='computed'.
 *
 * Assessment-specific score-name maps spread this object for the four names they
 * support. SWR omits the SE variants because it does not currently write them.
 */
export const THETA_SCORE_NAMES = {
  THETA_ESTIMATE_RAW: 'thetaEstimateRaw',
  THETA_SE_RAW: 'thetaSERaw',
  THETA_ESTIMATE: 'thetaEstimate',
  THETA_SE: 'thetaSE',
} as const;
