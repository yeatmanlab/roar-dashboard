import { TRIAL_COUNT_SCORE_NAMES } from '../constants/trial-count-score-names.js';
import { THETA_SCORE_NAMES } from '../constants/theta-score-names.js';

/**
 * Canonical run_scores.domain strings for PA score entries.
 * Casing for these strings is deliberately distinct from the subtask keys ('fsm', 'lsm', 'del')
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
 * distinguishes FSM from LSM from DEL.
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

  // Raw counts — per subtask and composite (shared with all assessments)
  ...TRIAL_COUNT_SCORE_NAMES,

  // Derived per-subtask
  PERCENT_CORRECT: 'percentCorrect',

  // Scoring metadata
  ROAR_SCORE_KIND: 'roarScoreKind',
  SCORING_VERSION: 'scoringVersion',

  // Theta estimates (adaptive scoring only, per subtask and composite)
  ...THETA_SCORE_NAMES,
} as const;

export type PaScoreName = (typeof PA_SCORE_NAMES)[keyof typeof PA_SCORE_NAMES];

/**
 * Scores fall into two types, "raw" and "computed," depending on whether they
 * align with the assessment's "native" scale or a "shared" scale with other
 * assessments on representative norms.
 *
 * - `type='raw'` = values in the assessment's native measurement space: trial
 *   counts, plus the native-scale IRT estimate (`thetaEstimateRaw`/`thetaSERaw`).
 * - `type='computed'` = values derived for reporting: the shared-scale ability
 *   estimate (`thetaEstimate`/`thetaSE`, comparable across assessments) and
 *   normed lookups (percentile, standardScore).
 */
export const PA_RAW_SCORE_NAMES = new Set<PaScoreName>([
  PA_SCORE_NAMES.NUM_CORRECT,
  PA_SCORE_NAMES.NUM_ATTEMPTED,
  PA_SCORE_NAMES.NUM_INCORRECT,
  PA_SCORE_NAMES.THETA_ESTIMATE_RAW,
  PA_SCORE_NAMES.THETA_SE_RAW,
]);
