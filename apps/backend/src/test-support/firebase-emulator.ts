/**
 * Firebase Auth Emulator seeding helpers for the dev seed script and CI.
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
import { createChildLogger } from '../logger';

const logger = createChildLogger({}, { msgPrefix: '[firebase-emulator] ' });

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
 *
 * When `email` is provided (e.g. from the dev fixture), it is used directly.
 * Otherwise, a deterministic email is derived from `authId` via `emulatorEmailFor()`.
 */
export interface SeedableEmulatorUser {
  authId: string;
  email?: string;
  password?: string;
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
 * Delete all users from the Firebase Auth emulator.
 *
 * Uses the emulator's REST API to clear the user store, ensuring a clean
 * slate before re-seeding. This is necessary because the emulator's
 * in-memory state persists across seed runs (unlike Postgres which is
 * truncated), and the seeder skips users whose UID already exists.
 *
 * @param projectId - The Google Cloud project ID (e.g. 'demo-roar')
 */
export async function clearFirebaseAuthEmulator(projectId: string): Promise<void> {
  const emulatorHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  if (!emulatorHost) {
    throw new Error('Refusing to clear: FIREBASE_AUTH_EMULATOR_HOST is not set');
  }

  const url = `http://${emulatorHost}/emulator/v1/projects/${projectId}/accounts`;
  const res = await fetch(url, { method: 'DELETE' });
  if (!res.ok) {
    throw new Error(`DELETE ${url} returned ${String(res.status)}`);
  }

  logger.info('All emulator users deleted');
}

/**
 * Seed the Firebase Auth emulator with users mirroring the dev fixture.
 *
 * Refuses to run unless `FIREBASE_AUTH_EMULATOR_HOST` is set, as a guard
 * against accidentally creating users in production Firebase if the env
 * var leaks. Clears all existing emulator users first, then creates fresh
 * ones so that email/password changes are always picked up.
 *
 * @param users - The users to seed (typically extracted from the dev fixture)
 * @returns The credential pairs that callers can write into a Cypress fixture
 */
export async function seedFirebaseAuthEmulator(users: SeedableEmulatorUser[]): Promise<SeededEmulatorUser[]> {
  if (!process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    throw new Error('Refusing to seed: FIREBASE_AUTH_EMULATOR_HOST is not set');
  }

  // Clear existing users so updated emails/passwords are always applied
  const projectId = process.env.GOOGLE_CLOUD_PROJECT ?? 'demo-roar';
  await clearFirebaseAuthEmulator(projectId);

  const seeded: SeededEmulatorUser[] = [];
  let created = 0;
  let skipped = 0;

  for (const user of users) {
    const email = user.email ?? emulatorEmailFor(user.authId);
    const password = user.password ?? EMULATOR_TEST_PASSWORD;
    const displayName = [user.nameFirst, user.nameLast].filter(Boolean).join(' ') || undefined;

    try {
      await FirebaseAuthClient.createUser({
        uid: user.authId,
        email,
        password,
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

    seeded.push({ authId: user.authId, email, password });
  }

  logger.info({ created, skipped, total: users.length }, 'Emulator seed complete');

  return seeded;
}
