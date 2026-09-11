/**
 * Shared types for lookup-table norming.
 *
 * These describe the *shape* of a parsed norm table and the *strategy* for keying into it.
 * The library is deliberately I/O-free: callers fetch and parse the CSV themselves (Papaparse
 * in the browser assessments, axios + papaparse on the backend) and pass the parsed rows here.
 */

/**
 * A single parsed lookup-table row. Cells are whatever the CSV parser produced — numbers when
 * `dynamicTyping` coerces them, strings otherwise (e.g. a percentile cell of `">99"` or `"<1"`).
 * Unknown columns are preserved so {@link extractNormedScores} can pass them through verbatim.
 */
export interface LookupRow {
  [column: string]: string | number | null | undefined;
}

/**
 * How a score column is compared against the participant's score.
 *
 * - `theta`: round both sides to 1 decimal before comparing. IRT theta tables are published on
 *   a 0.1 grid, so an exact float compare would miss almost every row.
 * - `exact`: strict numeric equality. Used for integer raw-count tables (PA fixed `roarScore`,
 *   SRE `sreScore`).
 */
export type MatchMode = 'theta' | 'exact';

/**
 * Which demographic dimension the table is keyed on.
 *
 * - `ageMonths`: derive age-in-months (falling back to grade via the linear heuristic) and clamp.
 * - `grade`: key directly on the participant's grade (optionally clamped).
 */
export type KeyKind = 'ageMonths' | 'grade';

/** Participant demographics available for keying. Either or both may be absent. */
export interface Demographics {
  /** Age in months, when known directly. */
  ageMonths?: number | null;
  /**
   * Grade as a number (Kindergarten = 0, grade 1 = 1, …). Callers must pass the *raw* grade
   * presence: a helper like roar-utils `getGrade()` falls back to `0`, which would defeat the
   * "is grade known?" check here. Pass `null`/`undefined` when grade is genuinely unknown.
   */
  grade?: number | null;
}

/** Inclusive clamp bounds. Either side omitted leaves that side unbounded. */
export interface ClampRange {
  min?: number;
  max?: number;
}

/**
 * A complete description of how to key into a particular norm table. One of these is defined
 * per assessment (or per scoring version) and is the single source of truth shared between the
 * client assessments and the backend so the two can never drift in how they read the same table.
 */
export interface KeyingStrategy {
  /** Demographic dimension to derive the key value from. */
  keyKind: KeyKind;
  /** The column in the CSV that holds the demographic key (usually `'ageMonths'` or `'grade'`). */
  keyColumn: string;
  /** Clamp bounds applied to the derived key value (e.g. age clamped to `[60, 96]`). */
  clamp?: ClampRange;
  /** The CSV column holding the score to match (e.g. `'thetaEstimate'`, `'roarScore'`, `'sreScore'`). */
  scoreColumn: string;
  /** How to compare {@link scoreColumn} against the participant score. */
  matchMode: MatchMode;
  /** Extra columns to drop from the extracted normed scores (beyond key, score, and blank columns). */
  omitColumns?: readonly string[];
}

/** The outcome of a successful norm-table resolution. */
export interface NormResolution {
  /** The clamped demographic value used to key into the table. */
  keyValue: number;
  /** The matched lookup row. */
  row: LookupRow;
  /** The normed columns extracted from {@link row} (key, score, and blank columns removed). */
  normedScores: Record<string, string | number>;
}
