/**
 * Test Server Entrypoint
 *
 * Dedicated server for SDK integration tests and Cypress e2e runs.
 * Composes existing backend test-support utilities into a runnable server
 * without modifying production code.
 *
 * This server:
 * 1. Initializes database pools and runs migrations
 * 2. Truncates all tables and seeds baseFixture test data
 * 3. Initializes OpenFGA store, deploys authorization model, and syncs tuples
 * 4. Swaps `AuthService.provider` for either:
 *    - `TestAuthProvider` (default): token string == Firebase UID, no
 *      signature verification. Used by SDK integration tests.
 *    - `FirebaseAuthProvider`: real Admin SDK verification, pointed at the
 *      Firebase Auth emulator when `FIREBASE_AUTH_EMULATOR_HOST` is set.
 *      Used by Cypress e2e so the auth path mirrors production.
 * 5. Seeds the Firebase Auth emulator (when in emulator mode) with users
 *    mirroring baseFixture's authIds, and writes a Cypress-side fixture
 *    file with the deterministic credentials
 * 6. Writes the SDK fixture data to a temp JSON file for SDK tests to discover
 * 7. Starts Express server on the specified port
 *
 * Environment variables:
 * - PORT: Server port (default: 4000)
 * - CORE_DATABASE_URL: Core database connection string (required)
 * - ASSESSMENT_DATABASE_URL: Assessment database connection string (required)
 * - FGA_API_URL: OpenFGA server URL (default: http://localhost:8080)
 * - TEST_FIXTURE_FILE: Path to write SDK fixture JSON (default: /tmp/roar-test-fixture.json)
 * - FIREBASE_AUTH_EMULATOR_HOST: When set, switches to real Firebase Admin
 *   SDK verification against the emulator, seeds emulator users, and writes
 *   the Cypress fixture file
 * - CYPRESS_FIXTURE_FILE: Path to write Cypress fixture JSON (default: /tmp/roar-cypress-fixture.json).
 *   Ignored when `FIREBASE_AUTH_EMULATOR_HOST` is not set.
 *
 * Usage:
 *   NODE_ENV=production node dist/server-test.js
 */

import 'dotenv/config';
import fs from 'fs';
import http from 'http';
import type { Express } from 'express';
import type { TestFixture } from '@roar-platform/api-contract/test-fixture.type';
import { initializeDatabasePools, closeDatabasePools } from './db/clients';
import { truncateAllTables, runMigrations, setupFdwForTests } from './test-support/db';
import { seedBaseFixture, type BaseFixture } from './test-support/fixtures';
import { initializeFgaTestStore, syncFgaTuplesFromPostgres } from './test-support/fga';
import {
  seedFirebaseAuthEmulator,
  type SeedableEmulatorUser,
  type SeededEmulatorUser,
} from './test-support/firebase-emulator';
import { AuthService } from './services/auth/auth.service';
import { TestAuthProvider } from './services/auth/providers/test-auth.provider';
import { FirebaseAuthProvider } from './services/auth/providers/firebase-auth.provider';
import { logger } from './logger';

const {
  PORT = '4000',
  TEST_FIXTURE_FILE = '/tmp/roar-test-fixture.json',
  CYPRESS_FIXTURE_FILE = '/tmp/roar-cypress-fixture.json',
} = process.env;

/**
 * Which baseFixture users to seed into the Firebase Auth emulator and expose
 * in the Cypress fixture file. Each key here becomes a logical user name that
 * Cypress can pass to `cy.loginAsTestUser(...)`. Adding a new tier of user
 * means: extend `baseFixture` (or pick an existing one), add the key here,
 * and migration specs can sign in as that user.
 */
const CYPRESS_FIXTURE_USER_KEYS = [
  'districtAdmin',
  'schoolAAdmin',
  'schoolATeacher',
  'schoolAStudent',
  'classATeacher',
  'classAStudent',
  'groupStudent',
  'districtBAdmin',
] as const satisfies ReadonlyArray<keyof BaseFixture>;

// This server is run with NODE_ENV=production to exercise the built artifact, which makes
// ALLOWED_ORIGINS a required var (parseAllowedOrigins throws when it is unset in production).
// Default it to localhost so the test harness boots; SDK requests are server-to-server, so the
// CORS allowlist value is irrelevant here. A real deployment must still set ALLOWED_ORIGINS.
if (!process.env.ALLOWED_ORIGINS) {
  process.env.ALLOWED_ORIGINS = 'https://localhost:5173';
}

let server: http.Server;

