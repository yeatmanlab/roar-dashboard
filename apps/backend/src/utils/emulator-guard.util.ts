/**
 * Refuses to continue when the Firebase Auth emulator is configured on a deployed service.
 *
 * With `FIREBASE_AUTH_EMULATOR_HOST` set, the Admin SDK initializes without a
 * credential and sends ID tokens to that host for verification instead of to Google.
 * An emulator signs tokens for any UID on request and does not check signatures, so a
 * leaked or inherited value pointing at a reachable one lets an attacker present a
 * token for any user and have it verify. The service is not left unauthenticated —
 * verification succeeds, as whoever the forged token names, and every downstream
 * permission check then runs against that attacker-chosen identity. A value pointing
 * nowhere is not safe either: verification fails on every request and the service
 * 401s. Neither is a service that should be serving, so the process must not come up
 * at all.
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
      'it routes token verification away from Google, to a host that does not check signatures',
  );
}
