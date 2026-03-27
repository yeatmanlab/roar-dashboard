/**
 * Coordinate validation utilities
 *
 * Provides type guards and validation functions for geographic coordinates.
 */

/**
 * Type guard for coordinate tuples (longitude, latitude).
 *
 * Validates that a value is a two-element array of numbers representing
 * geographic coordinates in the format [longitude, latitude].
 *
 * @param value - The value to validate
 * @returns True if the value is a valid coordinate tuple, false otherwise
 *
 * @example
 * ```ts
 * isCoordinateTuple([122.4194, 37.7749]); // true - San Francisco
 * isCoordinateTuple([200, 100]); // false - out of bounds
 * isCoordinateTuple([122]); // false - missing latitude
 * isCoordinateTuple('not coords'); // false - wrong type
 * ```
 */
export function isCoordinateTuple(value: unknown): value is [number, number] {
  if (!Array.isArray(value) || value.length !== 2) {
    return false;
  }

  const [lon, lat] = value;

  if (typeof lon !== 'number' || typeof lat !== 'number') {
    return false;
  }

  // Validate valid coordinate ranges
  // Latitude: -90 (South Pole) to 90 (North Pole)
  // Longitude: -180 to 180 (International Date Line)
  return lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}
