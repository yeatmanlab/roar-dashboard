/**
 * Creates a UTC date for the given year, month, and day.
 *
 * @param {number} year - The year of the date.
 * @param {number} month - The month of the date (0-11).
 * @param {number} day - The day of the date (1-31).
 * @returns {Date} The UTC date.
 */
function createUTCDate(year, month, day) {
  // Create date at UTC midnight.
  return new Date(Date.UTC(year, month, day));
}

/**
 * Creates an object containing the administration date presets (Spring/Summer/Fall/Winter).
 *
 * Dates are generated in UTC. Winter is anchored to the “current winter administration”:
 * - If today is in Jan/Feb/Mar, Winter started Dec 1 of the previous year.
 * - Otherwise, Winter starts Dec 1 of the current year.
 *
 * This avoids incorrectly selecting the *next* winter at the start of a new calendar year.
 *
 * @returns {Object} An object containing the date presets keyed by season.
 */

export function generateDatePresets(referenceDate = new Date()) {
  const now = referenceDate;
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth();

  // If we’re in Jan/Feb/Mar, the “current winter” started last year.
  const winterStartYear = currentMonth <= 2 ? currentYear - 1 : currentYear;
  // Create initial presets
  const presets = [
    {
      key: 'summer',
      label: 'Summer',
      start: createUTCDate(currentYear, 5, 16), // June 16th
      end: createUTCDate(currentYear, 7, 1), // August 1st
    },
    {
      key: 'fall',
      label: 'Fall',
      start: createUTCDate(currentYear, 7, 1), // August 1st
      end: createUTCDate(currentYear, 11, 1), // December 1st
    },
    {
      key: 'winter',
      label: 'Winter',
      start: createUTCDate(winterStartYear, 11, 1), // December 1st
      end: createUTCDate(winterStartYear + 1, 3, 1), // April 1st
    },
    {
      key: 'spring',
      label: 'Spring',
      start: createUTCDate(currentYear, 3, 1), // April 1st
      end: createUTCDate(currentYear, 5, 16), // June 16th
    },
  ];

  // Sort by start date
  presets.sort((a, b) => a.start - b.start);

  return Object.fromEntries(presets.map(({ key, label, start, end }) => [key, { label, start, end }]));
}

export const datePresets = Object.freeze(generateDatePresets());
