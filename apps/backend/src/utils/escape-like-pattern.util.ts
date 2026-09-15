/**
 * Escapes SQL LIKE/ILIKE pattern special characters so user input is treated as literal text.
 *
 * Escapes backslash first (since it is the escape character itself), then `%` and `_`.
 *
 * @param value - Raw user-supplied string
 * @returns The escaped string, safe to embed in an ILIKE pattern
 */
export function escapeLikePattern(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}
