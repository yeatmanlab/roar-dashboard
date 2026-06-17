import { TRIAL_COUNT_SCORE_NAMES } from '../constants/trial-count-score-names.js';

/**
 * Canonical run_scores.domain strings for SRE score entries.
 *
 * SRE writes per-subtask domains (practice, lab, ai, composite, etc.) in addition to
 * the composite domain. All domains are emitted on every trial.
 */
export const SRE_COMPOSITE_DOMAIN = 'composite' as const;
export const SRE_PRACTICE_DOMAIN = 'practice' as const;

/**
 * Canonical run_scores.name strings written by the SRE scoring callback for the composite domain.
 * This is the single source of truth — both the assessment and the backend scoring registry
 * import from here to prevent field-name drift.
 *
 * English v4+ and Spanish v1 produce normed scores (percentile, standardScore).
 * English v3 (legacy) produces TOSREC or SPR normed scores based on grade.
 * Portuguese and German produce only the sreScore (no normed scoring).
 */
export const SRE_COMPOSITE_SCORE_NAMES = {
  // IRT ability estimates — written when theta is available (future CAT mode).
  // thetaEstimateRaw is type=raw (native-scale estimate); thetaEstimate is type=computed.
  THETA_ESTIMATE_RAW: 'thetaEstimateRaw',
  THETA_SE_RAW: 'thetaSERaw',
  THETA_ESTIMATE: 'thetaEstimate',
  THETA_SE: 'thetaSE',
  // Derived score — all versions. Computed as numCorrect - numIncorrect.
  SRE_SCORE: 'sreScore',
  // Normed scores — v4+ English and v1 Spanish
  PERCENTILE: 'percentile',
  STANDARD_SCORE: 'standardScore',
  // Legacy normed scores — v3 English only (grade < 6 uses TOSREC, grade >= 6 uses SPR)
  TOSREC_PERCENTILE: 'tosrecPercentile',
  TOSREC_SS: 'tosrecSS',
  SPR_PERCENTILE: 'sprPercentile',
  SPR_STANDARD_SCORE: 'sprStandardScore',
  // Metadata
  SCORING_VERSION: 'scoringVersion',
  // Raw trial counts — all versions
  ...TRIAL_COUNT_SCORE_NAMES,
} as const;

export type SreCompositeScoreName = (typeof SRE_COMPOSITE_SCORE_NAMES)[keyof typeof SRE_COMPOSITE_SCORE_NAMES];

/**
 * Score names that map to type='raw' in the composite domain.
 * Theta raw estimates and trial counts are direct measurements; everything else is derived.
 */
export const SRE_RAW_COMPOSITE_SCORE_NAMES = new Set<SreCompositeScoreName>([
  SRE_COMPOSITE_SCORE_NAMES.THETA_ESTIMATE_RAW,
  SRE_COMPOSITE_SCORE_NAMES.THETA_SE_RAW,
  SRE_COMPOSITE_SCORE_NAMES.NUM_CORRECT,
  SRE_COMPOSITE_SCORE_NAMES.NUM_ATTEMPTED,
  SRE_COMPOSITE_SCORE_NAMES.NUM_INCORRECT,
]);

/**
 * Score names written for non-composite domains (practice, lab, ai, test1, test2, etc.).
 * Each subtask emits its sreScore (computed) and raw trial counts.
 */
export const SRE_SUBTASK_SCORE_NAMES = {
  SRE_SCORE: 'sreScore',
  ...TRIAL_COUNT_SCORE_NAMES,
} as const;

export type SreSubtaskScoreName = (typeof SRE_SUBTASK_SCORE_NAMES)[keyof typeof SRE_SUBTASK_SCORE_NAMES];

/**
 * Score names that map to type='raw' for non-composite domains.
 */
export const SRE_RAW_SUBTASK_SCORE_NAMES = new Set<SreSubtaskScoreName>([
  TRIAL_COUNT_SCORE_NAMES.NUM_CORRECT,
  TRIAL_COUNT_SCORE_NAMES.NUM_ATTEMPTED,
  TRIAL_COUNT_SCORE_NAMES.NUM_INCORRECT,
]);

/** @deprecated Use SRE_SUBTASK_SCORE_NAMES.SRE_SCORE */
export const SRE_SUBTASK_SCORE_NAME = 'sreScore' as const;

export type SreScoreName = SreCompositeScoreName | SreSubtaskScoreName;
