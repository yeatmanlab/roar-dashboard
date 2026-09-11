import { describe, it, expect } from 'vitest';
import { hasSupervisoryRole } from './has-supervisory-role.util';

describe('hasSupervisoryRole', () => {
  describe('returns true for supervisory roles', () => {
    it('returns true for site_administrator', () => {
      expect(hasSupervisoryRole(['site_administrator'])).toBe(true);
    });

    it('returns true for administrator', () => {
      expect(hasSupervisoryRole(['administrator'])).toBe(true);
    });

    it('returns true for teacher', () => {
      expect(hasSupervisoryRole(['teacher'])).toBe(true);
    });
  });

  describe('returns false for supervised roles only', () => {
    it('returns false for student', () => {
      expect(hasSupervisoryRole(['student'])).toBe(false);
    });

    it('returns false for guardian', () => {
      expect(hasSupervisoryRole(['guardian'])).toBe(false);
    });

    it('returns false for parent', () => {
      expect(hasSupervisoryRole(['parent'])).toBe(false);
    });

    it('returns false for relative', () => {
      expect(hasSupervisoryRole(['relative'])).toBe(false);
    });

    it('returns false for multiple supervised roles', () => {
      expect(hasSupervisoryRole(['student', 'guardian', 'parent'])).toBe(false);
    });
  });

  describe('mixed roles', () => {
    it('returns true when user has both supervised and supervisory roles', () => {
      expect(hasSupervisoryRole(['student', 'teacher'])).toBe(true);
    });

    it('returns true when supervisory role is first', () => {
      expect(hasSupervisoryRole(['administrator', 'student'])).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('returns false for empty array', () => {
      expect(hasSupervisoryRole([])).toBe(false);
    });

    it('returns false for unknown/invalid role strings', () => {
      // Unknown roles should NOT be treated as supervisory (security fix)
      expect(hasSupervisoryRole(['unknown_role'])).toBe(false);
      expect(hasSupervisoryRole(['typo_administrator'])).toBe(false);
      expect(hasSupervisoryRole(['TEACHER'])).toBe(false); // case-sensitive
    });

    it('returns false when only unknown roles are present', () => {
      expect(hasSupervisoryRole(['unknown1', 'unknown2'])).toBe(false);
    });

    it('returns true when unknown role is mixed with valid supervisory role', () => {
      expect(hasSupervisoryRole(['unknown_role', 'teacher'])).toBe(true);
    });
  });
});
