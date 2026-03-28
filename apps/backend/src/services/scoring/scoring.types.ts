/**
 * Support level classification for a student's score on a task.
 *
 * - `achievedSkill` — score is at or above the achieved threshold
 * - `developingSkill` — score is between developing and achieved thresholds
 * - `needsExtraSupport` — score is at or below the developing threshold
 *
 * `null` is returned when classification is not possible (no score data,
 * unknown task, or thresholds unavailable). Tasks in RAW_SCORE_ONLY_TASKS
 * also return null since they display raw scores without support levels.
 */
export type SupportLevel = 'achievedSkill' | 'developingSkill' | 'needsExtraSupport';

/**
 * Input for support level classification.
 */
export interface ScoringInput {
  /** Student grade as a string (e.g., '3', 'Kindergarten') */
  grade: string | null;
  /** Percentile score from run_scores (may be null for grades >= 6 or missing data) */
  percentile: number | null;
  /** Raw score from run_scores */
  rawScore: number | null;
  /** Task slug (e.g., 'swr', 'sre', 'pa') */
  taskSlug: string;
  /** Scoring version from task_variant_parameters. null = legacy version. */
  scoringVersion: number | null;
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
 * Each field name maps to the `name` column in the `run_scores` table.
 */
export interface ScoreFieldResolution {
  /** The name column value for the percentile score. undefined if task has no percentile. */
  percentileFieldNames: string[];
  /** The name column value for the raw score. undefined if task has no raw score. */
  rawScoreFieldNames: string[];
}
