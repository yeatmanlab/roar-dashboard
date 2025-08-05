import { describe, it, expect, beforeEach, vi } from 'vitest';
import { checkConsentRenewalDate } from './consent';

describe('checkConsentRenewalDate', () => {
  beforeEach(() => {
    // Reset any date mocks before each test
    vi.useRealTimers();
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

    it('should return false when documents have null dateSigned', () => {
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

    it('should return false when document signed on August 1st exactly', () => {
      const userLegalDocs = [
        { id: 1, dateSigned: '2024-08-01T00:00:00Z' }, // Exactly Aug 1, 2024 (month 8 = September)
      ];
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

  describe('edge cases', () => {
    beforeEach(() => {
      // Mock current date to be August 1st exactly
      const mockDate = new Date('2024-08-01T07:00:00Z'); // August 1st (month 8)
      vi.useFakeTimers();
      vi.setSystemTime(mockDate);
    });

    it('should handle documents signed on the exact renewal date', () => {
      const userLegalDocs = [
        { id: 1, dateSigned: '2024-08-01T07:00:00Z' }, // Exactly on renewal date
      ];
      expect(checkConsentRenewalDate(userLegalDocs)).toBe(false);
    });

    it('should handle documents signed one second after renewal date', () => {
      const userLegalDocs = [
        { id: 1, dateSigned: '2024-08-01T07:00:01Z' }, // One second after renewal date
      ];
      expect(checkConsentRenewalDate(userLegalDocs)).toBe(true);
    });
  });

  describe('mixed document scenarios', () => {
    beforeEach(() => {
      const mockDate = new Date('2024-10-15T10:00:00Z');
      vi.useFakeTimers();
      vi.setSystemTime(mockDate);
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
