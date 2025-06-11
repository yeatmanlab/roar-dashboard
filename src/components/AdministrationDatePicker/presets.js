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
 * Creates an object containing the date presets.
 * Dates will be in UTC, and will be set for the following year if the current date is past the end of the preset.
 *
 * @returns {Object} An object containing the date presets.
 */
export function generateDatePresets() {
  const now = new Date();
  const currentYear = now.getFullYear();

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
      start: createUTCDate(currentYear, 11, 1), // December 1st
      end: createUTCDate(currentYear + 1, 3, 1), // April 1st
    },
    {
      key: 'spring',
      label: 'Spring',
      start: createUTCDate(currentYear, 3, 1), // April 1st
      end: createUTCDate(currentYear, 5, 16), // June 16th
    },
  ];

  // Determine which presets are in the past, move them to next year
  presets.forEach((preset) => {
    if (now > preset.end) {
      preset.start = createUTCDate(
        preset.start.getUTCFullYear() + 1,
        preset.start.getUTCMonth(),
        preset.start.getUTCDate(),
      );
      preset.end = createUTCDate(preset.end.getUTCFullYear() + 1, preset.end.getUTCMonth(), preset.end.getUTCDate());
    }
  });

  // Sort by start date
  presets.sort((a, b) => a.start - b.start);

  return Object.fromEntries(presets.map(({ key, label, start, end }) => [key, { label, start, end }]));
}

export const datePresets = Object.freeze(generateDatePresets());
