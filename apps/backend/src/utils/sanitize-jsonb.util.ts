/**
 * Recursively replaces non-finite numbers and Number.MAX_VALUE sentinels with null
 * before inserting into a PostgreSQL JSONB column.
 *
 * Adaptive testing algorithms (e.g. roar-pa CAT) use Number.MAX_VALUE to signal
 * "infinite uncertainty / no estimate yet". PostgreSQL's numeric type stores these
 * faithfully but expands them to ~300-digit decimal strings, bloating the column
 * and making the data unreadable. null is the semantically correct substitute.
 *
 * @param value - Any JSON-serializable value, potentially containing sentinel numbers
 * @returns The value with non-finite and MAX_VALUE numbers replaced by null
 */
export function sanitizeJsonbMaxValues(value: unknown): unknown {
  if (typeof value === 'number') {
    return !isFinite(value) || Math.abs(value) >= Number.MAX_VALUE ? null : value;
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeJsonbMaxValues);
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, sanitizeJsonbMaxValues(v)]),
    );
  }
  return value;
}
