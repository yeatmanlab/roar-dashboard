import type { Demographics, KeyingStrategy, LookupRow } from '@roar-platform/scoring-tables';
import { resolveNormedScores } from '@roar-platform/scoring-tables';
import type { NewRunScore } from '../../db/schema';
import { SCORE_TYPE, SCORE_DOMAIN } from '../../constants/run-scores';
import { FOUNDATIONAL_COMPOSITE_NORM_SCORE_NAMES } from '../../constants/foundational-composite';
import { getGradeAsNumber } from '../../utils/get-grade-as-number.util';
import { getAgeInMonthsFromDob } from '../../utils/get-age-in-months.util';

/** The user fields the composite norming reads to key the lookup table. */
export interface CompositeDemographicSource {
  dob: Date | string | null;
  grade: string | null;
}

/**
 * Resolve the demographic inputs (age-in-months, grade) the composite norm table is keyed by.
 *
 * Age is the user's age **as of `referenceDate`** — the norming reference date, i.e. the date of
 * the latest assessment (see the foundational-composite service). Provisional grade source: the
 * user record's `grade` (→ number via the shared {@link getGradeAsNumber} map); the scoring team
 * may instead key off per-run demographics (`run_demographics`). Kept as a small pure mapper so
 * those decisions are one-line changes with unit tests.
 *
 * @param user - The user's `dob` and `grade`
 * @param referenceDate - The date to compute the participant's age as of (latest-assessment date)
 * @returns Demographics for `@roar-platform/scoring-tables` keying
 */
export function resolveCompositeDemographics(user: CompositeDemographicSource, referenceDate: Date): Demographics {
  return {
    ageMonths: getAgeInMonthsFromDob(user.dob, referenceDate),
    grade: getGradeAsNumber(user.grade),
  };
}

/** Inputs for {@link buildCompositeNormScoreRows}. */
export interface BuildCompositeNormScoreRowsParams {
  runId: string;
  composite: number;
  demographics: Demographics;
  tableRows: readonly LookupRow[];
  keying: KeyingStrategy;
}

/**
 * Resolve the composite's normed scores from the lookup table and build the `run_scores` rows to
 * upsert. Returns an empty array when the demographics are unavailable, no row matches, or the
 * matched row carries none of the recognized normed columns — in each case the caller writes no
 * normed rows (the composite `thetaEstimate` is already persisted).
 *
 * Each recognized lookup column ({@link FOUNDATIONAL_COMPOSITE_NORM_SCORE_NAMES}) becomes a
 * `(computed, composite_foundational, <name>)` row. Values are stringified for the text column,
 * which preserves sentinel strings like `">99"` / `"<1"`.
 *
 * @param params - Run id, composite theta, demographics, parsed table rows, and the keying strategy
 * @returns Zero or more `run_scores` rows ready to upsert
 */
export function buildCompositeNormScoreRows(params: BuildCompositeNormScoreRowsParams): NewRunScore[] {
  const { runId, composite, demographics, tableRows, keying } = params;

  const resolution = resolveNormedScores({
    rows: tableRows,
    strategy: keying,
    demographics,
    score: composite,
  });
  if (!resolution) {
    return [];
  }

  const rows: NewRunScore[] = [];
  for (const [column, scoreName] of Object.entries(FOUNDATIONAL_COMPOSITE_NORM_SCORE_NAMES)) {
    const value = resolution.normedScores[column];
    if (value === undefined) {
      continue;
    }
    rows.push({
      runId,
      type: SCORE_TYPE.COMPUTED,
      domain: SCORE_DOMAIN.COMPOSITE_FOUNDATIONAL,
      name: scoreName,
      value: String(value),
      assessmentStage: null,
      categoryScore: null,
    });
  }
  return rows;
}
