import { describe, it, expect } from 'vitest';
import { getGradeAsNumber, getGradesInRange } from './get-grade-as-number.util';

describe('getGradeAsNumber', () => {
  describe('early childhood grades (map to 0)', () => {
    it('should convert InfantToddler to 0', () => {
      expect(getGradeAsNumber('InfantToddler')).toBe(0);
    });

    it('should convert Preschool to 0', () => {
      expect(getGradeAsNumber('Preschool')).toBe(0);
    });

    it('should convert PreKindergarten to 0', () => {
      expect(getGradeAsNumber('PreKindergarten')).toBe(0);
    });

    it('should convert TransitionalKindergarten to 0', () => {
      expect(getGradeAsNumber('TransitionalKindergarten')).toBe(0);
    });

    it('should convert Kindergarten to 0', () => {
      expect(getGradeAsNumber('Kindergarten')).toBe(0);
    });
  });

  describe('numeric grades (1-13)', () => {
    it('should convert string grades 1-13 to their numeric values', () => {
      for (let i = 1; i <= 13; i++) {
        expect(getGradeAsNumber(String(i))).toBe(i);
      }
    });
  });

  describe('post-secondary grades', () => {
    it('should convert PostGraduate to 13', () => {
      expect(getGradeAsNumber('PostGraduate')).toBe(13);
    });
  });

  describe('special values (return null)', () => {
    it('should return null for empty string', () => {
      expect(getGradeAsNumber('')).toBeNull();
    });

    it('should return null for Ungraded', () => {
      expect(getGradeAsNumber('Ungraded')).toBeNull();
    });

    it('should return null for Other', () => {
      expect(getGradeAsNumber('Other')).toBeNull();
    });

    it('should return null for null input', () => {
      expect(getGradeAsNumber(null)).toBeNull();
    });

    it('should return null for invalid grade strings', () => {
      expect(getGradeAsNumber('InvalidGrade')).toBeNull();
      expect(getGradeAsNumber('unknown')).toBeNull();
    });
  });

  describe('numeric input', () => {
    it('should return the number for valid numeric input', () => {
      expect(getGradeAsNumber(5)).toBe(5);
      expect(getGradeAsNumber(0)).toBe(0);
      expect(getGradeAsNumber(12)).toBe(12);
    });

    it('should return null for NaN', () => {
      expect(getGradeAsNumber(NaN)).toBeNull();
    });
  });

  describe('numeric string parsing', () => {
    it('should parse numeric strings not in the map', () => {
      expect(getGradeAsNumber('14')).toBe(14);
      expect(getGradeAsNumber('0')).toBe(0);
    });
  });
});

describe('getGradesInRange', () => {
  it('returns grades >= a numeric grade', () => {
    const result = getGradesInRange('gte', '10');
    expect(result).not.toBeNull();
    expect(result).toContain('10');
    expect(result).toContain('11');
    expect(result).toContain('12');
    expect(result).toContain('13');
    expect(result).toContain('PostGraduate');
    expect(result).not.toContain('9');
    expect(result).not.toContain('Kindergarten');
  });

  it('returns grades <= a numeric grade', () => {
    const result = getGradesInRange('lte', '2');
    expect(result).not.toBeNull();
    expect(result).toContain('1');
    expect(result).toContain('2');
    expect(result).toContain('Kindergarten');
    expect(result).toContain('PreKindergarten');
    expect(result).toContain('InfantToddler');
    expect(result).not.toContain('3');
  });

  it('handles named grade values', () => {
    const result = getGradesInRange('gte', 'Kindergarten');
    expect(result).not.toBeNull();
    // Kindergarten maps to 0, so all grades should be included
    expect(result).toContain('Kindergarten');
    expect(result).toContain('1');
    expect(result).toContain('12');
  });

  it('returns null for grades with no numeric mapping', () => {
    expect(getGradesInRange('gte', 'Ungraded')).toBeNull();
    expect(getGradesInRange('lte', 'Other')).toBeNull();
    expect(getGradesInRange('gte', '')).toBeNull();
  });

  it('returns empty array when no grades satisfy the range', () => {
    // '14' parses as numeric 14, but no GRADE_MAP entry has value >= 14
    const result = getGradesInRange('gte', '14');
    expect(result).not.toBeNull();
    expect(result).toHaveLength(0);
  });
});
