/**
 * Compute a user's age in whole months from their date of birth.
 *
 * Mirrors the UTC-based approach in `is-majority-age.util.ts` to avoid timezone off-by-one
 * errors: date-only strings (`YYYY-MM-DD`, how Postgres `date` columns deserialize) are parsed
 * as UTC midnight, so UTC accessors are used throughout. Returns completed months — the day of
 * month is used to decide whether the final month has elapsed.
 *
 * Used by the foundational-composite norming to key the lookup table by age-in-months. `asOf` is
 * **required** and must be the norming reference date — the date of the assessment, NOT
 * processing-time "now" — so a re-run or backfill computes the same age as the original scoring.
 *
 * @param dob - Date of birth (Date or ISO date string); `null`/`undefined` yields `null`
 * @param asOf - Reference date to measure age against (the assessment date)
 * @returns Whole months of age (>= 0), or `null` when `dob` is missing or unparseable
 */
export function getAgeInMonthsFromDob(dob: Date | string | null | undefined, asOf: Date): number | null {
  if (dob == null) {
    return null;
  }

  const dobDate = typeof dob === 'string' ? new Date(dob) : dob;
  if (Number.isNaN(dobDate.getTime())) {
    return null;
  }

  let months = (asOf.getUTCFullYear() - dobDate.getUTCFullYear()) * 12 + (asOf.getUTCMonth() - dobDate.getUTCMonth());

  // The current month has not fully elapsed if today's day-of-month precedes the birth day.
  if (asOf.getUTCDate() < dobDate.getUTCDate()) {
    months -= 1;
  }

  return months < 0 ? 0 : months;
}
