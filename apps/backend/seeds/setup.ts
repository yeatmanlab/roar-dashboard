/**
 * Infrastructure setup for local development.
 *
 * Sets up the database and authorization infrastructure without seeding data:
 * FDW prerequisites, Drizzle migrations, and a fresh OpenFGA store with the
 * authorization model deployed. FGA store and model IDs are persisted to the
 * active dotenv file so the backend server picks them up.
 *
 * Run via `npm run dev:setup -w apps/backend` or `npm run dev:setup` from root.
 *
 * Environment variables:
 * - CORE_DATABASE_URL: Core database connection string (required)
 * - ASSESSMENT_DATABASE_URL: Assessment database connection string (required)
 * - FGA_API_URL: OpenFGA server URL (default: http://localhost:4010)
 * - DOTENV_CONFIG_PATH: Override the dotenv file path (CI sets this to .env.test)
 */
import 'dotenv/config';

import { initializeDatabasePools, closeDatabasePools } from '../src/db/clients';
import { createChildLogger } from '../src/logger';
import { runMigrations } from '../src/test-support/db';
import { setupFdwForTests } from '../src/test-support/db/setup-fdw';
import { deleteFgaStore, initializeFgaTestStore } from '../src/test-support/fga';
import { upsertEnvVars } from './utils/dotenv';

const logger = createChildLogger({}, { msgPrefix: '[setup] ' });

export async function runSetup(): Promise<void> {
  const required = ['CORE_DATABASE_URL', 'ASSESSMENT_DATABASE_URL'] as const;
  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`Missing required env var: ${key}`);
    }
  }

  logger.info('Initializing database pools...');
  await initializeDatabasePools();

  try {
    // FDW prerequisites must run before migrations because migration SQL
    // references the assessment_server foreign server.
    logger.info('Setting up FDW...');
    await setupFdwForTests();

    logger.info('Running migrations...');
    await runMigrations();

    // FGA: delete the previous store (if any) and create a fresh one.
    if (!process.env.FGA_API_URL) {
      process.env.FGA_API_URL = 'http://localhost:4010';
    }

    if (process.env.FGA_STORE_ID) {
      logger.info({ storeId: process.env.FGA_STORE_ID }, 'Deleting previous FGA store...');
      await deleteFgaStore(process.env.FGA_STORE_ID);
    }

    logger.info('Creating FGA store and deploying model...');
    await initializeFgaTestStore();

    // Persist FGA IDs to the active dotenv file so the backend server (a
    // separate process) picks them up via `import 'dotenv/config'`.
    upsertEnvVars({
      FGA_STORE_ID: process.env.FGA_STORE_ID!,
      FGA_MODEL_ID: process.env.FGA_MODEL_ID!,
    });

    logger.info('Setup complete.');
  } finally {
    await closeDatabasePools();
  }
}

// Run directly when invoked as a script
const isDirectRun = process.argv[1]?.endsWith('setup.js') || process.argv[1]?.endsWith('setup.ts');
if (isDirectRun) {
  runSetup().catch((err) => {
    logger.fatal({ err }, 'Setup failed');
    process.exit(1);
  });
}
