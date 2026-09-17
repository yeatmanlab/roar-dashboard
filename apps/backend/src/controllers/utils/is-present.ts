/**
 * True when a string column carries a meaningful value — i.e. it is neither
 * null/undefined nor an empty string.
 *
 * Used by controller transforms to decide whether an optional DB column should
 * appear in the API response. An empty-string address/identifier column carries
 * no meaning, so it is treated as absent and omitted (rather than emitted as
 * `""`). This makes the "empty string === absent" convention explicit at the
 * call site instead of relying on JS truthiness.
 *
 * @param value - The column value to test.
 * @returns A type guard narrowing `value` to `string` when present.
 */
export const isPresentString = (value: string | null | undefined): value is string => value != null && value !== '';
