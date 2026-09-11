/**
 * Builds run metadata from operator/participant-supplied launch params.
 *
 * Keeps only non-null, non-empty values (so `0`/`false` survive but `null`, `undefined`, and
 * `''` are dropped), and returns `undefined` when nothing was provided so `startRun` is called
 * with no metadata rather than an empty object. This context lives on the run only — it is
 * never written to the user record.
 *
 * @param {Record<string, unknown>} [userParams] - Launch params (PID + demographics)
 * @returns {Record<string, unknown> | undefined} Metadata object, or undefined when empty
 */
export const buildRunMetadata = (userParams) => {
  const metadata = Object.fromEntries(
    Object.entries(userParams ?? {}).filter(([, value]) => value != null && value !== ''),
  );
  return Object.keys(metadata).length > 0 ? metadata : undefined;
};
