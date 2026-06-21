/**
 * Standalone dev seed script.
 *
 * Truncates all tables, seeds the deterministic dev fixture, initializes FGA
 * (creating a store + deploying the model if needed), syncs FGA tuples from
 * Postgres, seeds the Firebase Auth emulator (if running), and writes fixture
 * files for Cypress and SDK tests.
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
 *
 * Usage:
 *   npx tsx ./scripts/seed-dev.ts
 */
import 'dotenv/config';
import fs from 'node:fs';
import type { TestFixture } from '@roar-platform/api-contract/test-fixture.type';
import { initializeDatabasePools, closeDatabasePools } from '../src/db/clients';
import { runMigrations, truncateAllTables } from '../src/test-support/db';
import { initializeFgaTestStore, syncFgaTuplesFromPostgres } from '../src/test-support/fga';
import {
  seedFirebaseAuthEmulator,
  type SeedableEmulatorUser,
  type SeededEmulatorUser,
} from '../src/test-support/firebase-emulator';
import { FgaClient } from '../src/clients/fga.client';
import { seedDevFixture, DEV_IDS, DEV_USERS, DEV_FIXTURE_USER_KEYS, DEV_PASSWORD } from '../tooling';
import { logger } from '../src/logger';

const { TEST_FIXTURE_FILE = '/tmp/roar-test-fixture.json', CYPRESS_FIXTURE_FILE = '/tmp/roar-cypress-fixture.json' } =
  process.env;

/**
 * Try to read FGA store/model IDs from the Docker-managed fga-env volume.
 *
 * When running with `docker compose up`, the openfga-init container writes
 * store/model IDs to `/fga-env/fga-env.json` (a Docker named volume). If
 * available, we set the env vars so the FgaClient picks them up — no need
 * to create a new store.
 *
 * @returns true if IDs were loaded from the volume, false otherwise
 */
function tryLoadFgaEnvFromDocker(): boolean {
  // Docker volume path (inside container or bind-mounted)
  const dockerVolumePath = '/fga-env/fga-env.json';
  // Also check a local fallback path for non-Docker environments
  const localFallbackPath = '/tmp/roar-fga-env.json';

  for (const envPath of [dockerVolumePath, localFallbackPath]) {
    try {
      if (fs.existsSync(envPath)) {
        const data = JSON.parse(fs.readFileSync(envPath, 'utf-8')) as {
          FGA_STORE_ID?: string;
          FGA_MODEL_ID?: string;
        };
        if (data.FGA_STORE_ID && data.FGA_MODEL_ID) {
          process.env.FGA_STORE_ID = data.FGA_STORE_ID;
          process.env.FGA_MODEL_ID = data.FGA_MODEL_ID;
          logger.info({ path: envPath, storeId: data.FGA_STORE_ID }, 'Loaded FGA store/model IDs from file');
          return true;
        }
      }
    } catch {
      // File doesn't exist or is malformed — try the next path
    }
  }

  return false;
}

/**
 * Write the Cypress fixture file with one entry per dev user.
 */
function writeCypressFixtureFile(seeded: SeededEmulatorUser[]): void {
  const byAuthId = new Map(seeded.map((u) => [u.authId, u]));

  const users = Object.fromEntries(
    DEV_FIXTURE_USER_KEYS.map((key) => {
      const user = DEV_USERS[key];
      const creds = byAuthId.get(user.authId);
      if (!creds) {
        throw new Error(`[seed-dev] Missing seeded credentials for fixture key "${key}"`);
      }
      return [
        key,
        {
          id: user.id,
          authId: user.authId,
          email: creds.email,
          password: creds.password,
          nameFirst: user.nameFirst,
          nameLast: user.nameLast,
          userType: user.userType,
        },
      ];
    }),
  );

  fs.writeFileSync(CYPRESS_FIXTURE_FILE, JSON.stringify({ users }, null, 2));
  logger.info({ fixtureFile: CYPRESS_FIXTURE_FILE, userCount: seeded.length }, 'Cypress fixture written');
}

/**
 * Write the SDK test fixture file with deterministic IDs.
 */
