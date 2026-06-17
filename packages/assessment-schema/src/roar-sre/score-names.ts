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
 * SRE uses a computed score (sreScore = numCorrect - numIncorrect) as the basis for all
 * normed lookups. All entries are type=COMPUTED.
 *
 * English v4/v5 and Spanish v1 produce normed scores (percentile, standardScore).
 * English v3 (legacy) produces TOSREC or SPR normed scores based on grade.
 * Portuguese and German produce only the sreScore (no normed scoring).
 */
export const SRE_COMPOSITE_SCORE_NAMES = {
  // Derived score — all versions. Computed as numCorrect - numIncorrect.
  SRE_SCORE: 'sreScore',
  // Normed scores — v4/v5 English and v1 Spanish
  PERCENTILE: 'percentile',
  STANDARD_SCORE: 'standardScore',
  // Legacy normed scores — v3 English only (grade < 6 uses TOSREC, grade >= 6 uses SPR)
  TOSREC_PERCENTILE: 'tosrecPercentile',
  TOSREC_SS: 'tosrecSS',
  SPR_PERCENTILE: 'sprPercentile',
  SPR_STANDARD_SCORE: 'sprStandardScore',
  // Metadata
  SCORING_VERSION: 'scoringVersion',
} as const;

export type SreCompositeScoreName = (typeof SRE_COMPOSITE_SCORE_NAMES)[keyof typeof SRE_COMPOSITE_SCORE_NAMES];

/**
 * Score name written for non-composite domains (practice, lab, ai, etc.).
 * Each subtask emits only its sreScore per trial.
 */
export const SRE_SUBTASK_SCORE_NAME = 'sreScore' as const;
export type SreSubtaskScoreName = typeof SRE_SUBTASK_SCORE_NAME;

export type SreScoreName = SreCompositeScoreName | SreSubtaskScoreName;
