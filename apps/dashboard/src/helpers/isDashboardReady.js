/**
 * Local Firebase Auth emulator mode (VITE_FIREBASE_EMULATOR_ENABLED). Inert in
 * deployed builds.
 */
const isFirebaseEmulatorEnabled =
  import.meta.env.VITE_FIREBASE_EMULATOR_ENABLED === true || import.meta.env.VITE_FIREBASE_EMULATOR_ENABLED === 'true';

/**
 * Local-emulator readiness signal for gating backend-scoped queries.
 *
 * Components gate their initial data fetches on firekit's `restConfig()` so
 * requests don't fire before auth/config are ready. Against the local stack only
 * the Auth emulator runs, so firekit's Firestore/Functions bootstrap never
 * completes and `restConfig()` never returns truthy — which would otherwise leave
 * those components stuck on their loading state. The backend-scoped queries only
 * need a Bearer token, so once one is issued the dashboard is ready in emulator
 * mode. Callers OR this with the existing `restConfig()` check:
 *
 *   if (state.roarfirekit.restConfig?.() || isEmulatorAuthReady(state)) init();
 *
 * Gated on `VITE_FIREBASE_EMULATOR_ENABLED`, so it returns `false` in deployed
 * builds and the production `restConfig()` readiness path is left untouched while
 * the broader off-firekit migration is still pending.
 *
 * Accepts either the auth store instance or a Pinia `$subscribe` state snapshot —
 * both expose `accessToken`.
 *
 * @param {{ accessToken?: string | null }} authState - Auth store or `$subscribe` snapshot.
 * @returns {boolean} true only in emulator mode once an access token is present.
 */
export function isEmulatorAuthReady(authState) {
  return isFirebaseEmulatorEnabled && Boolean(authState?.accessToken);
}
