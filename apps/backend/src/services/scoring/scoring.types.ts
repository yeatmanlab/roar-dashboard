/**
 * Support level classification for a student's score on a task.
 *
 * - `achievedSkill` — score is at or above the achieved threshold
 * - `developingSkill` — score is between developing and achieved thresholds
 * - `needsExtraSupport` — score is at or below the developing threshold
 *
 * `null` is returned when classification is not possible (no score data,
 * unknown task, or thresholds unavailable). Tasks with `none` classification
 * type (e.g., letter, phonics) also return null since they display raw scores
 * without support levels.
 */
export type SupportLevel = 'achievedSkill' | 'developingSkill' | 'needsExtraSupport';

/**
 * Input for support level classification.
 */
export interface ScoringInput {
  /** Student grade as a string (e.g., '3', 'Kindergarten') */
  grade: string | null;
  /**
   * Percentile score (may be null for grades >= 6 or missing data).
   * Newer norming tables (swr v7+, sre v4+, and Spanish variants) may store
   * percentile as angle-bracket strings like ">99" or "<1" in run_scores.
   * Callers must pre-process with parseScoreValue() before passing to getSupportLevel.
   */
  percentile: number | null;
  /**
   * Raw score from run_scores.
   * Callers must pre-process with parseScoreValue() if the DB value may be a string.
   */
  rawScore: number | null;
  /** Task slug (e.g., 'swr', 'sre', 'pa') */
  taskSlug: string;
  /** Scoring version from task_variant_parameters. null = legacy version. */
  scoringVersion: number | null;
  /** Pre-computed support level from the assessment (for assessment-computed tasks like roam-alpaca) */
  assessmentSupportLevel?: string | null;
}

/**
 * Raw score thresholds for support level classification.
 * `above` is the "Achieved Skill" boundary, `some` is the "Developing Skill" boundary.
 */
export interface RawScoreThreshold {
  above: number;
  some: number;
}

/**
 * Resolved score field names for looking up values in the fdwRunScores table.
 * Each array contains the `name` column values for that field type. Empty if the task
 * has no applicable field. When resolved with a specific scoring version, arrays contain
 * at most one entry; without a version, they contain all possible names across versions.
 */
export interface ScoreFieldResolution {
  /** Field names for the numeric percentile value. */
  percentileFieldNames: string[];
  /** Field names for the display-formatted percentile (may include angle brackets). */
  percentileDisplayFieldNames: string[];
  /** Field names for the numeric standard score. */
  standardScoreFieldNames: string[];
  /** Field names for the display-formatted standard score. */
  standardScoreDisplayFieldNames: string[];
  /** Field names for the raw score. */
  rawScoreFieldNames: string[];
}
