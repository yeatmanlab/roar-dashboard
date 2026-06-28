/**
 * Standalone seed script for local development and CI.
 *
 * Sets up a complete environment: runs migrations, truncates all tables, seeds
 * the deterministic fixture, creates a fresh OpenFGA store with the authorization
 * model, syncs FGA tuples from Postgres, optionally seeds the Firebase Auth
 * emulator, and writes fixture files for Cypress and SDK tests.
 *
 * Run via `npm run dev:seed -w apps/backend` or `npm run dev:seed` from root.
 *
 * Environment variables:
 * - CORE_DATABASE_URL: Core database connection string (required)
 * - ASSESSMENT_DATABASE_URL: Assessment database connection string (required)
 * - FGA_API_URL: OpenFGA server URL (default: http://localhost:8080)
 * - FIREBASE_AUTH_EMULATOR_HOST: When set, seeds Auth emulator users
 * - CYPRESS_FIXTURE_FILE: Path for Cypress fixture (default: /tmp/roar-cypress-fixture.json)
 * - TEST_FIXTURE_FILE: Path for SDK fixture (default: /tmp/roar-test-fixture.json)
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { TestFixture } from '@roar-platform/api-contract/test-fixture.type';

import { initializeDatabasePools, closeDatabasePools } from '../src/db/clients';
import { logger } from '../src/logger';
import { runMigrations, truncateAllTables } from '../src/test-support/db';
import { setupFdwForTests } from '../src/test-support/db/setup-fdw';
import { deleteFgaStore, initializeFgaTestStore, syncFgaTuplesFromPostgres } from '../src/test-support/fga';
import {
  seedFirebaseAuthEmulator,
  type SeedableEmulatorUser,
  type SeededEmulatorUser,
} from '../src/test-support/firebase-emulator';
import { seedDevFixture, DEV_IDS, DEV_USERS, DEV_FIXTURE_USER_KEYS, DEV_PASSWORD } from '../tooling';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const LOG_PREFIX = '[seed]';

const { TEST_FIXTURE_FILE = '/tmp/roar-test-fixture.json', CYPRESS_FIXTURE_FILE = '/tmp/roar-cypress-fixture.json' } =
  process.env;

/**
 * Resolve the active dotenv file path.
 *
 * Uses `DOTENV_CONFIG_PATH` when set (CI points this to `.env.test`),
 * otherwise defaults to `.env` in the package root (`apps/backend/`).
 */
function resolveEnvFilePath(): string {
  if (process.env.DOTENV_CONFIG_PATH) {
    return path.resolve(process.env.DOTENV_CONFIG_PATH);
  }
  return path.resolve(__dirname, '..', '.env');
}

/**
 * Upsert key=value pairs in the active dotenv file.
 *
 * Replaces existing lines for each key; appends any keys that aren't already
 * present. Safe to call on repeated seed runs — values are updated in place
 * rather than duplicated.
 */
function upsertEnvVars(vars: Record<string, string>): void {
  const envPath = resolveEnvFilePath();

  let content = '';
  if (fs.existsSync(envPath)) {
    content = fs.readFileSync(envPath, 'utf-8');
  }

  for (const [key, value] of Object.entries(vars)) {
    const pattern = new RegExp(`^${key}=.*$`, 'm');
    const line = `${key}=${value}`;
    if (pattern.test(content)) {
      content = content.replace(pattern, line);
    } else {
      content = content.trimEnd() + '\n' + line + '\n';
    }
  }

  fs.writeFileSync(envPath, content);
  logger.info({ path: envPath, keys: Object.keys(vars) }, 'Wrote env vars to dotenv file');
}

/**
 * Build a Cypress fixture user entry from the dev user definition and
 * optional emulator credentials (email/password override).
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
 */
function writeCypressFixtureFile(seededUsers?: SeededEmulatorUser[]): void {
  const byAuthId = seededUsers ? new Map(seededUsers.map((u) => [u.authId, u])) : null;

  const users = Object.fromEntries(
    DEV_FIXTURE_USER_KEYS.map((key) => {
      const user = DEV_USERS[key];
      const creds = byAuthId?.get(user.authId);

      if (byAuthId && !creds) {
        throw new Error(`${LOG_PREFIX} Missing seeded credentials for fixture key "${key}"`);
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

async function main(): Promise<void> {
  const required = ['CORE_DATABASE_URL', 'ASSESSMENT_DATABASE_URL'] as const;
  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`${LOG_PREFIX} Missing required env var: ${key}`);
    }
  }

  logger.info(`${LOG_PREFIX} Initializing database pools...`);
  await initializeDatabasePools();

  try {
    // FDW prerequisites must run before migrations because migration SQL
    // references the assessment_server foreign server.
    logger.info(`${LOG_PREFIX} Setting up FDW...`);
    await setupFdwForTests();

    logger.info(`${LOG_PREFIX} Running migrations...`);
    await runMigrations();

    logger.info(`${LOG_PREFIX} Truncating all tables...`);
    await truncateAllTables();

    logger.info(`${LOG_PREFIX} Seeding fixture data...`);
    await seedDevFixture();

    // FGA: delete the previous store (if any) and create a fresh one.
    if (!process.env.FGA_API_URL) {
      process.env.FGA_API_URL = 'http://localhost:4010';
    }

    if (process.env.FGA_STORE_ID) {
      logger.info({ storeId: process.env.FGA_STORE_ID }, `${LOG_PREFIX} Deleting previous FGA store...`);
      await deleteFgaStore(process.env.FGA_STORE_ID);
    }

    logger.info(`${LOG_PREFIX} Creating FGA store and deploying model...`);
    await initializeFgaTestStore();

    // Persist FGA IDs to the active dotenv file so the backend server (a
    // separate process) picks them up via `import 'dotenv/config'`.
    upsertEnvVars({
      FGA_STORE_ID: process.env.FGA_STORE_ID!,
      FGA_MODEL_ID: process.env.FGA_MODEL_ID!,
    });

    logger.info(`${LOG_PREFIX} Syncing FGA tuples from Postgres...`);
    await syncFgaTuplesFromPostgres();

    // Seed Firebase Auth emulator users when the emulator is running.
    if (process.env.FIREBASE_AUTH_EMULATOR_HOST) {
      logger.info(`${LOG_PREFIX} Seeding Firebase Auth emulator...`);
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

    logger.info(`${LOG_PREFIX} Seed complete.`);
  } finally {
    await closeDatabasePools();
  }
}

main().catch((err) => {
  logger.fatal({ err }, `${LOG_PREFIX} Seed failed`);
  process.exit(1);
});
