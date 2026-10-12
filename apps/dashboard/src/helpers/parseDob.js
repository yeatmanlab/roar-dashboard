/**
 * Validate a date of birth and return it as a Date.
 *
 * Requires a 4-digit year to avoid ambiguous 2-digit-year parsing (e.g. 1/2/12).
 * Expects MM/DD/YYYY or MM-DD-YYYY (e.g. 2/1/2020, 2-1-2020, 02/01/2020).
 *
 * @param {String} dob - The date of birth to validate.
 * @returns {Date|null} The parsed date, or null if invalid.
 */
export const parseDob = (dob) => {
  const DOB_REGEX = /^(\d{1,2})([/-])(\d{1,2})\2(\d{4})$/;
  const match = DOB_REGEX.exec(String(dob).trim());
  if (!match) return null;

  const [, monthStr, , dayStr, yearStr] = match;
  const month = Number(monthStr);
  const day = Number(dayStr);
  const year = Number(yearStr);

  const date = new Date(year, month - 1, day);
  // Reject dates like 2/30/2020 that overflow into the next month
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  if (date > new Date()) return null;

  return date;
};
