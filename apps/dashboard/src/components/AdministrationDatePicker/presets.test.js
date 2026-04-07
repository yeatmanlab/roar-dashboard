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
    // Note: Spring/Summer/Fall are in 2026 because we're past their 2025 dates
    expect(presets).toEqual({
      winter: {
        label: 'Winter',
        start: new Date('2025-01-01T00:00:00Z'),
        end: new Date('2026-04-01T00:00:00Z'),
        startDate: '2025-01-01',
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
});
