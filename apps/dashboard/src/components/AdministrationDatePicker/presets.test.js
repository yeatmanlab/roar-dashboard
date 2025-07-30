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
    const mockDate = new Date(isoDate);
    global.Date = class extends Date {
      constructor() {
        super();
        return mockDate;
      }
    };
    return mockDate;
  };

  test('generates correct date ranges for current year when all dates are in future', () => {
    // Mock current date to January 1st, 2025
    mockDate('2025-01-01T00:00:00Z');

    const presets = generateDatePresets();

    expect(presets).toEqual({
      summer: {
        label: 'Summer',
        start: new Date('2025-06-16T00:00:00Z'),
        end: new Date('2025-08-01T00:00:00Z'),
      },
      fall: {
        label: 'Fall',
        start: new Date('2025-08-01T00:00:00Z'),
        end: new Date('2025-12-01T00:00:00Z'),
      },
      winter: {
        label: 'Winter',
        start: new Date('2025-12-01T00:00:00Z'),
        end: new Date('2026-04-01T00:00:00Z'),
      },
      spring: {
        label: 'Spring',
        start: new Date('2025-04-01T00:00:00Z'),
        end: new Date('2025-06-16T00:00:00Z'),
      },
    });
  });

  test('moves past dates to next year', () => {
    // Mock current date to September 15th, 2025
    mockDate('2025-09-15T00:00:00Z');

    const presets = generateDatePresets();

    // Summer and spring should be moved to 2026
    expect(presets).toEqual({
      summer: {
        label: 'Summer',
        start: new Date('2026-06-16T00:00:00Z'),
        end: new Date('2026-08-01T00:00:00Z'),
      },
      fall: {
        label: 'Fall',
        start: new Date('2025-08-01T00:00:00Z'),
        end: new Date('2025-12-01T00:00:00Z'),
      },
      winter: {
        label: 'Winter',
        start: new Date('2025-12-01T00:00:00Z'),
        end: new Date('2026-04-01T00:00:00Z'),
      },
      spring: {
        label: 'Spring',
        start: new Date('2026-04-01T00:00:00Z'),
        end: new Date('2026-06-16T00:00:00Z'),
      },
    });
  });

  test('handles year transition correctly during winter', () => {
    // Mock current date to December 15th, 2025
    mockDate('2025-12-15T00:00:00Z');

    const presets = generateDatePresets();

    // Summer, spring, and fall should be moved to 2026
    expect(presets).toEqual({
      summer: {
        label: 'Summer',
        start: new Date('2026-06-16T00:00:00Z'),
        end: new Date('2026-08-01T00:00:00Z'),
      },
      fall: {
        label: 'Fall',
        start: new Date('2026-08-01T00:00:00Z'),
        end: new Date('2026-12-01T00:00:00Z'),
      },
      winter: {
        label: 'Winter',
        start: new Date('2025-12-01T00:00:00Z'),
        end: new Date('2026-04-01T00:00:00Z'),
      },
      spring: {
        label: 'Spring',
        start: new Date('2026-04-01T00:00:00Z'),
        end: new Date('2026-06-16T00:00:00Z'),
      },
    });
  });
});
