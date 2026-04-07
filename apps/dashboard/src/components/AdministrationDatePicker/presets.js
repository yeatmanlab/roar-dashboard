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
 * Dates are generated in UTC. The presets rotate based on the current date:
 * - Current season starts from today (or March 31 for Spring) and ends on its scheduled end date
 * - Remaining seasons follow in order: Summer, Fall, Winter, Spring (next year)
 * - The rotation ensures that when a season ends, it moves to the end of the list
 *
 * @param {Date} referenceDate
 * @returns {Object}
 */
export function generateDatePresets(referenceDate = new Date()) {
  const now = referenceDate;
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth();
  const currentDay = now.getUTCDate();

  // Define all season boundaries for the current and next year
  const seasonDates = [
    {
      key: 'spring',
      label: 'Spring',
      startMonth: 3,
      startDay: 1,
      endMonth: 5,
      endDay: 14,
    },
    {
      key: 'summer',
      label: 'Summer',
      startMonth: 5,
      startDay: 15,
      endMonth: 7,
      endDay: 1,
    },
    {
      key: 'fall',
      label: 'Fall',
      startMonth: 7,
      startDay: 1,
      endMonth: 11,
      endDay: 1,
    },
    {
      key: 'winter',
      label: 'Winter',
      startMonth: 11,
      startDay: 1,
      endMonth: 3,
      endDay: 1,
      crossesYear: true,
    },
  ];

  // Determine which season is currently active
  let currentSeasonIndex = -1;

  for (let i = 0; i < seasonDates.length; i++) {
    const season = seasonDates[i];
    let startDate, endDate;

    if (season.crossesYear) {
      // Winter: December 1 to April 1 (next year)
      const winterStartYear = currentMonth <= 2 ? currentYear - 1 : currentYear;
      startDate = createUTCDate(winterStartYear, season.startMonth, season.startDay);
      endDate = createUTCDate(winterStartYear + 1, season.endMonth, season.endDay);
    } else {
      startDate = createUTCDate(currentYear, season.startMonth, season.startDay);
      endDate = createUTCDate(currentYear, season.endMonth, season.endDay);
    }

    // Check if current date falls within this season
    if (now >= startDate && now < endDate) {
      currentSeasonIndex = i;
      break;
    }
  }

  // If no season found, default to Winter (for dates before Spring starts)
  if (currentSeasonIndex === -1) {
    currentSeasonIndex = 3; // Winter
  }

  // Build the rotated preset list starting with the current season
  const presets = [];
  const baseYear = currentYear;

  for (let i = 0; i < 4; i++) {
    const seasonIndex = (currentSeasonIndex + i) % 4;
    const season = seasonDates[seasonIndex];
    let startDate, endDate;

    // Calculate year offset based on whether we've wrapped around
    let yearOffset = 0;
    if (i > 0 && seasonIndex < currentSeasonIndex) {
      // We've wrapped around, so this season is in the next year
      yearOffset = 1;
    }

    if (i === 0) {
      // Current season: starts from today (or March 31 for Spring if before that date)
      if (season.key === 'spring' && (currentMonth < 3 || (currentMonth === 3 && currentDay < 1))) {
        startDate = createUTCDate(baseYear, 2, 31);
      } else {
        // For all other cases, use today's date
        startDate = createUTCDate(baseYear, currentMonth, currentDay);
      }
      // Current season end date is in the same year, unless it's Winter which crosses the year
      if (season.crossesYear) {
        endDate = createUTCDate(baseYear + 1, season.endMonth, season.endDay);
      } else {
        endDate = createUTCDate(baseYear, season.endMonth, season.endDay);
      }
    } else {
      // Future seasons: use their standard dates
      if (season.crossesYear) {
        startDate = createUTCDate(baseYear + yearOffset, season.startMonth, season.startDay);
        endDate = createUTCDate(baseYear + yearOffset + 1, season.endMonth, season.endDay);
      } else {
        startDate = createUTCDate(baseYear + yearOffset, season.startMonth, season.startDay);
        endDate = createUTCDate(baseYear + yearOffset, season.endMonth, season.endDay);
      }
    }

    presets.push({
      key: season.key,
      label: season.label,
      start: startDate,
      end: endDate,
    });
  }

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
