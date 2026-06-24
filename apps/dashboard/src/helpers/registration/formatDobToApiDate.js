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
