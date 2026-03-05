/**
 * Creates a UTC date for the given year, month, and day.
 *
 * @param {number} year
 * @param {number} month - 0–11
 * @param {number} day - 1–31
 * @returns {Date}
 */
function createUTCDate(year, month, day) {
  return new Date(Date.UTC(year, month, day));
}

/**
 * Converts a Date to a UTC date-only string in YYYY-MM-DD format.
 *
 * @param {Date} date
 * @returns {string}
 */
function toUTCDateOnlyString(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Creates an object containing the administration date presets (Spring/Summer/Fall/Winter).
 *
 * Dates are generated in UTC. Winter is anchored to the “current winter administration”:
 * - If today is in Jan/Feb/Mar, Winter started Dec 1 of the previous year.
 * - Otherwise, Winter starts Dec 1 of the current year.
 *
 * @param {Date} referenceDate
 * @returns {Object}
 */
export function generateDatePresets(referenceDate = new Date()) {
  const now = referenceDate;
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth();

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
  presets.sort((a, b) => a.start.getTime() - b.start.getTime());

  return Object.fromEntries(
    presets.map(({ key, label, start, end }) => [
      key,
      {
        label,
        start,
        end,
        startDate: toUTCDateOnlyString(start),
        endDate: toUTCDateOnlyString(end),
      },
    ]),
  );
}

export const datePresets = Object.freeze(generateDatePresets());
