/**
 * Converts all top-level keys of a plain object from snake_case to camelCase.
 *
 * @param obj - Plain object whose keys may be snake_case
 * @param options.skipAliases - When true, skips a snake_case key if its camelCase equivalent
 *   already exists in the object. Use this when both forms may be present and the camelCase
 *   value is authoritative (e.g. jsPsych passthrough alongside SDK-normalized fields).
 * @returns New object with all keys converted to camelCase
 */
export function camelizeKeys(
  obj: Record<string, unknown>,
  options?: { skipAliases?: boolean },
): Record<string, unknown> {
  const skipAliases = options?.skipAliases ?? false;
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
    if (skipAliases && camelKey !== key && camelKey in obj) continue;
    result[camelKey] = value;
  }

  return result;
}
