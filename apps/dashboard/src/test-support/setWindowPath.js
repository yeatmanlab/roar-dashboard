/**
 * Point `window.location` at the given path inside a test.
 *
 * happy-dom's `history.pushState` does not update `window.location`, so
 * tests that exercise location-dependent code (e.g. the route-scoped /me
 * provisioning retry policy) must go through `window.happyDOM.setURL`.
 * Falls back to `pushState` for environments where it does work.
 *
 * @param {string} path - Absolute path, e.g. '/sso'.
 */
export function setWindowPath(path) {
  if (window.happyDOM?.setURL) {
    window.happyDOM.setURL(`http://localhost:3000${path}`);
  } else {
    window.history.pushState({}, '', path);
  }
}
