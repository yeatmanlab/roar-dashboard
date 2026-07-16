/**
 * Combined setup + seed script for local development and CI.
 *
 * Runs the full pipeline: infrastructure setup (FDW, migrations, FGA store),
 * table truncation, then data seeding (fixture, FGA tuples, Auth emulator,
 * fixture files).
 *
 * This is a convenience wrapper — the individual steps can be run separately:
 * - `npm run dev:setup` — infrastructure only (FDW, migrations, FGA store)
 * - `npm run dev:seed`  — seed data only (fixture, FGA tuples, emulator, fixture files)
 * - `npm run dev:reset` — truncate all tables (run before dev:seed for a clean slate)
 *
 * Environment variables:
 * - CORE_DATABASE_URL: Core database connection string (required)
 * - ASSESSMENT_DATABASE_URL: Assessment database connection string (required)
 * - FGA_API_URL: OpenFGA server URL (default: http://localhost:4010)
 * - FIREBASE_AUTH_EMULATOR_HOST: When set, seeds Auth emulator users
 * - CYPRESS_FIXTURE_FILE: Path for Cypress fixture (default: /tmp/roar-cypress-fixture.json)
 * - TEST_FIXTURE_FILE: Path for SDK fixture (default: /tmp/roar-test-fixture.json)
 * - DOTENV_CONFIG_PATH: Override the dotenv file path (CI sets this to .env.test)
 */
import 'dotenv/config';

import { createChildLogger } from '../src/logger';
import { runReset } from './reset';
import { runSetup } from './setup';
import { runSeed } from './seed';

const logger = createChildLogger({}, { msgPrefix: '[dev] ' });

async function main(): Promise<void> {
  logger.info('Running full dev environment pipeline (setup + seed)...');

  await runSetup();

  // Re-load the dotenv file so the FGA store/model IDs written by setup are
  // available to the seed step (which needs them for tuple sync).
  // Manual `config()` does NOT read `DOTENV_CONFIG_PATH` — only the
  // `import 'dotenv/config'` preload respects it — so we must pass the path
  // explicitly to avoid reloading `.env` when CI sets DOTENV_CONFIG_PATH to
  // `.env.test`.
  const { config } = await import('dotenv');
  const dotenvPath = process.env.DOTENV_CONFIG_PATH;
  config({ override: true, ...(dotenvPath ? { path: dotenvPath } : {}) });

  // Truncate all tables before seeding so the pipeline is idempotent.
  // In CI the backend integration tests may have seeded data into the
  // same Postgres instance before the SDK tests call this script.
  await runReset();

  await runSeed();

  logger.info('Dev environment ready.');
}

main().catch((err) => {
  logger.fatal({ err }, 'Dev environment setup failed');
  process.exit(1);
});
