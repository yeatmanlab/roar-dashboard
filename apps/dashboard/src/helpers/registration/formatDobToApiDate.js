/** Matches a bare `YYYY-MM-DD` calendar date, with no time or zone component. */
const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Formats a date of birth into the `YYYY-MM-DD` string required by the typed
 * API (`AddChildSchema.dob` uses `z.string().date()`).
 *
 * The registration form supplies `dob` as a JavaScript `Date` from PrimeVue's
 * `PvDatePicker`, anchored to the user's local midnight. We deliberately format
 * using the local-time getters (`getFullYear`/`getMonth`/`getDate`) rather than
 * `toISOString().slice(0, 10)`: `toISOString()` converts to UTC first, which for
 * any user west of UTC (e.g. US time zones) shifts a local-midnight date back to
 * the previous calendar day — recording the wrong DOB. Local getters preserve
 * the calendar date the user actually selected.
 *
 * Accepts a `Date`, or a string/number that `new Date()` can parse (e.g. an ISO
 * string already in `YYYY-MM-DD` form), and normalizes to `YYYY-MM-DD`.
 *
 * @param {Date|string|number} dob - The date of birth to format.
 * @returns {string} The DOB as a zero-padded `YYYY-MM-DD` string.
 * @throws {Error} If the value is missing or not a valid date.
 */
export function formatDobToApiDate(dob) {
  if (dob === undefined || dob === null || dob === '') {
    throw new Error('Date of birth is required.');
  }

  // A date-only `YYYY-MM-DD` string is already the calendar date we want, and it
  // carries no time zone. It must NOT round-trip through `new Date()`: ECMA-262
  // parses the date-only form as UTC midnight, while the local getters below read
  // it back in local time, so every user west of UTC would record the previous
  // day (`'2015-12-25'` → `'2015-12-24'` in US time zones). Handle it directly.
  if (typeof dob === 'string') {
    const dateOnly = DATE_ONLY_PATTERN.exec(dob.trim());
    if (dateOnly) {
      const [, year, month, day] = dateOnly;
      // `new Date('2015-02-30')` rolls over to March 1 instead of reporting an
      // invalid date, so verify the parsed components match what was supplied
      // rather than trusting the parse to reject impossible dates.
      const parsed = new Date(`${year}-${month}-${day}T00:00:00Z`);
      if (
        Number.isNaN(parsed.getTime()) ||
        parsed.getUTCFullYear() !== Number(year) ||
        parsed.getUTCMonth() + 1 !== Number(month) ||
        parsed.getUTCDate() !== Number(day)
      ) {
        throw new Error('Invalid date of birth.');
      }
      return `${year}-${month}-${day}`;
    }
  }

  const date = dob instanceof Date ? dob : new Date(dob);

  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid date of birth.');
  }

  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export default formatDobToApiDate;
