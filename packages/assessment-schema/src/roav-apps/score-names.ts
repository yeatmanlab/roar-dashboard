import { TRIAL_COUNT_SCORE_NAMES } from '../constants/trial-count-score-names.js';
import { THETA_SCORE_NAMES } from '../constants/theta-score-names.js';

/**
 * Canonical run_scores.name strings written by the roav-apps scoring callback for the
 * composite domain, per assessment stage (practice, test).
 *
 * - Trial counts (numAttempted/numCorrect/numIncorrect) are `type=raw` direct measurements.
 * - thetaEstimate/thetaSE are the shared-scale IRT estimates (`type=computed`). roav-apps
 *   currently emits them null (no server-side IRT), so they are skipped at write time — but
 *   they are enumerated here so a future CAT-scored variant can write them without a schema
 *   change. The native-scale raw theta variants are intentionally omitted (roav-apps does not
 *   produce them).
 */
export const ROAV_APPS_COMPOSITE_SCORE_NAMES = {
  ...TRIAL_COUNT_SCORE_NAMES,
  THETA_ESTIMATE: THETA_SCORE_NAMES.THETA_ESTIMATE,
  THETA_SE: THETA_SCORE_NAMES.THETA_SE,
} as const;

export type RoavAppsScoreName = (typeof ROAV_APPS_COMPOSITE_SCORE_NAMES)[keyof typeof ROAV_APPS_COMPOSITE_SCORE_NAMES];

/**
 * Composite score names written as `type=raw` — the direct trial-count measurements.
 * thetaEstimate/thetaSE are shared-scale derived values, so they are `type=computed`.
 */
export const ROAV_APPS_RAW_COMPOSITE_SCORE_NAMES = new Set<RoavAppsScoreName>([
  TRIAL_COUNT_SCORE_NAMES.NUM_CORRECT,
  TRIAL_COUNT_SCORE_NAMES.NUM_ATTEMPTED,
  TRIAL_COUNT_SCORE_NAMES.NUM_INCORRECT,
]);
