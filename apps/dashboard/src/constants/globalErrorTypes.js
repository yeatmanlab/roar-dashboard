/**
 * Types of global errors surfaced by `useGlobalError`.
 *
 * The router's `beforeEach` guard reads `globalError.value?.type` to decide
 * which error page to redirect to. New error types should be added here and
 * paired with handling in the guard (`router/index.js`) and the matching
 * error page (`pages/`).
 */
export const GLOBAL_ERROR_TYPES = Object.freeze({
  /** `/me` returned `code: auth/rostering-ended` — district access ended. */
  ROSTERING_ENDED: 'rostering-ended',
  /** Terminal auth failure (`auth/required`, `auth/token-expired`). */
  AUTH_EXPIRED: 'auth-expired',
  /** Any other `/me` failure (5xx, network, unexpected non-200). */
  SERVER_ERROR: 'server-error',
});
