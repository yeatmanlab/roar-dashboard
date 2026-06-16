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
  // CAT ability estimate — all languages
  THETA_ESTIMATE: 'thetaEstimate',

  // Normed scores — English and Spanish only
  PERCENTILE: 'percentile',
  WJ_PERCENTILE: 'wjPercentile', // legacy field name used before scoring version 7
  STANDARD_SCORE: 'standardScore',
  RAW_SCORE: 'roarScore',

  // Raw counts — Italian, Portuguese, and German
  NUM_ATTEMPTED: 'numAttempted',
  NUM_CORRECT: 'numCorrect',
  NUM_INCORRECT: 'numIncorrect',
  PERCENT_CORRECT: 'percentCorrect',
} as const;

export type SwrScoreName = (typeof SWR_SCORE_NAMES)[keyof typeof SWR_SCORE_NAMES];

/**
 * Score names that map to type='raw' entries — live state captured per trial
 * (trial counts). thetaEstimate and thetaSE are type='computed': IRT-derived
 * ability estimates, not raw trial observations.
 */
export const SWR_RAW_SCORE_NAMES = new Set<SwrScoreName>([
  SWR_SCORE_NAMES.NUM_ATTEMPTED,
  SWR_SCORE_NAMES.NUM_CORRECT,
  SWR_SCORE_NAMES.NUM_INCORRECT,
  SWR_SCORE_NAMES.PERCENT_CORRECT,
]);
