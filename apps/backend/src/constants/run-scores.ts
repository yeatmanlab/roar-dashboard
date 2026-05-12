/**
 * Run scores constants
 *
 * Centralizes the magic strings used as natural-key components in `app.run_scores`.
 *
 * The recompute path (`RunService.recomputeBestRunForVariant`) and the upsert path
 * (`RunScoresRepository.upsertMany` and its callers) both look up score rows by
 * `(type, domain, name, assessmentStage)`. Inlining string literals in either place
 * makes typos a runtime bug and refactors fragile — these constants give us one
 * source of truth.
 *
 * Values mirror the keys the assessment SDK has historically written to
 * `runData.scores.raw.composite.test.*` in the Firestore data model and are
 * preserved here for compatibility with existing reporting expectations.
 */

/**
 * `app.run_scores.type` enum values. Mirrors `score_type` in the DB.
 */
export const SCORE_TYPE = {
  COMPUTED: 'computed',
  RAW: 'raw',
} as const;

export type ScoreTypeValue = (typeof SCORE_TYPE)[keyof typeof SCORE_TYPE];

/**
 * `app.run_scores.domain` values used by CAT scoring.
 *
 * Domain names are open-ended on the schema side (text column) — this set captures
 * the values the recompute and CAT scoring paths look up by name. Add new entries
 * here when extending domain coverage.
 */
export const SCORE_DOMAIN = {
  COMPOSITE: 'composite',
} as const;

export type ScoreDomainValue = (typeof SCORE_DOMAIN)[keyof typeof SCORE_DOMAIN];

/**
 * `app.run_scores.assessment_stage` enum values. Mirrors `assessment_stage` in the DB.
 */
export const ASSESSMENT_STAGE = {
  PRACTICE: 'practice',
  TEST: 'test',
} as const;

export type AssessmentStageValue = (typeof ASSESSMENT_STAGE)[keyof typeof ASSESSMENT_STAGE];

/**
 * `app.run_scores.name` values referenced by the best-run recompute logic.
 *
 * These are the score names the four-tier ranking compares within tier 2 and tier 4
 * (lowest `thetaSE`, then highest `numAttempted`). Other code paths may reference
 * additional score names — keep this list to ones the backend actually consumes by
 * name in queries.
 */
export const SCORE_NAME = {
  THETA_SE: 'thetaSE',
  NUM_ATTEMPTED: 'numAttempted',
} as const;

export type ScoreNameValue = (typeof SCORE_NAME)[keyof typeof SCORE_NAME];
