import { describe, it, expect } from 'vitest';
import { isCoordinateTuple } from './coordinate-validation.util';

describe('coordinate-validation.util', () => {
  describe('isCoordinateTuple', () => {
    describe('valid coordinates', () => {
      it('returns true for valid coordinates', () => {
        expect(isCoordinateTuple([0, 0])).toBe(true);
      });

      it('returns true for San Francisco coordinates', () => {
        expect(isCoordinateTuple([-122.4194, 37.7749])).toBe(true);
      });

      it('returns true for Tokyo coordinates', () => {
        expect(isCoordinateTuple([139.6917, 35.6895])).toBe(true);
      });

      it('returns true for London coordinates', () => {
        expect(isCoordinateTuple([-0.1276, 51.5074])).toBe(true);
      });

      it('returns true for Sydney coordinates', () => {
        expect(isCoordinateTuple([151.2093, -33.8688])).toBe(true);
      });
    });

    describe('boundary cases', () => {
      it('returns true for North Pole (latitude 90)', () => {
        expect(isCoordinateTuple([0, 90])).toBe(true);
      });

      it('returns true for South Pole (latitude -90)', () => {
        expect(isCoordinateTuple([0, -90])).toBe(true);
      });

      it('returns true for International Date Line east (longitude 180)', () => {
        expect(isCoordinateTuple([180, 0])).toBe(true);
      });

      it('returns true for International Date Line west (longitude -180)', () => {
        expect(isCoordinateTuple([-180, 0])).toBe(true);
      });

      it('returns true for maximum valid coordinates', () => {
        expect(isCoordinateTuple([180, 90])).toBe(true);
      });

      it('returns true for minimum valid coordinates', () => {
        expect(isCoordinateTuple([-180, -90])).toBe(true);
      });
    });

    describe('out of bounds coordinates', () => {
      it('returns false for latitude above 90', () => {
        expect(isCoordinateTuple([0, 91])).toBe(false);
      });

      it('returns false for latitude below -90', () => {
        expect(isCoordinateTuple([0, -91])).toBe(false);
      });

      it('returns false for longitude above 180', () => {
        expect(isCoordinateTuple([181, 0])).toBe(false);
      });

      it('returns false for longitude below -180', () => {
        expect(isCoordinateTuple([-181, 0])).toBe(false);
      });

      it('returns false for extremely large values', () => {
        expect(isCoordinateTuple([1000, 1000])).toBe(false);
      });

      it('returns false for extremely small values', () => {
        expect(isCoordinateTuple([-1000, -1000])).toBe(false);
      });
    });

    describe('invalid types', () => {
      it('returns false for null', () => {
        expect(isCoordinateTuple(null)).toBe(false);
      });

      it('returns false for undefined', () => {
        expect(isCoordinateTuple(undefined)).toBe(false);
      });

      it('returns false for string', () => {
        expect(isCoordinateTuple('122.4194, 37.7749')).toBe(false);
      });

      it('returns false for number', () => {
        expect(isCoordinateTuple(123)).toBe(false);
      });

      it('returns false for boolean', () => {
        expect(isCoordinateTuple(true)).toBe(false);
      });

      it('returns false for object', () => {
        expect(isCoordinateTuple({ lon: 122, lat: 37 })).toBe(false);
      });

      it('returns false for empty object', () => {
        expect(isCoordinateTuple({})).toBe(false);
      });
    });

    describe('invalid array structures', () => {
      it('returns false for empty array', () => {
        expect(isCoordinateTuple([])).toBe(false);
      });

      it('returns false for single-element array', () => {
        expect(isCoordinateTuple([122])).toBe(false);
      });

      it('returns false for three-element array', () => {
        expect(isCoordinateTuple([122, 37, 0])).toBe(false);
      });

      it('returns false for array with non-numeric first element', () => {
        expect(isCoordinateTuple(['122', 37])).toBe(false);
      });

      it('returns false for array with non-numeric second element', () => {
        expect(isCoordinateTuple([122, '37'])).toBe(false);
      });

      it('returns false for array with both elements as strings', () => {
        expect(isCoordinateTuple(['122', '37'])).toBe(false);
      });

      it('returns false for array with null elements', () => {
        expect(isCoordinateTuple([null, null])).toBe(false);
      });

      it('returns false for array with undefined elements', () => {
        expect(isCoordinateTuple([undefined, undefined])).toBe(false);
      });

      it('returns false for array with mixed null and number', () => {
        expect(isCoordinateTuple([122, null])).toBe(false);
      });
    });

    describe('edge cases with special numeric values', () => {
      it('returns false for NaN longitude', () => {
        expect(isCoordinateTuple([NaN, 37])).toBe(false);
      });

      it('returns false for NaN latitude', () => {
        expect(isCoordinateTuple([122, NaN])).toBe(false);
      });

      it('returns false for Infinity longitude', () => {
        expect(isCoordinateTuple([Infinity, 37])).toBe(false);
      });

      it('returns false for Infinity latitude', () => {
        expect(isCoordinateTuple([122, Infinity])).toBe(false);
      });

      it('returns false for -Infinity longitude', () => {
        expect(isCoordinateTuple([-Infinity, 37])).toBe(false);
      });

      it('returns false for -Infinity latitude', () => {
        expect(isCoordinateTuple([122, -Infinity])).toBe(false);
      });
    });

    describe('type narrowing', () => {
      it('narrows type to [number, number] when true', () => {
        const value: unknown = [122.4194, 37.7749];

        if (isCoordinateTuple(value)) {
          // TypeScript should know value is [number, number] here
          const [lon, lat] = value;
          expect(typeof lon).toBe('number');
          expect(typeof lat).toBe('number');
        }
      });

      it('does not narrow type when false', () => {
        const value: unknown = 'not coordinates';

        expect(isCoordinateTuple(value)).toBe(false);
      });
    });
  });
});
