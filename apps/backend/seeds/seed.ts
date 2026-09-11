/**
 * Seed fixture data for local development and CI.
 *
 * Populates the database with the deterministic dev fixture, syncs FGA tuples
 * from Postgres junction tables, optionally seeds Firebase Auth emulator users,
 * and writes Cypress and SDK fixture files.
 *
 * Requires `dev:setup` to have been run first (migrations applied, FGA store
 * created, FGA IDs in .env).
 *
 * Run via `npm run dev:seed -w apps/backend` or `npm run dev:seed` from root.
 *
 * Environment variables:
 * - CORE_DATABASE_URL: Core database connection string (required)
 * - ASSESSMENT_DATABASE_URL: Assessment database connection string (required)
 * - FGA_API_URL: OpenFGA server URL (default: http://localhost:4010)
 * - FGA_STORE_ID: OpenFGA store ID (required — set by dev:setup)
 * - FGA_MODEL_ID: OpenFGA model ID (required — set by dev:setup)
 * - FIREBASE_AUTH_EMULATOR_HOST: When set, seeds Auth emulator users
 * - CYPRESS_FIXTURE_FILE: Path for Cypress fixture (default: /tmp/roar-cypress-fixture.json)
 * - TEST_FIXTURE_FILE: Path for SDK fixture (default: /tmp/roar-test-fixture.json)
 * - DOTENV_CONFIG_PATH: Override the dotenv file path (CI sets this to .env.test)
 */
import 'dotenv/config';
import fs from 'node:fs';

import type { TestFixture } from '@roar-platform/api-contract/test-fixture.type';

import { initializeDatabasePools, closeDatabasePools } from '../src/db/clients';
import { createChildLogger } from '../src/logger';
import { syncFgaTuplesFromPostgres } from '../src/test-support/fga';
import {
  seedFirebaseAuthEmulator,
  type SeedableEmulatorUser,
  type SeededEmulatorUser,
} from '../src/test-support/firebase-emulator';
import { seedDevFixture, DEV_IDS, DEV_USERS, DEV_FIXTURE_USER_KEYS, DEV_PASSWORD } from './fixture';

const logger = createChildLogger({}, { msgPrefix: '[seed] ' });

const { TEST_FIXTURE_FILE = '/tmp/roar-test-fixture.json', CYPRESS_FIXTURE_FILE = '/tmp/roar-cypress-fixture.json' } =
  process.env;

/**
 * Build a Cypress fixture user entry from the dev user definition and
 * optional emulator credentials (email/password override).
 *
 * @param key - Fixture user key (e.g. `'schoolATeacher'`)
 * @param creds - Emulator-issued credentials; falls back to dev fixture defaults
 * @returns Tuple of `[key, userRecord]` for use with `Object.fromEntries`
 */
function buildCypressUserEntry(
  key: string,
  creds?: { email: string; password: string },
): [string, Record<string, string>] {
  const user = DEV_USERS[key as keyof typeof DEV_USERS];
  return [
    key,
    {
      id: user.id,
      authId: user.authId,
      email: creds?.email ?? user.email,
      password: creds?.password ?? DEV_PASSWORD,
      nameFirst: user.nameFirst,
      nameLast: user.nameLast,
      userType: user.userType,
    },
  ];
}

/**
 * Write the Cypress fixture file with one entry per fixture user.
 *
 * When `seededUsers` is provided (Auth emulator is running), credentials
 * come from the emulator. Otherwise, deterministic values from the dev
 * fixture are used directly.
 *
 * @param seededUsers - Emulator-issued credentials; omit when emulator is not running
 */
