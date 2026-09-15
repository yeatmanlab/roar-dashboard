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
 * Refuses to continue when the Firebase Auth emulator is configured in production.
 *
 * With `FIREBASE_AUTH_EMULATOR_HOST` set, the Admin SDK initializes without a
 * credential and verifies ID tokens against the emulator, which signs tokens for
 * any UID on request and does not check signatures. A leaked or inherited value on
 * a deployed service would therefore accept forged tokens for arbitrary users, so
 * the process must not come up at all rather than come up unauthenticated.
 *
 * `NODE_ENV` is `production` on the staging service too (the Cloud Run module sets
 * it on both), which is the intended blast radius: neither deployed stack has any
 * legitimate use for the emulator. Local development and CI leave `NODE_ENV`
 * unset or at `development`/`test`, so both are unaffected.
 *
 * @throws {Error} If `NODE_ENV` is 'production' while `FIREBASE_AUTH_EMULATOR_HOST` is set
 */
export function assertEmulatorNotEnabledInProduction(): void {
  if (process.env.NODE_ENV !== 'production') return;
  if (!isFirebaseAuthEmulatorEnabled()) return;

  throw new Error(
    `${FIREBASE_AUTH_EMULATOR_HOST_ENV_VAR} must not be set in production — ` +
      'the Auth emulator issues unverified tokens for arbitrary users',
  );
}