/**
 * Swap the AuthService provider based on whether we're booting against the
 * Firebase Auth emulator.
 *
 * - With `FIREBASE_AUTH_EMULATOR_HOST` set: use the real
 *   `FirebaseAuthProvider`. The Admin SDK detects the emulator host and
 *   skips signature verification on emulator-issued tokens, so Cypress can
 *   sign in via the Firebase Web SDK and have the resulting ID token verify
 *   through the same code path as production.
 * - Otherwise: use `TestAuthProvider` (token string == Firebase UID). This
 *   is the path the assessment SDK integration tests take.
 */
function mockAuthService(): void {
  if (process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    // @ts-expect-error Accessing private static field for testing purposes
    AuthService.provider = new FirebaseAuthProvider();
    logger.info('[server-test] AuthService using FirebaseAuthProvider (emulator mode)');
  } else {
    // @ts-expect-error Accessing private static field for testing purposes
    AuthService.provider = new TestAuthProvider();
    logger.info('[server-test] AuthService using TestAuthProvider (UID-as-token mode)');
  }
}

/**
 * Collect the subset of baseFixture users that should be seeded into the
 * Firebase Auth emulator and exposed in the Cypress fixture.
 *
 * Throws if any selected user is missing an `authId`. The DB schema allows
 * `authId` to be null (rostering can produce users with no Firebase tie
 * yet), but every key in `CYPRESS_FIXTURE_USER_KEYS` points at a `baseFixture`
 * row that the factory always populates. A null here is therefore a fixture
 * regression worth failing loudly on rather than silently skipping.
 */
function collectSeedableUsers(fixture: BaseFixture): SeedableEmulatorUser[] {
  return CYPRESS_FIXTURE_USER_KEYS.map((key) => {
    const user = fixture[key];
    if (!user.authId) {
      throw new Error(`[server-test] Fixture user "${key}" has no authId — cannot seed Firebase Auth emulator`);
    }
    return {
      authId: user.authId,
      nameFirst: user.nameFirst,
      nameLast: user.nameLast,
    };
  });
}

/**
 * Write the Cypress fixture file with one entry per seeded user.
 *
 * Cypress reads this from `/tmp/roar-cypress-fixture.json` (or
 * `CYPRESS_FIXTURE_FILE`) to resolve a fixture key like 'schoolATeacher' to
 * the email + password pair the helper uses to sign in via the Firebase
 * Auth emulator.
 */
