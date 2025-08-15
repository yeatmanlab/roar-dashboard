import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { checkConsentRenewalDate } from './checkConsentRenewalDate';

describe('checkConsentRenewalDate', () => {
  beforeEach(() => {
    // Reset any date mocks before each test
    vi.useRealTimers();

    // Set timezone to UTC for consistent test behavior
    vi.stubEnv('TZ', 'UTC');
  });

  afterEach(() => {
    // Clean up environment stubs
    vi.unstubAllEnvs();
  });

  describe('input validation', () => {
    it('should return false when userLegalDocs is null', () => {
      expect(checkConsentRenewalDate(null)).toBe(false);
    });

    it('should return false when userLegalDocs is undefined', () => {
      expect(checkConsentRenewalDate(undefined)).toBe(false);
    });

    it('should return false when userLegalDocs is not an array', () => {
      expect(checkConsentRenewalDate('not an array')).toBe(false);
      expect(checkConsentRenewalDate({})).toBe(false);
      expect(checkConsentRenewalDate(123)).toBe(false);
    });

    it('should return false when userLegalDocs is an empty array', () => {
      expect(checkConsentRenewalDate([])).toBe(false);
    });
  });

  describe('date logic', () => {
    it('should return false when documents have no dateSigned field', () => {
      const userLegalDocs = [
        { id: 1, type: 'consent' },
        { id: 2, type: 'privacy' },
      ];
      expect(checkConsentRenewalDate(userLegalDocs)).toBe(false);
    });

    it('should return false when documents have null/undefined dateSigned', () => {
      const userLegalDocs = [
        { id: 1, dateSigned: null },
        { id: 2, dateSigned: undefined },
      ];
      expect(checkConsentRenewalDate(userLegalDocs)).toBe(false);
    });

    it('should return false when documents have invalid dateSigned', () => {
      const userLegalDocs = [
        { id: 1, dateSigned: 'invalid-date' },
        { id: 2, dateSigned: '' },
      ];
      expect(checkConsentRenewalDate(userLegalDocs)).toBe(false);
    });

    it('should accept Date instances and epoch milliseconds', () => {
      // Freeze "now" after Aug 1 to compare against the current-year cutoff
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-10-15T10:00:00Z'));

      const asDate = new Date('2024-09-01T00:00:00Z');
      const asEpoch = Date.parse('2024-09-01T00:00:00Z');

      expect(checkConsentRenewalDate([{ id: 1, dateSigned: asDate }])).toBe(true);
      expect(checkConsentRenewalDate([{ id: 2, dateSigned: asEpoch }])).toBe(true);
    });
  });

  describe('consent renewal logic - current date after August 1st', () => {
    beforeEach(() => {
      // Mock current date to be October 15, 2024 (after August 1st)
      const mockDate = new Date('2024-10-15T10:00:00Z');
      vi.useFakeTimers();
      vi.setSystemTime(mockDate);
    });

    it('should return true when document signed after current year August 1st', () => {
      const userLegalDocs = [
        { id: 1, dateSigned: '2024-08-15T10:00:00Z' }, // After Aug 1, 2024
      ];
      expect(checkConsentRenewalDate(userLegalDocs)).toBe(true);
    });

    it('should return false when document signed before current year August 1st', () => {
      const userLegalDocs = [
        { id: 1, dateSigned: '2024-07-15T10:00:00Z' }, // Before Aug 1, 2024
      ];
      expect(checkConsentRenewalDate(userLegalDocs)).toBe(false);
    });

    it('should return false when document signed on August 1st exactly at 00:00:00Z', () => {
      // Midnight PT on Aug 1 == 07:00:00Z (PDT). Exact midnight is NOT counted (exclusive).
      const userLegalDocs = [{ id: 1, dateSigned: '2024-08-01T00:00:00Z' }];
      expect(checkConsentRenewalDate(userLegalDocs)).toBe(false);
    });

    it('should return false when document signed in previous year', () => {
      const userLegalDocs = [
        { id: 1, dateSigned: '2023-12-15T10:00:00Z' }, // Previous year
      ];
      expect(checkConsentRenewalDate(userLegalDocs)).toBe(false);
    });

    it('should return true when at least one document is signed after August 1st', () => {
      const userLegalDocs = [
        { id: 1, dateSigned: '2024-07-15T10:00:00Z' }, // Before Aug 1, 2024
        { id: 2, dateSigned: '2024-09-15T10:00:00Z' }, // After Aug 1, 2024
        { id: 3, dateSigned: '2023-12-15T10:00:00Z' }, // Previous year
      ];
      expect(checkConsentRenewalDate(userLegalDocs)).toBe(true);
    });

    it('should return false when document signed exactly at Pacific midnight (07:00:00Z)', () => {
      const userLegalDocs = [
        { id: 1, dateSigned: '2024-08-01T07:00:00Z' }, // Exactly midnight PT
      ];
      expect(checkConsentRenewalDate(userLegalDocs)).toBe(false);
    });
  });

  describe('consent renewal logic - current date before August 1st', () => {
    beforeEach(() => {
      // Mock current date to be June 15, 2024 (before August 1st)
      const mockDate = new Date('2024-06-15T10:00:00Z');
      vi.useFakeTimers();
      vi.setSystemTime(mockDate);
    });

    it('should return true when document signed after previous year August 1st', () => {
      const userLegalDocs = [
        { id: 1, dateSigned: '2023-09-15T10:00:00Z' }, // After Aug 1, 2023
      ];
      expect(checkConsentRenewalDate(userLegalDocs)).toBe(true);
    });

    it('should return false when document signed before previous year August 1st', () => {
      const userLegalDocs = [
        { id: 1, dateSigned: '2023-07-15T10:00:00Z' }, // Before Aug 1, 2023
      ];
      expect(checkConsentRenewalDate(userLegalDocs)).toBe(false);
    });

    it('should return true when document signed in current year (before current August 1st)', () => {
      const userLegalDocs = [
        { id: 1, dateSigned: '2024-05-15T10:00:00Z' }, // Current year, after previous Aug 1st
      ];
      expect(checkConsentRenewalDate(userLegalDocs)).toBe(true);
    });
  });

  describe('timezone-specific behavior', () => {
    describe('Pacific timezone (America/Los_Angeles)', () => {
      beforeEach(() => {
        // Override the global UTC setting for these specific tests
        vi.unstubAllEnvs();
        vi.stubEnv('TZ', 'America/Los_Angeles');

        // Mock current date to be after August 1st for these tests
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2024-10-15T10:00:00-07:00')); // Pacific time
      });

      afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllEnvs();
      });

      it('should handle Pacific timezone midnight as the exact cutoff', () => {
        const testCases = [
          // July 31st late evening Pacific
          { time: '2024-07-31T23:59:59-07:00', expected: false, description: 'July 31st 11:59:59 PM Pacific' },

          // August 1st exactly at midnight Pacific (the cutoff boundary)
          {
            time: '2024-08-01T00:00:00-07:00',
            expected: false,
            description: 'August 1st midnight Pacific (exact cutoff)',
          },

          // One second after Pacific midnight
          { time: '2024-08-01T00:00:01-07:00', expected: true, description: 'August 1st 00:00:01 Pacific' },

          // Later on August 1st Pacific
          { time: '2024-08-01T09:00:00-07:00', expected: true, description: 'August 1st 9:00 AM Pacific' },
        ];

        testCases.forEach(({ time, expected }) => {
          const userLegalDocs = [{ id: 1, dateSigned: time }];
          expect(checkConsentRenewalDate(userLegalDocs)).toBe(expected);
        });
      });
    });

    describe('Berlin timezone (Europe/Berlin)', () => {
      beforeEach(() => {
        // Override the global UTC setting for these specific tests
        vi.unstubAllEnvs();
        vi.stubEnv('TZ', 'Europe/Berlin');
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2024-10-15T15:00:00+02:00')); // Berlin time (CEST)
      });

      afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllEnvs();
      });

      it('should still respect Pacific cutoff when running in Berlin timezone', () => {
        const testCases = [
          // August 1st midnight Berlin (still before Pacific cutoff)
          { time: '2024-08-01T00:00:00+02:00', expected: false, description: 'August 1st midnight Berlin' },

          // August 1st 9 AM Berlin (exactly Pacific midnight)
          {
            time: '2024-08-01T09:00:00+02:00',
            expected: false,
            description: 'August 1st 9:00 AM Berlin (Pacific midnight)',
          },

          // August 1st 9:00:01 AM Berlin (after Pacific cutoff)
          { time: '2024-08-01T09:00:01+02:00', expected: true, description: 'August 1st 9:00:01 AM Berlin' },

          // August 1st noon Berlin
          { time: '2024-08-01T12:00:00+02:00', expected: true, description: 'August 1st noon Berlin' },
        ];

        testCases.forEach(({ time, expected }) => {
          const userLegalDocs = [{ id: 1, dateSigned: time }];
          expect(checkConsentRenewalDate(userLegalDocs)).toBe(expected);
        });
      });
    });

    describe('UTC timezone', () => {
      beforeEach(() => {
        // Explicitly set UTC timezone
        vi.unstubAllEnvs();
        vi.stubEnv('TZ', 'UTC');
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2024-10-15T10:00:00Z'));
      });

      afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllEnvs();
      });

      it('should handle UTC dates relative to Pacific cutoff', () => {
        const testCases = [
          // August 1st midnight UTC (still July 31st in Pacific)
          { time: '2024-08-01T00:00:00Z', expected: false, description: 'August 1st midnight UTC' },

          // August 1st 6:59:59 UTC (still July 31st in Pacific)
          { time: '2024-08-01T06:59:59Z', expected: false, description: 'August 1st 6:59:59 UTC' },

          // August 1st 7:00:00 UTC (exactly Pacific midnight)
          { time: '2024-08-01T07:00:00Z', expected: false, description: 'August 1st 7:00:00 UTC (Pacific midnight)' },

          // August 1st 7:00:01 UTC (after Pacific cutoff)
          { time: '2024-08-01T07:00:01Z', expected: true, description: 'August 1st 7:00:01 UTC' },
        ];

        testCases.forEach(({ time, expected }) => {
          const userLegalDocs = [{ id: 1, dateSigned: time }];
          expect(checkConsentRenewalDate(userLegalDocs)).toBe(expected);
        });
      });
    });
  });

  describe('edge cases', () => {
    beforeEach(() => {
      // Mock current date to be August 1st exactly at Pacific midnight
      // Midnight PT on Aug 1 == 07:00:00Z.
      const mockDate = new Date('2024-08-01T07:00:00Z');
      vi.useFakeTimers();
      vi.setSystemTime(mockDate);
    });

    it('should handle documents signed one second after renewal date', () => {
      const userLegalDocs = [
        { id: 1, dateSigned: '2024-08-01T07:00:01Z' }, // One second after midnight PT
      ];
      expect(checkConsentRenewalDate(userLegalDocs)).toBe(true);
    });

    it('should handle documents signed one second before renewal date', () => {
      const userLegalDocs = [
        { id: 1, dateSigned: '2024-08-01T06:59:59Z' }, // One second before midnight PT
      ];
      expect(checkConsentRenewalDate(userLegalDocs)).toBe(false);
    });

    it('should handle mix of valid and invalid documents', () => {
      const userLegalDocs = [
        { id: 1, dateSigned: null },
        { id: 2, dateSigned: 'invalid-date' },
        { id: 3, dateSigned: '2024-09-15T10:00:00Z' }, // Valid and recent
        { id: 4 }, // No dateSigned field
      ];
      expect(checkConsentRenewalDate(userLegalDocs)).toBe(true);
    });

    it('should return false when all documents are invalid or old', () => {
      const userLegalDocs = [
        { id: 1, dateSigned: null },
        { id: 2, dateSigned: 'invalid-date' },
        { id: 3, dateSigned: '2024-07-15T10:00:00Z' }, // Before renewal date
        { id: 4 }, // No dateSigned field
      ];
      expect(checkConsentRenewalDate(userLegalDocs)).toBe(false);
    });
  });
});
