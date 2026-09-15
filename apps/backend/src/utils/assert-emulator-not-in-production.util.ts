/**
 * The environment variable the Firebase Admin SDK reads to route token verification
 * at the local Auth emulator instead of Google's servers.
 *
 * Named here rather than read inline so the guard, the client branch it protects,
 * and the error message all refer to one constant.
 */
export const FIREBASE_AUTH_EMULATOR_HOST_ENV_VAR = 'FIREBASE_AUTH_EMULATOR_HOST';

/**
 * Whether the Firebase Auth emulator is configured for this process.
 *
 * The Admin SDK treats any non-empty value as "use the emulator", so this mirrors
 * that exactly — a whitespace-only value is still a value to the SDK.
 *
 * @returns true when `FIREBASE_AUTH_EMULATOR_HOST` is set to a non-empty string
 */
export function isFirebaseAuthEmulatorEnabled(): boolean {
  return Boolean(process.env[FIREBASE_AUTH_EMULATOR_HOST_ENV_VAR]);
}

/**
 * Whether this process is running as a deployed Cloud Run service.
 *
 * `K_SERVICE` is set by the Cloud Run runtime on every revision and is absent
 * everywhere else, which makes it the signal that actually means "deployed".
 *
 * @returns true when the Cloud Run runtime marker is present
 */
export function isRunningOnCloudRun(): boolean {
  return Boolean(process.env.K_SERVICE);
}

/**
 * Refuses to continue when the Firebase Auth emulator is configured in production.
 *
 * With `FIREBASE_AUTH_EMULATOR_HOST` set, the Admin SDK initializes without a
 * credential and verifies ID tokens against the emulator, which signs tokens for
 * any UID on request and does not check signatures. A leaked or inherited value on
 * a deployed service would therefore accept forged tokens for arbitrary users, so
 * the process must not come up at all rather than come up unauthenticated.
 *
 * Keyed on `K_SERVICE` — injected by Cloud Run on every revision and never set
 * locally or in CI — rather than on `NODE_ENV` alone. `NODE_ENV=production` is not
 * a reliable signal for "deployed": the assessment SDK's integration harness sets it
 * when spawning a local backend against the emulator, purely to avoid a pino-pretty
 * crash in bundled ESM. Guarding on `NODE_ENV` alone breaks that suite while adding
 * nothing, since a deployed service always carries `K_SERVICE` too.
 *
 * This covers the staging service as well as production — the Cloud Run module sets
 * `NODE_ENV=production` on both, and neither deployed stack has any legitimate use
 * for the emulator.
 *
 * @throws {Error} If running on Cloud Run while `FIREBASE_AUTH_EMULATOR_HOST` is set
 */
export function assertEmulatorNotEnabledInProduction(): void {
  if (!isRunningOnCloudRun()) return;
  if (!isFirebaseAuthEmulatorEnabled()) return;

  throw new Error(
    `${FIREBASE_AUTH_EMULATOR_HOST_ENV_VAR} must not be set on a deployed service — ` +
      'the Auth emulator issues unverified tokens for arbitrary users',
  );
}
