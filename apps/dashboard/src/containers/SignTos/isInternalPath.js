/**
 * Validates the `?next=` query parameter that the TOS guard pushes onto the
 * SignTos route when it intercepts a navigation.
 *
 * Uses the WHATWG URL parser instead of a regex so the implementation matches
 * what the browser would do if the value were ever resolved as a real URL.
 * That sidesteps the entire class of regex bypasses (e.g., backslash-as-slash
 * normalization, percent-encoded `//`, IDN tricks, control characters): if
 * the parsed URL's origin matches the current origin and its pathname starts
 * with `/`, the value is safe to hand back to `router.replace`.
 *
 * @param {unknown} next - The raw `?next=` value pulled off `route.query`.
 * @param {string} [origin=window.location.origin] - The expected origin.
 * @returns {boolean}
 */
export function isInternalPath(next, origin = window.location.origin) {
  if (typeof next !== 'string' || next.length === 0) return false;
  try {
    const url = new URL(next, origin);
    return url.origin === origin && url.pathname.startsWith('/');
  } catch {
    return false;
  }
}
