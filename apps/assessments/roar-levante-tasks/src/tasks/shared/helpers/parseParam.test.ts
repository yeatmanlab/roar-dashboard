import { describe, it, expect } from 'vitest';
import { parseNumberParam } from './parseParam';

describe('parseNumberParam', () => {
  describe('with default defaultValue (0)', () => {
    it('should return 0 for undefined', () => {
      expect(parseNumberParam(undefined)).toBe(0);
    });

    it('should return 0 for null', () => {
      expect(parseNumberParam(null)).toBe(0);
    });

    it('should return 0 for empty string', () => {
      expect(parseNumberParam('')).toBe(0);
    });

    it('should return 0 for whitespace-only string', () => {
      expect(parseNumberParam('   ')).toBe(0);
      expect(parseNumberParam('\t\n')).toBe(0);
    });

    it('should return 0 for invalid string', () => {
      expect(parseNumberParam('abc')).toBe(0);
      expect(parseNumberParam('10abc')).toBe(0);
      expect(parseNumberParam('abc10')).toBe(0);
    });
  });

  describe('with custom defaultValue', () => {
    it('should return custom default for undefined', () => {
      expect(parseNumberParam(undefined, 99)).toBe(99);
    });

    it('should return custom default for null', () => {
      expect(parseNumberParam(null, 99)).toBe(99);
    });

    it('should return custom default for empty string', () => {
      expect(parseNumberParam('', 99)).toBe(99);
    });

    it('should return custom default for invalid string', () => {
      expect(parseNumberParam('abc', 99)).toBe(99);
    });
  });

  describe('valid number inputs', () => {
    it('should pass through number values', () => {
      expect(parseNumberParam(0)).toBe(0);
      expect(parseNumberParam(5)).toBe(5);
      expect(parseNumberParam(42)).toBe(42);
      expect(parseNumberParam(-10)).toBe(-10);
      expect(parseNumberParam(3.14)).toBe(3.14);
    });

    it('should parse valid string numbers', () => {
      expect(parseNumberParam('0')).toBe(0);
      expect(parseNumberParam('5')).toBe(5);
      expect(parseNumberParam('42')).toBe(42);
      expect(parseNumberParam('-10')).toBe(-10);
      expect(parseNumberParam('3.14')).toBe(3.14);
    });

    it('should trim whitespace before parsing', () => {
      expect(parseNumberParam('  10  ')).toBe(10);
      expect(parseNumberParam('\t5\n')).toBe(5);
      expect(parseNumberParam('  -3.14  ')).toBe(-3.14);
    });
  });

  describe('edge cases', () => {
    it('should handle zero correctly (not treat as falsy)', () => {
      expect(parseNumberParam(0)).toBe(0);
      expect(parseNumberParam('0')).toBe(0);
      expect(parseNumberParam('0', 99)).toBe(0);
    });

    it('should handle negative numbers', () => {
      expect(parseNumberParam(-5)).toBe(-5);
      expect(parseNumberParam('-5')).toBe(-5);
    });

    it('should handle decimal numbers', () => {
      expect(parseNumberParam(3.14)).toBe(3.14);
      expect(parseNumberParam('3.14')).toBe(3.14);
    });

    it('should handle scientific notation', () => {
      expect(parseNumberParam('1e3')).toBe(1000);
      expect(parseNumberParam('1.5e2')).toBe(150);
    });

    it('should handle Infinity', () => {
      expect(parseNumberParam(Infinity)).toBe(Infinity);
      expect(parseNumberParam('Infinity')).toBe(Infinity);
    });

    it('should handle very large numbers', () => {
      expect(parseNumberParam(999999999)).toBe(999999999);
      expect(parseNumberParam('999999999')).toBe(999999999);
    });
  });
});
