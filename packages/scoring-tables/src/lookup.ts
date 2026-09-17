import { resolveKeyValue } from './grade-age.js';
import type { Demographics, KeyingStrategy, LookupRow, MatchMode, NormResolution } from './types.js';

/** Decimal places IRT theta values are matched at. Tables are published on a 0.1 grid. */
export const THETA_MATCH_DECIMALS = 1;

/**
 * Column names that score-table CSVs use for blank/index columns. The assessments strip these
 * (`_omit(row.data, ['', 'X'])`) before keeping a row; {@link extractNormedScores} drops them too.
 */
export const BLANK_COLUMN_KEYS: readonly string[] = ['', 'X'];

/**
 * Round a theta to the table's matching precision (1 decimal).
 *
 * @param theta - A theta value
 * @returns The theta rounded to {@link THETA_MATCH_DECIMALS} decimals
 */
export function roundTheta(theta: number): number {
  return Number(theta.toFixed(THETA_MATCH_DECIMALS));
}

/** Compare a participant score to a cell value under the given match mode. */
function scoresMatch(participantScore: number, cell: LookupRow[string], matchMode: MatchMode): boolean {
  if (cell == null) {
    return false;
  }
  const cellNumber = Number(cell);
  if (!Number.isFinite(cellNumber)) {
    return false;
  }
  if (matchMode === 'theta') {
    return roundTheta(cellNumber) === roundTheta(participantScore);
  }
  return cellNumber === participantScore;
}

/**
 * Whether a row matches a demographic key value (e.g. `Number(row.ageMonths) === 84`).
 *
 * Useful in a Papaparse `step` callback to pre-filter rows to the participant's age/grade while
 * streaming, so only the relevant rows are retained in memory.
 *
 * @param row - A parsed lookup row
 * @param keyColumn - The demographic key column (e.g. `'ageMonths'`)
 * @param keyValue - The clamped demographic value to match
 * @returns `true` when `Number(row[keyColumn]) === keyValue`
 */
export function rowMatchesKey(row: LookupRow, keyColumn: string, keyValue: number): boolean {
  return Number(row[keyColumn]) === keyValue;
}

/** Parameters for {@link selectNormRow}. */
export interface RowSelector {
  /** Demographic key column, e.g. `'ageMonths'`. Omit to match on score only (pre-filtered rows). */
  keyColumn?: string;
  /** The clamped demographic value to match. Required when {@link keyColumn} is set. */
  keyValue?: number;
  /** The score column to match, e.g. `'thetaEstimate'`. */
  scoreColumn: string;
  /** The participant score to match. */
  scoreValue: number;
  /** How to compare {@link scoreColumn}. */
  matchMode: MatchMode;
}

/**
 * Find the first row matching the selector's demographic key (if given) and score.
 *
 * When `keyColumn` is omitted the rows are assumed already filtered to the participant's
 * demographic (the assessments do this while parsing), so only the score is matched.
 *
 * @param rows - Parsed lookup rows
 * @param selector - Key/score matching parameters
 * @returns The matched row, or `undefined`
 */
export function selectNormRow(rows: readonly LookupRow[], selector: RowSelector): LookupRow | undefined {
  const { keyColumn, keyValue, scoreColumn, scoreValue, matchMode } = selector;
  return rows.find((row) => {
    if (keyColumn !== undefined && keyValue !== undefined && !rowMatchesKey(row, keyColumn, keyValue)) {
      return false;
    }
    return scoresMatch(scoreValue, row[scoreColumn], matchMode);
  });
}

/**
 * Extract the normed columns from a matched row, dropping blank/index columns, the key and score
 * columns, any caller-specified columns, and null/undefined cells. Remaining values (percentile,
 * standardScore, roarScore, …) are passed through verbatim — including string sentinels like
 * `">99"` / `"<1"`.
 *
 * @param row - The matched lookup row
 * @param options.omitColumns - Columns to drop in addition to the blank/index columns
 * @returns A plain object of the normed columns
 */
export function extractNormedScores(
  row: LookupRow,
  options: { omitColumns?: readonly string[] } = {},
): Record<string, string | number> {
  const omit = new Set<string>([...BLANK_COLUMN_KEYS, ...(options.omitColumns ?? [])]);
  const normed: Record<string, string | number> = {};
  for (const [column, value] of Object.entries(row)) {
    if (omit.has(column) || value == null) {
      continue;
    }
    normed[column] = value;
  }
  return normed;
}

/**
 * Resolve normed scores for a participant against a parsed norm table, end to end:
 * derive + clamp the demographic key, find the matching row by key + score, and extract the
 * normed columns.
 *
 * This is the single high-level entry point both the assessments and the backend use, so the
 * keying logic that is easy to get subtly wrong lives in exactly one place.
 *
 * @param args.rows - The parsed (optionally pre-filtered) lookup rows
 * @param args.strategy - How to key into this table
 * @param args.demographics - Participant age and/or grade
 * @param args.score - The participant score to match (theta, raw count, …)
 * @returns The resolution, or `null` when the demographic is unavailable, the score is non-finite,
 *   or no row matches
 */
export function resolveNormedScores(args: {
  rows: readonly LookupRow[];
  strategy: KeyingStrategy;
  demographics: Demographics;
  score: number;
}): NormResolution | null {
  const { rows, strategy, demographics, score } = args;

  if (!Number.isFinite(score)) {
    return null;
  }

  const keyValue = resolveKeyValue(strategy, demographics);
  if (keyValue === null) {
    return null;
  }

  const row = selectNormRow(rows, {
    keyColumn: strategy.keyColumn,
    keyValue,
    scoreColumn: strategy.scoreColumn,
    scoreValue: score,
    matchMode: strategy.matchMode,
  });
  if (!row) {
    return null;
  }

  const normedScores = extractNormedScores(row, {
    omitColumns: [strategy.keyColumn, strategy.scoreColumn, ...(strategy.omitColumns ?? [])],
  });

  return { keyValue, row, normedScores };
}
