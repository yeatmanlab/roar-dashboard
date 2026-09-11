/**
 * Reset script for local development.
 *
 * Truncates all tables in both core and assessment databases. Use this when
 * you need a clean database before re-seeding.
 *
 * Run via `npm run dev:reset -w apps/backend` or `npm run dev:reset` from root.
 *
 * Usage:
 * - Clean slate: `npm run dev:reset && npm run dev:seed`
 *
 * Environment variables:
 * - CORE_DATABASE_URL: Core database connection string (required)
 * - ASSESSMENT_DATABASE_URL: Assessment database connection string (required)
 * - DOTENV_CONFIG_PATH: Override the dotenv file path (CI sets this to .env.test)
 */
import 'dotenv/config';

import { initializeDatabasePools, closeDatabasePools } from '../src/db/clients';
import { createChildLogger } from '../src/logger';
import { truncateAllTables } from '../src/test-support/db';

const logger = createChildLogger({}, { msgPrefix: '[reset] ' });

export async function runReset(): Promise<void> {
  const required = ['CORE_DATABASE_URL', 'ASSESSMENT_DATABASE_URL'] as const;
  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`Missing required env var: ${key}`);
    }
  }

  logger.info('Initializing database pools...');
  await initializeDatabasePools();

  try {
    logger.info('Truncating all tables...');
    await truncateAllTables();
    logger.info('Reset complete.');
  } finally {
    await closeDatabasePools();
  }
}

// Run directly when invoked as a script
const isDirectRun = process.argv[1]?.endsWith('reset.js') || process.argv[1]?.endsWith('reset.ts');
if (isDirectRun) {
  runReset().catch((err) => {
    logger.fatal({ err }, 'Reset failed');
    process.exit(1);
  });
}
