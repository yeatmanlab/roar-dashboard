/**
 * Global Teardown for Integration Tests
 *
 * Runs once after all test files have completed.
 * Cleans up FGA stores created during the test run.
 */

export default async function globalTeardown() {
  const { cleanupFgaTestStores } = await import('./src/test-support/fga');
  await cleanupFgaTestStores();
}
