const UUID_SOURCE = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

// A bare UUID, or a `{slug}-{uuid}` composite like `school-<uuid>` — the slug
// is a type discriminator, the UUID is opaque, so the whole segment carries no
// user input. Free text never matches: it has no UUID tail.
const OPAQUE_STRING_PATTERN = new RegExp(`^(?:[a-z]+(?:-[a-z]+)*-)?${UUID_SOURCE}$`, 'i');

const REDACTED = '[redacted]';

/**
 * Strips potentially sensitive values from a query key before logging.
 *
 * Query keys mix a constant family name, opaque IDs, and — potentially —
 * user input (search text, filter values). Only opaque segments pass: the
 * position-0 constant, UUIDs (bare or slug-prefixed like `school-<uuid>`),
 * numbers, booleans, and null. Any other string is redacted, and objects
 * keep their key names but lose their values, so a future key carrying
 * search input is safe by default instead of relying on whoever adds it
 * to remember the log sites this feeds.
 *
 * @param {unknown} queryKey - The TanStack query key (usually an array).
 * @returns {unknown} A structurally similar key with expressive values redacted.
 */
export function sanitizeQueryKey(queryKey) {
  if (!Array.isArray(queryKey)) return REDACTED;

  return queryKey.map((segment, index) => {
    if (index === 0 && typeof segment === 'string') return segment;
    if (segment === null || segment === undefined) return segment;
    if (typeof segment === 'number' || typeof segment === 'boolean') return segment;
    if (typeof segment === 'string') return OPAQUE_STRING_PATTERN.test(segment) ? segment : REDACTED;
    if (typeof segment === 'object') {
      return Object.fromEntries(Object.keys(segment).map((key) => [key, REDACTED]));
    }
    return REDACTED;
  });
}
