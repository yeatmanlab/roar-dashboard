/**
 * Firebase Auth Emulator seeding helpers for `server-test.ts`.
 *
 * Used only when the test server is booted with `FIREBASE_AUTH_EMULATOR_HOST`
 * set (CI Cypress runs and local e2e development). The helpers create users
 * in the emulator whose Firebase UIDs match the `authId` of seeded
 * `baseFixture` users, so an emulator-issued ID token decodes — via
 * `FirebaseAuthProvider.verifyToken` — to a UID the backend recognizes.
 *
 * Cypress reads the credentials these helpers produce from a fixture file
 * (`/tmp/roar-cypress-fixture.json`) and signs in via the Firebase Web SDK
 * directly. See `.ai/rules/frontend-e2e-testing-pattern.md`.
 */
import { FirebaseAuthClient } from '../clients/firebase-auth.clients';
import { logger } from '../logger';

/**
 * Shared password for every emulator-seeded user.
 *
 * The Firebase Auth emulator does not enforce password complexity — this
 * value only needs to be a valid string the seeder and Cypress agree on.
 */
export const EMULATOR_TEST_PASSWORD = 'test-password-emulator';

/** Deterministic email derived from a seeded user's Firebase UID. */
export function emulatorEmailFor(authId: string): string {
  return `${authId}@test.local`;
}

/**
 * A user that can be seeded into the emulator.
 *
 * The seeder needs only `authId`; the remaining optional fields populate
 * the emulator's profile metadata so the Auth emulator UI shows something
 * meaningful when an engineer pokes around locally.
 */
export interface SeedableEmulatorUser {
  authId: string;
  nameFirst?: string | null;
  nameLast?: string | null;
}

/**
 * Credentials for one emulator-seeded user, written into the Cypress fixture.
 */
export interface SeededEmulatorUser {
  authId: string;
  email: string;
  password: string;
}

interface FirebaseAdminError {
  code?: string;
}

const EXISTING_USER_ERROR_CODES = new Set(['auth/uid-already-exists', 'auth/email-already-exists']);

/**
 * Seed the Firebase Auth emulator with users mirroring `baseFixture`.
 *
 * Refuses to run unless `FIREBASE_AUTH_EMULATOR_HOST` is set, as a guard
 * against accidentally creating users in production Firebase if the env
 * var leaks. Idempotent: pre-existing users (matched by UID or email) are
 * left in place.
 *
 * @param users - The users to seed (typically extracted from `baseFixture`)
 * @returns The credential pairs that callers can write into a Cypress fixture
 */
export async function seedFirebaseAuthEmulator(
  users: SeedableEmulatorUser[],
): Promise<SeededEmulatorUser[]> {
  if (!process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    throw new Error(
      '[seedFirebaseAuthEmulator] refusing to seed: FIREBASE_AUTH_EMULATOR_HOST is not set',
    );
  }

  const seeded: SeededEmulatorUser[] = [];
  let created = 0;
  let skipped = 0;

  for (const user of users) {
    const email = emulatorEmailFor(user.authId);
    const displayName = [user.nameFirst, user.nameLast].filter(Boolean).join(' ') || undefined;

    try {
      await FirebaseAuthClient.createUser({
        uid: user.authId,
        email,
        password: EMULATOR_TEST_PASSWORD,
        emailVerified: true,
        ...(displayName ? { displayName } : {}),
      });
      created += 1;
    } catch (err) {
      const code = (err as FirebaseAdminError | null)?.code;
      if (code != null && EXISTING_USER_ERROR_CODES.has(code)) {
        skipped += 1;
      } else {
        throw err;
      }
    }

    seeded.push({ authId: user.authId, email, password: EMULATOR_TEST_PASSWORD });
  }

  logger.info(
    { created, skipped, total: users.length },
    '[seedFirebaseAuthEmulator] Emulator seed complete',
  );

  return seeded;
}
