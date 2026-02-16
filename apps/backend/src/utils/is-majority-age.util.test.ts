import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isMajorityAge } from './is-majority-age.util';
import type { Grade } from '../enums/grade.enum';

describe('isMajorityAge', () => {
  beforeEach(() => {
    // Mock current date to 2024-06-15 for consistent testing
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-06-15'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('with date of birth (Date object)', () => {
    it('should return true for user exactly 18 years old', () => {
      const user = { dob: new Date('2006-06-15'), grade: null };
      expect(isMajorityAge(user)).toBe(true);
    });

    it('should return true for user over 18 years old', () => {
      const user = { dob: new Date('2000-01-01'), grade: null };
      expect(isMajorityAge(user)).toBe(true);
    });

    it('should return false for user under 18 years old', () => {
      const user = { dob: new Date('2010-01-01'), grade: null };
      expect(isMajorityAge(user)).toBe(false);
    });

    it('should return false for user turning 18 later this year', () => {
      const user = { dob: new Date('2006-12-01'), grade: null };
      expect(isMajorityAge(user)).toBe(false);
    });

    it('should prioritize dob over grade when both are present', () => {
      // User has dob showing they're 20, but grade suggests younger
      const user = { dob: new Date('2004-01-01'), grade: '5' as Grade };
      expect(isMajorityAge(user)).toBe(true);
    });
  });

  describe('with date of birth (ISO string)', () => {
    it('should return true for user exactly 18 years old (string date)', () => {
      const user = { dob: '2006-06-15', grade: null };
      expect(isMajorityAge(user)).toBe(true);
    });

    it('should return true for user over 18 years old (string date)', () => {
      const user = { dob: '2000-01-01', grade: null };
      expect(isMajorityAge(user)).toBe(true);
    });

    it('should return false for user under 18 years old (string date)', () => {
      const user = { dob: '2010-01-01', grade: null };
      expect(isMajorityAge(user)).toBe(false);
    });
  });

  describe('with grade only (no dob)', () => {
    it('should return true for grade 12 (typical age 18)', () => {
      const user = { dob: null, grade: '12' as Grade };
      expect(isMajorityAge(user)).toBe(true);
    });

    it('should return true for grade 13 (typical age 19)', () => {
      const user = { dob: null, grade: '13' as Grade };
      expect(isMajorityAge(user)).toBe(true);
    });

    it('should return true for PostGraduate', () => {
      const user = { dob: null, grade: 'PostGraduate' as Grade };
      expect(isMajorityAge(user)).toBe(true);
    });

    it('should return false for grade 11 (typical age 17)', () => {
      const user = { dob: null, grade: '11' as Grade };
      expect(isMajorityAge(user)).toBe(false);
    });

    it('should return false for grade 1 (typical age 7)', () => {
      const user = { dob: null, grade: '1' as Grade };
      expect(isMajorityAge(user)).toBe(false);
    });

    it('should return false for Kindergarten (typical age 6)', () => {
      const user = { dob: null, grade: 'Kindergarten' as Grade };
      expect(isMajorityAge(user)).toBe(false);
    });

    it('should return false for PreKindergarten (typical age 5)', () => {
      const user = { dob: null, grade: 'PreKindergarten' as Grade };
      expect(isMajorityAge(user)).toBe(false);
    });

    it('should return null for Ungraded (no age mapping)', () => {
      const user = { dob: null, grade: 'Ungraded' as Grade };
      expect(isMajorityAge(user)).toBeNull();
    });

    it('should return null for Other (no age mapping)', () => {
      const user = { dob: null, grade: 'Other' as Grade };
      expect(isMajorityAge(user)).toBeNull();
    });

    it('should return null for empty string grade', () => {
      const user = { dob: null, grade: '' as Grade };
      expect(isMajorityAge(user)).toBeNull();
    });
  });

  describe('with neither dob nor grade', () => {
    it('should return null when both are null', () => {
      const user = { dob: null, grade: null };
      expect(isMajorityAge(user)).toBeNull();
    });
  });
});
