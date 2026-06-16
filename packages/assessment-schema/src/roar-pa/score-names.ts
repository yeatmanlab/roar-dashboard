/**
 * Canonical run_scores.domain strings for PA score entries.
 * Subtask domains use uppercase to match the BigQuery schema convention.
 */
export const PA_SCORE_DOMAINS = {
  FSM: 'FSM',
  LSM: 'LSM',
  DEL: 'DEL',
  COMPOSITE: 'composite',
  COMPOSITE_FOUNDATIONAL: 'composite_foundational',
} as const;

export type PaScoreDomain = (typeof PA_SCORE_DOMAINS)[keyof typeof PA_SCORE_DOMAINS];

/**
 * Canonical run_scores.name strings written by the PA scoring callback.
 * This is the single source of truth — both the assessment and the backend
 * scoring registry import from here to prevent field-name drift.
 *
 * Score names are generic (no subtask prefix) because domain already
 * distinguishes FSM from LSM from DEL. This matches the BigQuery schema.
 */
export const PA_SCORE_NAMES = {
  // Summary scores (composite-level normed output)
  RAW_SCORE: 'roarScore',
  PERCENTILE: 'percentile',
  PERCENTILE_SPR: 'sprPercentile',
  PERCENTILE_STRING_SPR: 'sprPercentileString',
  STANDARD_SCORE: 'standardScore',
  STANDARD_SCORE_SPR: 'sprStandardScore',
  STANDARD_SCORE_STRING_SPR: 'sprStandardScoreString',
  CEILING_FLAG: 'ceilingFlag',
  CATEGORY_SCORE: 'categoryScore',

  // Raw counts — per subtask and composite
  NUM_CORRECT: 'numCorrect',
  NUM_ATTEMPTED: 'numAttempted',
  NUM_INCORRECT: 'numIncorrect',

  // Derived per-subtask
  PERCENT_CORRECT: 'percentCorrect',

  // Scoring metadata
  ROAR_SCORE_KIND: 'roarScoreKind',
  SCORING_VERSION: 'scoringVersion',

  // Theta estimates (adaptive scoring only, per subtask and composite)
  THETA_ESTIMATE: 'thetaEstimate',
  THETA_SE: 'thetaSE',
  THETA_ESTIMATE_RAW: 'thetaEstimateRaw',
  THETA_SE_RAW: 'thetaSERaw',
} as const;

export type PaScoreName = (typeof PA_SCORE_NAMES)[keyof typeof PA_SCORE_NAMES];

/**
 * Score names that map to type='raw' entries — live state captured directly
 * from trial accumulation (counts, unscaled theta internals).
 * thetaEstimate and thetaSE are type='computed': they are IRT-derived ability
 * estimates, not raw trial observations.
 */
export const PA_RAW_SCORE_NAMES = new Set<PaScoreName>([
  PA_SCORE_NAMES.NUM_CORRECT,
  PA_SCORE_NAMES.NUM_ATTEMPTED,
  PA_SCORE_NAMES.NUM_INCORRECT,
  PA_SCORE_NAMES.THETA_ESTIMATE_RAW,
  PA_SCORE_NAMES.THETA_SE_RAW,
]);