function writeSdkFixtureFile(): void {
  const fixtureData: TestFixture = {
    testUser: {
      id: DEV_IDS.schoolAStudent,
      authId: DEV_IDS.schoolAStudentAuth,
    },
    schoolATeacher: {
      id: DEV_IDS.schoolATeacher,
      authId: DEV_IDS.schoolATeacherAuth,
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
  // 1. Validate required environment variables
  const required = ['CORE_DATABASE_URL', 'ASSESSMENT_DATABASE_URL'] as const;
  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`[seed-dev] Missing required env var: ${key}`);
    }
  }

  // 2. Initialize database pools
  logger.info('[seed-dev] Initializing database pools...');
  await initializeDatabasePools();

  try {
    // 3. Run migrations (ensures schema is current)
    logger.info('[seed-dev] Running migrations...');
    await runMigrations();

    // 4. Truncate all tables
    logger.info('[seed-dev] Truncating all tables...');
    await truncateAllTables();

    // 5. Seed the deterministic dev fixture
    logger.info('[seed-dev] Seeding dev fixture...');
    await seedDevFixture();

    // 6. Initialize FGA store + model
    // Try to read store/model IDs from Docker volume first (written by openfga-init container).
    // If not available (e.g. CI), create a new store via the Node.js SDK.
    logger.info('[seed-dev] Setting up FGA...');
    if (!process.env.FGA_API_URL) {
      process.env.FGA_API_URL = 'http://localhost:8080';
    }

    const dockerFgaLoaded = tryLoadFgaEnvFromDocker();
    if (dockerFgaLoaded) {
      // Docker already created the store; just clear the FgaClient cache so it picks up the env vars
      FgaClient.clearCache();
    } else {
      // CI path: create a fresh FGA store and deploy the model
      logger.info('[seed-dev] No Docker FGA env found, creating FGA store via SDK...');
      await initializeFgaTestStore();

      // Write the IDs to a fallback file so the backend server can read them
      const fgaEnv = {
        FGA_STORE_ID: process.env.FGA_STORE_ID,
        FGA_MODEL_ID: process.env.FGA_MODEL_ID,
      };
      fs.writeFileSync('/tmp/roar-fga-env.json', JSON.stringify(fgaEnv, null, 2));
      logger.info({ path: '/tmp/roar-fga-env.json' }, 'FGA env written for backend server');
    }

    // 7. Sync FGA tuples from Postgres
    logger.info('[seed-dev] Syncing FGA tuples from Postgres...');
    await syncFgaTuplesFromPostgres();

    // 8. Seed Firebase Auth emulator users (if running)
    if (process.env.FIREBASE_AUTH_EMULATOR_HOST) {
      logger.info('[seed-dev] Seeding Firebase Auth emulator...');
      const seedable: SeedableEmulatorUser[] = DEV_FIXTURE_USER_KEYS.map((key) => ({
        authId: DEV_USERS[key].authId,
        nameFirst: DEV_USERS[key].nameFirst,
        nameLast: DEV_USERS[key].nameLast,
      }));
      const seeded = await seedFirebaseAuthEmulator(seedable);
      writeCypressFixtureFile(seeded);
    } else {
      // No emulator — write a Cypress fixture with deterministic email/password
      // so downstream scripts have a consistent file format
      const users = Object.fromEntries(
        DEV_FIXTURE_USER_KEYS.map((key) => {
          const user = DEV_USERS[key];
          return [
            key,
            {
              id: user.id,
              authId: user.authId,
              email: `${user.authId}@test.local`,
              password: DEV_PASSWORD,
              nameFirst: user.nameFirst,
              nameLast: user.nameLast,
              userType: user.userType,
            },
          ];
        }),
      );
      fs.writeFileSync(CYPRESS_FIXTURE_FILE, JSON.stringify({ users }, null, 2));
      logger.info({ fixtureFile: CYPRESS_FIXTURE_FILE }, 'Cypress fixture written (no emulator)');
    }

    // 9. Write SDK test fixture file
    writeSdkFixtureFile();

    logger.info('[seed-dev] Seed complete.');
  } finally {
    // 10. Close DB pools
    await closeDatabasePools();
  }
}

main().catch((err) => {
  logger.fatal({ err }, '[seed-dev] Seed failed');
  process.exit(1);
});
