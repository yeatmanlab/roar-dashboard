/**
 * @roar-platform/scoring-tables
 *
 * Pure, I/O-free helpers for reading lookup-table norms. The ROAR assessments (PA, SWR, SRE,
 * Letter, Multichoice) and the backend foundational-composite norming all key into versioned CSV
 * norm tables the same way: derive a demographic key (age-in-months, with a grade fallback, or
 * grade), clamp it, find the row matching that key and the participant's score (theta on a 0.1
 * grid, or an exact raw count), then read the remaining columns as normed scores.
 *
 * That keying logic is small but easy to get subtly wrong (scale/precision, clamping, the
 * grade → age heuristic), and previously each assessment re-implemented it. This package is the
 * single shared implementation. CSV fetching/parsing stays with each caller (Papaparse in the
 * browser, axios + papaparse on the backend); only the parsed rows + a {@link KeyingStrategy}
 * come in here.
 */
export type {
  ClampRange,
  Demographics,
  KeyKind,
  KeyingStrategy,
  LookupRow,
  MatchMode,
  NormResolution,
} from './types.js';

export {
  GRADE_TO_AGE_INTERCEPT_MONTHS,
  MONTHS_PER_GRADE,
  clampToRange,
  deriveAgeMonths,
  resolveKeyValue,
} from './grade-age.js';

export {
  BLANK_COLUMN_KEYS,
  THETA_MATCH_DECIMALS,
  extractNormedScores,
  resolveNormedScores,
  roundTheta,
  rowMatchesKey,
  selectNormRow,
} from './lookup.js';
export type { RowSelector } from './lookup.js';
