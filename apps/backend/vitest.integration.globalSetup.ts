/**
 * Global Setup for Integration Tests
 *
 * This runs once before any test files are loaded.
 * - Loads .env.test so DB clients connect to test databases
 * - Runs migrations once (schema setup)
 *
 * Per-file setup (truncate + seed) happens in vitest.setup.ts
 */
import { config } from 'dotenv';

export default async function globalSetup() {
  // Debug: Log env vars before dotenv
  console.log('[globalSetup] CORE_DATABASE_URL before dotenv:', process.env.CORE_DATABASE_URL ? 'SET' : 'NOT SET');
  console.log(
    '[globalSetup] ASSESSMENT_DATABASE_URL before dotenv:',
    process.env.ASSESSMENT_DATABASE_URL ? 'SET' : 'NOT SET',
  );

  // Load .env.test with override to ensure test DB URLs are used
  config({ path: '.env.test', override: true });

  // Debug: Log env vars after dotenv
  console.log('[globalSetup] CORE_DATABASE_URL after dotenv:', process.env.CORE_DATABASE_URL ? 'SET' : 'NOT SET');
  console.log(
    '[globalSetup] ASSESSMENT_DATABASE_URL after dotenv:',
    process.env.ASSESSMENT_DATABASE_URL ? 'SET' : 'NOT SET',
  );

  // Run migrations once before any tests
  const { runMigrations, closeAllConnections } = await import('./src/test-support/db');
  await runMigrations();
  await closeAllConnections(); // Close this process's connections (tests use their own)
}
