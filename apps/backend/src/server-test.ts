/**
 * Test Server Entrypoint
 *
 * Dedicated server for SDK integration tests. Composes existing backend test-support utilities
 * into a runnable server without modifying production code.
 *
 * This server:
 * 1. Initializes database pools and runs migrations
 * 2. Truncates all tables and seeds baseFixture test data
 * 3. Initializes OpenFGA store, deploys authorization model, and syncs tuples
 * 4. Mocks AuthService to accept test tokens (token string = Firebase UID)
 * 5. Writes fixture data to a temp JSON file for SDK tests to discover
 * 6. Starts Express server on the specified port
 *
 * Environment variables:
 * - PORT: Server port (default: 4000)
 * - CORE_DATABASE_URL: Core database connection string (required)
 * - ASSESSMENT_DATABASE_URL: Assessment database connection string (required)
 * - FGA_API_URL: OpenFGA server URL (default: http://localhost:8080)
 * - TEST_FIXTURE_FILE: Path to write fixture data JSON (default: /tmp/roar-test-fixture.json)
 *
 * Usage:
 *   NODE_ENV=production node dist/server-test.js
 */

import 'dotenv/config';
import fs from 'fs';

import type { TestFixture } from '@roar-dashboard/api-contract/test-fixture.type';
import { seedBaseFixture } from './test-support/fixtures';
import { initializeFgaTestStore, syncFgaTuplesFromPostgres } from './test-support/fga';
import { AuthService } from './services/auth/auth.service';
import { TestAuthProvider } from './services/auth/providers/test-auth.provider';
import { logger } from './logger';

const { PORT = '4000', TEST_FIXTURE_FILE = '/tmp/roar-test-fixture.json' } = process.env;

let server: http.Server;

/**
 * Mock AuthService to use TestAuthProvider for SDK tests.
 *
 * This allows SDK tests to use simple test tokens (token string = Firebase UID)
 * without requiring real Firebase credentials or environment setup.
 */
function mockAuthService(): void {
  // Replace the provider with TestAuthProvider
  // @ts-expect-error Accessing private static field for testing purposes
  AuthService.provider = new TestAuthProvider();
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

  const fixtureData: TestFixture = {
    testUser: {
      authId: baseFixture.schoolAStudent.authId,
    },
    schoolATeacher: {
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

    // 3. Run migrations
    logger.info('[server-test] Running migrations...');
    await runMigrations();

    // 4. Truncate all tables and seed baseFixture
    logger.info('[server-test] Truncating tables and seeding baseFixture...');
    await truncateAllTables();
    await seedBaseFixture();

    // 5. Initialize FGA store, deploy model, and sync tuples
    logger.info('[server-test] Initializing FGA test store...');
    await initializeFgaTestStore();

    logger.info('[server-test] Syncing FGA tuples from Postgres...');
    await syncFgaTuplesFromPostgres();

    // 6. Mock AuthService to use TestAuthProvider
    logger.info('[server-test] Mocking AuthService with TestAuthProvider...');
    mockAuthService();

    // 7. Write fixture data to file
    logger.info('[server-test] Writing fixture data to file...');
    await writeFixtureFile(TEST_FIXTURE_FILE);

    // 8. Dynamic import app AFTER all setup is complete
    logger.info('[server-test] Importing Express app...');
    const { default: app }: { default: Express } = await import('./app');

    // 9. Start HTTP server
    const port = parseInt(PORT, 10);
    app.set('port', port);

    server = http.createServer(app);
    server.listen(port, () => {
      logger.info(`[server-test] HTTP server listening on http://0.0.0.0:${port}`);
    });

    server.on('error', (err) => onError(err, port));
    server.on('listening', onListening);

    // 10. Graceful shutdown
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
