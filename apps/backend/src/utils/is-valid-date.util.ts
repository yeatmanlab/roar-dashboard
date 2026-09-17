/**
 * Check whether a value is a valid Date that can be serialized.
 *
 * @param value - The value to check
 * @returns true if value is a Date with a valid time value
 */
export function isValidDate(value: unknown): value is Date {
  return value instanceof Date && !Number.isNaN(value.getTime());
}
