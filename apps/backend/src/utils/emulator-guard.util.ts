/**
 * Refuses to continue when the Firebase Auth emulator is configured on a deployed service.
 *
 * With `FIREBASE_AUTH_EMULATOR_HOST` set, the Admin SDK initializes without a
 * credential and verifies ID tokens against the emulator, which signs tokens for
 * any UID on request and does not check signatures. A leaked or inherited value on
 * a deployed service would therefore accept forged tokens for arbitrary users, so
 * the process must not come up at all rather than come up unauthenticated.
 *
 * Keyed on `K_SERVICE` rather than on `NODE_ENV`. `NODE_ENV=production` is not a
 * reliable signal for "deployed": the assessment SDK's integration harness sets it
 * when spawning a local backend against the emulator, purely to avoid a pino-pretty
 * crash in bundled ESM. Guarding on `NODE_ENV` alone breaks that suite while adding
 * nothing, since a deployed service always carries `K_SERVICE` too.
 *
 * @throws {Error} If running on a deployed service while `FIREBASE_AUTH_EMULATOR_HOST` is set
 */
export function assertEmulatorNotEnabledOnDeployedService(): void {
  // Injected by the Cloud Run runtime on every revision, and absent locally and in CI.
  if (!process.env.K_SERVICE) return;

  // The Admin SDK treats any non-empty value as "use the emulator", so this mirrors
  // that exactly — a whitespace-only value is still a value to the SDK.
  if (!process.env.FIREBASE_AUTH_EMULATOR_HOST) return;

  throw new Error(
    'FIREBASE_AUTH_EMULATOR_HOST must not be set on a deployed service — ' +
      'the Auth emulator issues unverified tokens for arbitrary users',
  );
}
