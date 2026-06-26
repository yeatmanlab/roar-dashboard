import { IS_FIREBASE_EMULATOR_ENABLED } from '@/constants/firebase';

/**
 * Local-emulator readiness signal — TRANSITIONAL, pending removal.
 *
 * The app-wide readiness gate has moved to the auth store's `isAuthReady` getter
 * (`Boolean(accessToken)`), which works in both deployed and emulator builds and
 * therefore subsumes this helper (see the restConfig-readiness / AU4 migration).
 * Only the three not-yet-migrated home pages — `HomeParent`, `HomeParticipant`,
 * and `HomeSelector` — still gate on `roarfirekit.restConfig?.()` and OR this in
 * to cover the emulator:
 *
 *   if (state.roarfirekit.restConfig?.() || isEmulatorAuthReady(state)) init();
 *
 * Delete this helper once those three pages are cut over to `isAuthReady`.
 *
 * Gated on `VITE_FIREBASE_EMULATOR_ENABLED`, so it returns `false` in deployed
 * builds. Accepts either the auth store instance or a Pinia `$subscribe` state
 * snapshot — both expose `accessToken`.
 *
 * @param {{ accessToken?: string | null }} authState - Auth store or `$subscribe` snapshot.
 * @returns {boolean} true only in emulator mode once an access token is present.
 */
export function isEmulatorAuthReady(authState) {
  return IS_FIREBASE_EMULATOR_ENABLED && Boolean(authState?.accessToken);
}
