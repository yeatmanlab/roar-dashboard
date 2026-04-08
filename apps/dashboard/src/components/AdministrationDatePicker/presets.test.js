import { generateDatePresets } from './presets';

describe('generateDatePresets', () => {
  let originalDate;

  beforeEach(() => {
    // Store the original Date
    originalDate = global.Date;
  });

  afterEach(() => {
    // Restore the original Date
    global.Date = originalDate;
  });

  const mockDate = (isoDate) => {
    const mockDateValue = new Date(isoDate);
    const OriginalDate = global.Date;

    global.Date = class extends OriginalDate {
      constructor(...args) {
        // If no arguments, return the mocked date (for new Date())
        // Otherwise, use the original Date constructor
        if (args.length === 0) {
          super(mockDateValue.getTime());
        } else {
          super(...args);
        }
      }

      static UTC(...args) {
        return OriginalDate.UTC(...args);
      }
    };

    return mockDateValue;
  };

  test('generates correct date ranges for current year when all dates are in future', () => {
    // Mock current date to January 1st, 2025
    mockDate('2025-01-01T00:00:00Z');

    const presets = generateDatePresets(new Date('2025-01-01T00:00:00Z'));

    // In January, winter is active (Dec 1, 2024 - Apr 1, 2025)
    // Rotation: Winter, Spring, Summer, Fall
    // Spring/Summer/Fall are in 2025 because they haven't happened yet this year
    expect(presets).toEqual({
      winter: {
        label: 'Winter',
        start: new Date('2025-01-01T00:00:00Z'),
        end: new Date('2025-04-01T00:00:00Z'),
        startDate: '2025-01-01',
        endDate: '2025-04-01',
      },
      spring: {
        label: 'Spring',
        start: new Date('2025-04-01T00:00:00Z'),
        end: new Date('2025-06-14T00:00:00Z'),
        startDate: '2025-04-01',
        endDate: '2025-06-14',
      },
      summer: {
        label: 'Summer',
        start: new Date('2025-06-15T00:00:00Z'),
        end: new Date('2025-08-01T00:00:00Z'),
        startDate: '2025-06-15',
        endDate: '2025-08-01',
      },
      fall: {
        label: 'Fall',
        start: new Date('2025-08-01T00:00:00Z'),
        end: new Date('2025-12-01T00:00:00Z'),
        startDate: '2025-08-01',
        endDate: '2025-12-01',
      },
    });
  });

  test('moves past dates to next year', () => {
    // Mock current date to September 15th, 2025
    mockDate('2025-09-15T00:00:00Z');

    const presets = generateDatePresets(new Date('2025-09-15T00:00:00Z'));

    // In September, fall is active (Aug 1 - Dec 1)
    // Rotation: Fall, Winter, Spring, Summer
    expect(presets).toEqual({
      fall: {
        label: 'Fall',
        start: new Date('2025-09-15T00:00:00Z'),
        end: new Date('2025-12-01T00:00:00Z'),
        startDate: '2025-09-15',
        endDate: '2025-12-01',
      },
      winter: {
        label: 'Winter',
        start: new Date('2025-12-01T00:00:00Z'),
        end: new Date('2026-04-01T00:00:00Z'),
        startDate: '2025-12-01',
        endDate: '2026-04-01',
      },
      spring: {
        label: 'Spring',
        start: new Date('2026-04-01T00:00:00Z'),
        end: new Date('2026-06-14T00:00:00Z'),
        startDate: '2026-04-01',
        endDate: '2026-06-14',
      },
      summer: {
        label: 'Summer',
        start: new Date('2026-06-15T00:00:00Z'),
        end: new Date('2026-08-01T00:00:00Z'),
        startDate: '2026-06-15',
        endDate: '2026-08-01',
      },
    });
  });

  test('handles year transition correctly during winter', () => {
    // Mock current date to December 15th, 2025
    mockDate('2025-12-15T00:00:00Z');

    const presets = generateDatePresets(new Date('2025-12-15T00:00:00Z'));

    // In December, winter is active (Dec 1, 2025 - Apr 1, 2026)
    // Rotation: Winter, Spring, Summer, Fall
    expect(presets).toEqual({
      winter: {
        label: 'Winter',
        start: new Date('2025-12-15T00:00:00Z'),
        end: new Date('2026-04-01T00:00:00Z'),
        startDate: '2025-12-15',
        endDate: '2026-04-01',
      },
      spring: {
        label: 'Spring',
        start: new Date('2026-04-01T00:00:00Z'),
        end: new Date('2026-06-14T00:00:00Z'),
        startDate: '2026-04-01',
        endDate: '2026-06-14',
      },
      summer: {
        label: 'Summer',
        start: new Date('2026-06-15T00:00:00Z'),
        end: new Date('2026-08-01T00:00:00Z'),
        startDate: '2026-06-15',
        endDate: '2026-08-01',
      },
      fall: {
        label: 'Fall',
        start: new Date('2026-08-01T00:00:00Z'),
        end: new Date('2026-12-01T00:00:00Z'),
        startDate: '2026-08-01',
        endDate: '2026-12-01',
      },
    });
  });

  test('handles crossover from winter to new year correctly', () => {
    // Mock current date to January 15th, 2027 (in winter that started Dec 1, 2026)
    mockDate('2027-01-15T00:00:00Z');

    const presets = generateDatePresets(new Date('2027-01-15T00:00:00Z'));

    // In January 2027, winter is active (Dec 1, 2026 - Apr 1, 2027)
    // Rotation: Winter, Spring, Summer, Fall
    // All subsequent seasons should be in 2027, not 2028
    expect(presets).toEqual({
      winter: {
        label: 'Winter',
        start: new Date('2027-01-15T00:00:00Z'),
        end: new Date('2027-04-01T00:00:00Z'),
        startDate: '2027-01-15',
        endDate: '2027-04-01',
      },
      spring: {
        label: 'Spring',
        start: new Date('2027-04-01T00:00:00Z'),
        end: new Date('2027-06-14T00:00:00Z'),
        startDate: '2027-04-01',
        endDate: '2027-06-14',
      },
      summer: {
        label: 'Summer',
        start: new Date('2027-06-15T00:00:00Z'),
        end: new Date('2027-08-01T00:00:00Z'),
        startDate: '2027-06-15',
        endDate: '2027-08-01',
      },
      fall: {
        label: 'Fall',
        start: new Date('2027-08-01T00:00:00Z'),
        end: new Date('2027-12-01T00:00:00Z'),
        startDate: '2027-08-01',
        endDate: '2027-12-01',
      },
    });
  });

  test('handles last day of winter before spring correctly', () => {
    // Mock current date to March 31st, 2027 (last day of winter, before spring starts)
    mockDate('2027-03-31T00:00:00Z');

    const presets = generateDatePresets(new Date('2027-03-31T00:00:00Z'));

    // On March 31, 2027, winter is still active (Dec 1, 2026 - Apr 1, 2027)
    // Rotation: Winter, Spring, Summer, Fall - all in 2027
    expect(presets).toEqual({
      winter: {
        label: 'Winter',
        start: new Date('2027-03-31T00:00:00Z'),
        end: new Date('2027-04-01T00:00:00Z'),
        startDate: '2027-03-31',
        endDate: '2027-04-01',
      },
      spring: {
        label: 'Spring',
        start: new Date('2027-04-01T00:00:00Z'),
        end: new Date('2027-06-14T00:00:00Z'),
        startDate: '2027-04-01',
        endDate: '2027-06-14',
      },
      summer: {
        label: 'Summer',
        start: new Date('2027-06-15T00:00:00Z'),
        end: new Date('2027-08-01T00:00:00Z'),
        startDate: '2027-06-15',
        endDate: '2027-08-01',
      },
      fall: {
        label: 'Fall',
        start: new Date('2027-08-01T00:00:00Z'),
        end: new Date('2027-12-01T00:00:00Z'),
        startDate: '2027-08-01',
        endDate: '2027-12-01',
      },
    });
  });
});
