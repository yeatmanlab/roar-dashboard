import type { ClampRange, Demographics, KeyingStrategy } from './types.js';

/**
 * Grade → age-in-months heuristic.
 *
 * `ageMonths = GRADE_TO_AGE_INTERCEPT_MONTHS + grade * MONTHS_PER_GRADE`
 *
 * Maps a grade to a representative mid-year age when a participant's age is unknown:
 * Kindergarten (grade 0) → 66 months (5.5 years), grade 1 → 78, grade 2 → 90, … This is the
 * same mapping the roar-swr, roar-sre, roar-letter, and roar-multichoice assessments use, kept
 * here as named constants so the assumption is explicit rather than a bare `66 + g * 12`.
 */
export const GRADE_TO_AGE_INTERCEPT_MONTHS = 66;

/** Months added per grade level in the grade → age heuristic. See {@link GRADE_TO_AGE_INTERCEPT_MONTHS}. */
export const MONTHS_PER_GRADE = 12;

/** Whether a demographic value is usable (present and finite). */
function isUsableNumber(value: number | null | undefined): value is number {
  return value != null && Number.isFinite(value);
}

/**
 * Derive age-in-months from demographics, falling back to grade via the linear heuristic.
 *
 * @param demographics - Participant age and/or grade
 * @returns Age in months, or `null` when neither age nor grade is usable
 */
export function deriveAgeMonths(demographics: Demographics): number | null {
  const { ageMonths, grade } = demographics;
  if (isUsableNumber(ageMonths)) {
    return ageMonths;
  }
  if (isUsableNumber(grade)) {
    return GRADE_TO_AGE_INTERCEPT_MONTHS + grade * MONTHS_PER_GRADE;
  }
  return null;
}

/**
 * Clamp a value to an inclusive range. An omitted bound leaves that side unbounded.
 *
 * @param value - The value to clamp
 * @param range - Optional `{ min, max }` bounds
 * @returns The value constrained to `[min, max]`
 */
export function clampToRange(value: number, range: ClampRange | undefined): number {
  if (!range) {
    return value;
  }
  let clamped = value;
  if (range.min != null && clamped < range.min) {
    clamped = range.min;
  }
  if (range.max != null && clamped > range.max) {
    clamped = range.max;
  }
  return clamped;
}

/**
 * Resolve the (clamped) demographic key value a strategy will look up by.
 *
 * - `keyKind: 'ageMonths'` derives age (with the grade fallback) then clamps.
 * - `keyKind: 'grade'` uses the raw grade then clamps.
 *
 * Exposed on its own so a caller can compute the key once and reuse it both to pre-filter the
 * CSV during parsing and to select the matching row, keeping a single source of truth.
 *
 * @param strategy - The keying strategy (only `keyKind` and `clamp` are used)
 * @param demographics - Participant age and/or grade
 * @returns The clamped key value, or `null` when the required demographic is unavailable
 */
export function resolveKeyValue(
  strategy: Pick<KeyingStrategy, 'keyKind' | 'clamp'>,
  demographics: Demographics,
): number | null {
  const raw =
    strategy.keyKind === 'ageMonths'
      ? deriveAgeMonths(demographics)
      : isUsableNumber(demographics.grade)
        ? demographics.grade
        : null;

  if (raw === null) {
    return null;
  }
  return clampToRange(raw, strategy.clamp);
}
