/**
 * Global Setup for Integration Tests
 *
 * Runs once before any test files are loaded.
 * - Provisions FDW prerequisites via the shared TS helper
 * - Runs migrations once (schema setup)
 *
 * Env vars are loaded in vitest.config.ts and merged into process.env.
 */

export default async function globalSetup() {
  // Fail fast if required env vars are missing.
  const required = ['CORE_DATABASE_URL', 'ASSESSMENT_DATABASE_URL'] as const;
  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`[globalSetup] Missing required env var: ${key}`);
    }
  }

  // Provision FDW prerequisites before migrations (superuser-only operations).
  // Uses the same helper as `server-test.ts` so both bootstrap paths share one
  // implementation. The TS helper replaces an earlier execFileSync on
  // `scripts/setup-fdw-local.sh` so this works in any Node environment without
  // requiring psql on the PATH (e.g., the cypress/browsers e2e container).
  const { setupFdwForTests } = await import('./src/test-support/db/setup-fdw');
  await setupFdwForTests();

  // Initialize database pools before running migrations
  const { initializeDatabasePools, closeDatabasePools } = await import('./src/db/clients');
  await initializeDatabasePools();

  // Run migrations once before any tests
  const { runMigrations } = await import('./src/test-support/db');
  await runMigrations();

  // Initialize FGA test store (creates store + deploys authorization model)
  const { initializeFgaTestStore } = await import('./src/test-support/fga');
  await initializeFgaTestStore();

  // Close this process's connections (tests use their own)
  await closeDatabasePools();
}
