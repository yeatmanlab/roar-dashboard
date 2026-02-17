/**
 * Global Setup for Integration Tests
 *
 * Runs once before any test files are loaded.
 * - Runs migrations once (schema setup)
 *
 * Env vars are loaded in vitest.config.ts and merged into process.env.
 */

export default async function globalSetup() {
  // Fail fast if required env vars are missing.
  // (Optional but strongly recommended)
  const required = ['CORE_DATABASE_URL', 'ASSESSMENT_DATABASE_URL'] as const;
  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`[globalSetup] Missing required env var: ${key}`);
    }
  }

  // Initialize database pools before running migrations
  const { initializeDatabasePools, closeDatabasePools } = await import('./src/db/clients');
  await initializeDatabasePools();

  // Run migrations once before any tests
  const { runMigrations } = await import('./src/test-support/db');
  await runMigrations();

  // Close this process's connections (tests use their own)
  await closeDatabasePools();
}
