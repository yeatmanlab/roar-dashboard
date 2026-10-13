/**
 * Validate a date of birth and return it as a Date.
 *
 * Accepts two unambiguous forms, with either separator used consistently:
 * - US:  MM/DD/YYYY or MM-DD-YYYY (e.g. 2/1/2020, 2-1-2020, 02/01/2020)
 * - ISO: YYYY/MM/DD or YYYY-MM-DD (e.g. 1999/1/2, 1999-01-02)
 *
 * Month and day may be single-digit in either form. A 4-digit leading group is
 * unambiguously a year, so the two forms cannot be confused with one another.
 *
 * Requires a 4-digit year to avoid ambiguous 2-digit-year parsing (e.g. 1/2/12).
 *
 * @param {String} dob - The date of birth to validate.
 * @returns {Date|null} The parsed date, or null if invalid.
 */
export const parseDob = (dob) => {
  const US_DOB_REGEX = /^(\d{1,2})([/-])(\d{1,2})\2(\d{4})$/;
  const ISO_DOB_REGEX = /^(\d{4})([/-])(\d{1,2})\2(\d{1,2})$/;

  const input = String(dob).trim();
  const usMatch = US_DOB_REGEX.exec(input);
  const isoMatch = usMatch ? null : ISO_DOB_REGEX.exec(input);
  if (!usMatch && !isoMatch) return null;

  const [, monthStr, , dayStr, yearStr] = usMatch ?? [];
  const [, isoYearStr, , isoMonthStr, isoDayStr] = isoMatch ?? [];

  const month = Number(usMatch ? monthStr : isoMonthStr);
  const day = Number(usMatch ? dayStr : isoDayStr);
  const year = Number(usMatch ? yearStr : isoYearStr);

  const date = new Date(year, month - 1, day);
  // Reject dates like 2/30/2020 that overflow into the next month
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  if (date > new Date()) return null;

  return date;
};