function writeCypressFixtureFile(seededUsers?: SeededEmulatorUser[]): void {
  const byAuthId = seededUsers ? new Map(seededUsers.map((u) => [u.authId, u])) : null;

  const users = Object.fromEntries(
    DEV_FIXTURE_USER_KEYS.map((key) => {
      const user = DEV_USERS[key];
      const creds = byAuthId?.get(user.authId);

      if (byAuthId && !creds) {
        throw new Error(`Missing seeded credentials for fixture key "${key}"`);
      }

      return buildCypressUserEntry(key, creds);
    }),
  );

  // Expose a ready-made progress-report scenario so e2e specs don't have to
  // rediscover seeded IDs through the API.
  const progress = {
    schoolA: {
      administrationId: DEV_IDS.administrationSchoolA,
      scopeType: 'school' as const,
      scopeId: DEV_IDS.schoolA,
      adminUserKey: 'schoolAAdmin' as const,
      completedUserId: DEV_IDS.schoolAStudent,
      startedUserId: DEV_IDS.classAStudent,
    },
  };

  fs.writeFileSync(CYPRESS_FIXTURE_FILE, JSON.stringify({ users, progress }, null, 2));
  logger.info(
    { fixtureFile: CYPRESS_FIXTURE_FILE, userCount: DEV_FIXTURE_USER_KEYS.length },
    'Cypress fixture written',
  );
}

/** Write the SDK test fixture file with deterministic IDs. */
function writeSdkFixtureFile(): void {
  const fixtureData: TestFixture = {
    testUser: {
      id: DEV_IDS.schoolAStudent,
      authId: DEV_IDS.schoolAStudentAuth,
      email: DEV_USERS.schoolAStudent.email,
      password: DEV_PASSWORD,
    },
    schoolATeacher: {
      id: DEV_IDS.schoolATeacher,
      authId: DEV_IDS.schoolATeacherAuth,
      email: DEV_USERS.schoolATeacher.email,
      password: DEV_PASSWORD,
    },
    administrationAssignedToDistrict: {
      id: DEV_IDS.administrationDistrict,
    },
    administrationAssignedToDistrictB: {
      id: DEV_IDS.administrationDistrictB,
    },
    variantForAllGrades: { id: DEV_IDS.variantAllGrades },
    variantForGrade5: { id: DEV_IDS.variantGrade5 },
    variantForGrade3: { id: DEV_IDS.variantGrade3 },
    variantOptionalForEll: { id: DEV_IDS.variantOptionalEll },
    variantForTask2: { id: DEV_IDS.variantTask2 },
    variantForTask2Grade5OptionalEll: { id: DEV_IDS.variantTask2Grade5Ell },
  };

  fs.writeFileSync(TEST_FIXTURE_FILE, JSON.stringify(fixtureData, null, 2));
  logger.info({ fixtureFile: TEST_FIXTURE_FILE }, 'SDK test fixture written');
}

export async function runSeed(): Promise<void> {
  const required = ['CORE_DATABASE_URL', 'ASSESSMENT_DATABASE_URL'] as const;
  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`Missing required env var: ${key}`);
    }
  }

  logger.info('Initializing database pools...');
  await initializeDatabasePools();

  try {
    logger.info('Seeding fixture data...');
    await seedDevFixture();

    // Default FGA_API_URL for local dev
    if (!process.env.FGA_API_URL) {
      process.env.FGA_API_URL = 'http://localhost:4010';
    }

    logger.info('Syncing FGA tuples from Postgres...');
    await syncFgaTuplesFromPostgres();

    // Seed Firebase Auth emulator users when the emulator is running.
    if (process.env.FIREBASE_AUTH_EMULATOR_HOST) {
      logger.info('Seeding Firebase Auth emulator...');
      const seedable: SeedableEmulatorUser[] = DEV_FIXTURE_USER_KEYS.map((key) => ({
        authId: DEV_USERS[key].authId,
        email: DEV_USERS[key].email,
        password: DEV_PASSWORD,
        nameFirst: DEV_USERS[key].nameFirst,
        nameLast: DEV_USERS[key].nameLast,
      }));
      const seeded = await seedFirebaseAuthEmulator(seedable);
      writeCypressFixtureFile(seeded);
    } else {
      writeCypressFixtureFile();
    }

    writeSdkFixtureFile();

    logger.info('Seed complete.');
  } finally {
    await closeDatabasePools();
  }
}

// Run directly when invoked as a script
const isDirectRun = process.argv[1]?.endsWith('seed.js') || process.argv[1]?.endsWith('seed.ts');
if (isDirectRun) {
  runSeed().catch((err) => {
    logger.fatal({ err }, 'Seed failed');
    process.exit(1);
  });
}
