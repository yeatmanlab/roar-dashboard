import { THETA_SCORE_NAMES } from '../constants/theta-score-names.js';

/**
 * Score names for the composite domain in adaptive mode.
 *
 * Always present: totalCorrect, totalNumAttempted, totalPercentCorrect, roarScoreKind, scoringVersion.
 * Present when IRT converged: theta estimate and SE pairs (raw native-scale + computed shared-scale).
 * Present when normed lookup resolves (English, age/grade available, theta converged):
 *   roarScore, standardScore, percentile.
 */
export const MULTICHOICE_COMPOSITE_SCORE_NAMES = {
  TOTAL_CORRECT: 'totalCorrect',
  TOTAL_NUM_ATTEMPTED: 'totalNumAttempted',
  TOTAL_PERCENT_CORRECT: 'totalPercentCorrect',
  ...THETA_SCORE_NAMES,
  ROAR_SCORE_KIND: 'roarScoreKind',
  SCORING_VERSION: 'scoringVersion',
  ROAR_SCORE: 'roarScore',
  STANDARD_SCORE: 'standardScore',
  PERCENTILE: 'percentile',
} as const;

export type MultichoiceCompositeName =
  (typeof MULTICHOICE_COMPOSITE_SCORE_NAMES)[keyof typeof MULTICHOICE_COMPOSITE_SCORE_NAMES];

/**
 * Score names for the composite_comprehension domain in adaptive mode.
 *
 * Contains IRT estimates (raw and shared-scale) plus metadata.
 * No raw count fields and no normed scores — comprehension is IRT-only.
 */
export const MULTICHOICE_COMPREHENSION_SCORE_NAMES = {
  ...THETA_SCORE_NAMES,
  ROAR_SCORE_KIND: 'roarScoreKind',
  SCORING_VERSION: 'scoringVersion',
} as const;

export type MultichoiceComprehensionName =
  (typeof MULTICHOICE_COMPREHENSION_SCORE_NAMES)[keyof typeof MULTICHOICE_COMPREHENSION_SCORE_NAMES];

/**
 * Score names for the composite domain in non-adaptive mode.
 *
 * No IRT estimates, no normed scores. The scoring callback emits only
 * aggregate counts derived from the test stage of the rawScores object.
 */
export const MULTICHOICE_NON_ADAPTIVE_SCORE_NAMES = {
  SUB_SCORE: 'subScore',
  SUB_PERCENT_CORRECT: 'subPercentCorrect',
} as const;

export type MultichoiceNonAdaptiveName =
  (typeof MULTICHOICE_NON_ADAPTIVE_SCORE_NAMES)[keyof typeof MULTICHOICE_NON_ADAPTIVE_SCORE_NAMES];

/**
 * Union of all score names across scoring modes.
 *
 * Note: `MultichoiceComprehensionName` is currently a strict subset of
 * `MultichoiceCompositeName` (both spread THETA_SCORE_NAMES and share
 * roarScoreKind/scoringVersion), so TypeScript collapses this to
 * `MultichoiceCompositeName | MultichoiceNonAdaptiveName` at the type level.
 * The three-way union is kept intentionally — if comprehension ever gains
 * fields that composite does not have (e.g. comprehension-specific normed
 * scores), the union will widen correctly without a type change here.
 */
export type MultichoiceScoreName = MultichoiceCompositeName | MultichoiceComprehensionName | MultichoiceNonAdaptiveName;