function writeCypressFixtureFile(fixture: BaseFixture, seeded: SeededEmulatorUser[], fixtureFile: string): void {
  const byAuthId = new Map(seeded.map((u) => [u.authId, u]));

  const users = Object.fromEntries(
    CYPRESS_FIXTURE_USER_KEYS.map((key) => {
      const user = fixture[key];
      // `collectSeedableUsers` already threw if any selected user had a null
      // authId, so this re-check is defensive — and it narrows `user.authId`
      // from `string | null` to `string` for the Map lookup below.
      if (!user.authId) {
        throw new Error(`[server-test] Fixture user "${key}" has no authId`);
      }
      const creds = byAuthId.get(user.authId);
      if (!creds) {
        throw new Error(`[server-test] Missing seeded credentials for fixture key "${key}"`);
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

  fs.writeFileSync(fixtureFile, JSON.stringify({ users }, null, 2));
  logger.info({ fixtureFile, userCount: seeded.length }, '[server-test] Cypress fixture written');
}

/**
 * Write fixture data to a JSON file for SDK tests to discover.
 *
 * This avoids the race condition of the dynamic import in routes/index.ts
 * and keeps test infrastructure out of production code.
 *
 * @param fixtureFile - Path to write the fixture JSON file
 */
async function writeFixtureFile(fixtureFile: string): Promise<void> {
  const { baseFixture } = await import('./test-support/fixtures');

  if (!baseFixture) {
    throw new Error('[server-test] baseFixture not seeded');
  }

  if (!baseFixture.schoolAStudent.authId) {
    throw new Error('[server-test] schoolAStudent.authId not seeded');
  }

  if (!baseFixture.schoolATeacher.authId) {
    throw new Error('[server-test] schoolATeacher.authId not seeded');
  }

  const fixtureData: TestFixture = {
    testUser: {
      id: baseFixture.schoolAStudent.id,
      authId: baseFixture.schoolAStudent.authId,
    },
    schoolATeacher: {
      id: baseFixture.schoolATeacher.id,
      authId: baseFixture.schoolATeacher.authId,
    },
    administrationAssignedToDistrict: {
      id: baseFixture.administrationAssignedToDistrict.id,
    },
    administrationAssignedToDistrictB: {
      id: baseFixture.administrationAssignedToDistrictB.id,
    },
    variantForAllGrades: { id: baseFixture.variantForAllGrades.id },
    variantForGrade5: { id: baseFixture.variantForGrade5.id },
    variantForGrade3: { id: baseFixture.variantForGrade3.id },
    variantOptionalForEll: { id: baseFixture.variantOptionalForEll.id },
    variantForTask2: { id: baseFixture.variantForTask2.id },
    variantForTask2Grade5OptionalEll: { id: baseFixture.variantForTask2Grade5OptionalEll.id },
  };

  fs.writeFileSync(fixtureFile, JSON.stringify(fixtureData, null, 2));
  logger.info({ fixtureFile }, '[server-test] Fixture data written');
}

/**
 * Handle server "error" events gracefully.
 *
 * @param error - The error object
 * @param port - The port number
 */
function onError(error: NodeJS.ErrnoException, port: number): void {
  if (error.syscall !== 'listen') throw error;

  const bind = `Port ${port}`;

  switch (error.code) {
    case 'EACCES':
      logger.fatal({ port, code: error.code }, `${bind} requires elevated privileges`);
      process.exit(1);
      break;
    case 'EADDRINUSE':
      logger.fatal({ port, code: error.code }, `${bind} is already in use`);
      process.exit(1);
      break;
    default:
      throw error;
  }
}

/**
 * Handle server "listening" events.
 */
function onListening(): void {
  const addr = server.address();
  const bind = typeof addr === 'string' ? `pipe ${addr}` : `port ${String(addr?.port)}`;
  logger.info(`[server-test] Server is listening on ${bind}`);
}

async function startTestServer(): Promise<void> {
  try {
    // 1. Validate required environment variables
    const required = ['CORE_DATABASE_URL', 'ASSESSMENT_DATABASE_URL'] as const;
    for (const key of required) {
      if (!process.env[key]) {
        throw new Error(`[server-test] Missing required env var: ${key}`);
      }
    }

    logger.info('[server-test] Initializing test server...');

    // 2. Initialize database pools
    logger.info('[server-test] Initializing database pools...');
    await initializeDatabasePools();

    // 3. Provision FDW prerequisites (extension, assessment_server, user mappings).
    // Required before migrations because migration 0056 creates foreign tables that
    // reference assessment_server. Uses a TS helper rather than shelling out to
    // scripts/setup-fdw-local.sh so this works in environments without psql on the
    // PATH (notably the cypress/browsers e2e CI container).
    logger.info('[server-test] Provisioning FDW prerequisites...');
    await setupFdwForTests();

    // 4. Run migrations
    logger.info('[server-test] Running migrations...');
    await runMigrations();

    // 5. Truncate all tables and seed baseFixture
    logger.info('[server-test] Truncating tables and seeding baseFixture...');
    await truncateAllTables();
    const fixture = await seedBaseFixture();

    // 6. Initialize FGA store, deploy model, and sync tuples
    logger.info('[server-test] Initializing FGA test store...');
    await initializeFgaTestStore();

    logger.info('[server-test] Syncing FGA tuples from Postgres...');
    await syncFgaTuplesFromPostgres();

    // 7. Swap AuthService.provider (chooses FirebaseAuthProvider when
    // FIREBASE_AUTH_EMULATOR_HOST is set; TestAuthProvider otherwise).
    logger.info('[server-test] Configuring AuthService provider...');
    mockAuthService();

    // 8. In emulator mode, seed the Firebase Auth emulator with users
    // matching baseFixture.authId and write the Cypress fixture file.
    if (process.env.FIREBASE_AUTH_EMULATOR_HOST) {
      logger.info('[server-test] Seeding Firebase Auth emulator...');
      const seedable = collectSeedableUsers(fixture);
      const seeded = await seedFirebaseAuthEmulator(seedable);
      writeCypressFixtureFile(fixture, seeded, CYPRESS_FIXTURE_FILE);
    }

    // 9. Write fixture data to file
    logger.info('[server-test] Writing fixture data to file...');
    await writeFixtureFile(TEST_FIXTURE_FILE);

    // 10. Dynamic import app AFTER all setup is complete
    logger.info('[server-test] Importing Express app...');
    const { default: app }: { default: Express } = await import('./app');

    // 11. Start HTTP server
    const port = parseInt(PORT, 10);
    app.set('port', port);

    server = http.createServer(app);
    server.listen(port, () => {
      logger.info(`[server-test] HTTP server listening on http://0.0.0.0:${port}`);
    });

    server.on('error', (err) => onError(err, port));
    server.on('listening', onListening);

    // 12. Graceful shutdown
    const shutdown = (signal: string) => {
      logger.info(`[server-test] ${signal} received: shutting down server`);
      server.close(() => {
        closeDatabasePools()
          .then(() => {
            logger.info('[server-test] Server shutdown complete');
            process.exit(0);
          })
          .catch((err) => {
            logger.error({ err }, '[server-test] Error closing database pools');
            process.exit(1);
          });
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (err) {
    logger.fatal({ err }, '[server-test] Failed to start test server');
    process.exit(1);
  }
}

startTestServer();
