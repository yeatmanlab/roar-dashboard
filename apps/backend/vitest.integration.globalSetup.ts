/**
 * Global Setup for Integration Tests
 *
 * Runs once before any test files are loaded.
 * - Runs migrations once (schema setup)
 *
 * Env vars are loaded in vitest.config.ts and merged into process.env.
 */

export default async function globalSetup() {
  // Debug: Log env vars to diagnose CI issues
  console.log('[globalSetup] CORE_DATABASE_URL:', process.env.CORE_DATABASE_URL ? 'SET' : 'NOT SET');
  console.log('[globalSetup] ASSESSMENT_DATABASE_URL:', process.env.ASSESSMENT_DATABASE_URL ? 'SET' : 'NOT SET');

  // Fail fast if required env vars are missing.
  // (Optional but strongly recommended)
  const required = ['CORE_DATABASE_URL', 'ASSESSMENT_DATABASE_URL'] as const;
  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`[globalSetup] Missing required env var: ${key}`);
    }
  }

  // Run migrations once before any tests
  const { runMigrations, closeAllConnections } = await import('./src/test-support/db');
  await runMigrations();
  await closeAllConnections(); // Close this process's connections (tests use their own)
}
