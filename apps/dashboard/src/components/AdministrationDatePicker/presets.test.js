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

    const presets = generateDatePresets();

    // In January, winter is anchored to previous year (2024)
    expect(presets).toEqual({
      summer: {
        label: 'Summer',
        start: new Date('2025-06-16T00:00:00Z'),
        end: new Date('2025-08-01T00:00:00Z'),
        startDate: '2025-06-16',
        endDate: '2025-08-01',
      },
      fall: {
        label: 'Fall',
        start: new Date('2025-08-01T00:00:00Z'),
        end: new Date('2025-12-01T00:00:00Z'),
        startDate: '2025-08-01',
        endDate: '2025-12-01',
      },
      winter: {
        label: 'Winter',
        start: new Date('2024-12-01T00:00:00Z'),
        end: new Date('2025-04-01T00:00:00Z'),
        startDate: '2024-12-01',
        endDate: '2025-04-01',
      },
      spring: {
        label: 'Spring',
        start: new Date('2025-04-01T00:00:00Z'),
        end: new Date('2025-06-16T00:00:00Z'),
        startDate: '2025-04-01',
        endDate: '2025-06-16',
      },
    });
  });

  test('moves past dates to next year', () => {
    // Mock current date to September 15th, 2025
    mockDate('2025-09-15T00:00:00Z');

    const presets = generateDatePresets();

    // Summer and spring should stay in 2025, winter anchored to 2025
    expect(presets).toEqual({
      summer: {
        label: 'Summer',
        start: new Date('2025-06-16T00:00:00Z'),
        end: new Date('2025-08-01T00:00:00Z'),
        startDate: '2025-06-16',
        endDate: '2025-08-01',
      },
      fall: {
        label: 'Fall',
        start: new Date('2025-08-01T00:00:00Z'),
        end: new Date('2025-12-01T00:00:00Z'),
        startDate: '2025-08-01',
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
        start: new Date('2025-04-01T00:00:00Z'),
        end: new Date('2025-06-16T00:00:00Z'),
        startDate: '2025-04-01',
        endDate: '2025-06-16',
      },
    });
  });

  test('handles year transition correctly during winter', () => {
    // Mock current date to December 15th, 2025
    mockDate('2025-12-15T00:00:00Z');

    const presets = generateDatePresets();

    // During winter (Dec-Feb), winter is anchored to current year, others to current year
    expect(presets).toEqual({
      summer: {
        label: 'Summer',
        start: new Date('2025-06-16T00:00:00Z'),
        end: new Date('2025-08-01T00:00:00Z'),
        startDate: '2025-06-16',
        endDate: '2025-08-01',
      },
      fall: {
        label: 'Fall',
        start: new Date('2025-08-01T00:00:00Z'),
        end: new Date('2025-12-01T00:00:00Z'),
        startDate: '2025-08-01',
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
        start: new Date('2025-04-01T00:00:00Z'),
        end: new Date('2025-06-16T00:00:00Z'),
        startDate: '2025-04-01',
        endDate: '2025-06-16',
      },
    });
  });
});
