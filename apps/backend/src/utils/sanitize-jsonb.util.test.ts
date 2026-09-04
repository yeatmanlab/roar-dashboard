import { describe, it, expect } from 'vitest';
import { sanitizeJsonbMaxValues } from './sanitize-jsonb.util';

describe('sanitizeJsonbMaxValues', () => {
  describe('primitive passthrough', () => {
    it('returns a finite number unchanged', () => {
      expect(sanitizeJsonbMaxValues(42)).toBe(42);
    });

    it('returns zero unchanged', () => {
      expect(sanitizeJsonbMaxValues(0)).toBe(0);
    });

    it('returns a negative finite number unchanged', () => {
      expect(sanitizeJsonbMaxValues(-3.14)).toBe(-3.14);
    });

    it('returns a string unchanged', () => {
      expect(sanitizeJsonbMaxValues('hello')).toBe('hello');
    });

    it('returns a boolean unchanged', () => {
      expect(sanitizeJsonbMaxValues(true)).toBe(true);
    });

    it('returns null unchanged', () => {
      expect(sanitizeJsonbMaxValues(null)).toBeNull();
    });
  });

  describe('Number.MAX_VALUE sentinel', () => {
    it('replaces Number.MAX_VALUE with null', () => {
      expect(sanitizeJsonbMaxValues(Number.MAX_VALUE)).toBeNull();
    });

    it('replaces -Number.MAX_VALUE with null', () => {
      expect(sanitizeJsonbMaxValues(-Number.MAX_VALUE)).toBeNull();
    });
  });

  describe('non-finite numbers', () => {
    it('replaces Infinity with null', () => {
      expect(sanitizeJsonbMaxValues(Infinity)).toBeNull();
    });

    it('replaces -Infinity with null', () => {
      expect(sanitizeJsonbMaxValues(-Infinity)).toBeNull();
    });

    it('replaces NaN with null', () => {
      expect(sanitizeJsonbMaxValues(NaN)).toBeNull();
    });
  });

  describe('arrays', () => {
    it('sanitizes numbers inside an array', () => {
      expect(sanitizeJsonbMaxValues([1, Infinity, Number.MAX_VALUE, 2])).toEqual([1, null, null, 2]);
    });

    it('returns an empty array unchanged', () => {
      expect(sanitizeJsonbMaxValues([])).toEqual([]);
    });

    it('handles arrays of non-numeric values', () => {
      expect(sanitizeJsonbMaxValues(['a', true, null])).toEqual(['a', true, null]);
    });
  });

  describe('objects', () => {
    it('sanitizes a flat object with sentinel values', () => {
      expect(sanitizeJsonbMaxValues({ rt: 450, theta: Number.MAX_VALUE, correct: 1 })).toEqual({
        rt: 450,
        theta: null,
        correct: 1,
      });
    });

    it('recursively sanitizes nested objects', () => {
      expect(sanitizeJsonbMaxValues({ outer: { inner: Number.MAX_VALUE } })).toEqual({ outer: { inner: null } });
    });

    it('recursively sanitizes objects containing arrays', () => {
      expect(sanitizeJsonbMaxValues({ scores: [1, Infinity, 3] })).toEqual({ scores: [1, null, 3] });
    });

    it('recursively sanitizes arrays containing objects', () => {
      expect(sanitizeJsonbMaxValues([{ theta: Number.MAX_VALUE }, { theta: 0.5 }])).toEqual([
        { theta: null },
        { theta: 0.5 },
      ]);
    });

    it('returns an empty object unchanged', () => {
      expect(sanitizeJsonbMaxValues({})).toEqual({});
    });
  });
});
