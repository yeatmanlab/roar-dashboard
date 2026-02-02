/**
 * Test Setup
 *
 * This setup file is shared between unit and integration tests.
 *
 * The integration test hooks are conditionally enabled based on VITEST_PROJECT,
 * which is set via the `env` option in vitest.config.ts for the integration project.
 *
 * Integration tests get a pre-seeded base fixture with standard test data.
 * Tests can append additional data using factories as needed.
 *
 * Note: Migrations run once in globalSetup. Per-file, we truncate and re-seed
 * to ensure test isolation between files.
 */
import { vi, beforeEach, beforeAll, afterAll } from 'vitest';

// Shared Firebase Admin mocks (vi.mock calls are hoisted)
import './src/test-support/mocks/firebase-admin.mock';

// Check if running integration tests (set via env in vitest.config.ts)
const isIntegrationTest = process.env.VITEST_PROJECT === 'integration';

// Global test setup for all tests
beforeEach(() => {
  vi.clearAllMocks();
});

// Integration test hooks (per-file)
if (isIntegrationTest) {
  const { seedBaseFixture } = await import('./src/test-support/fixtures');
  const { truncateAllTables, closeAllConnections } = await import('./src/test-support/db');

  beforeAll(async () => {
    await truncateAllTables();
    await seedBaseFixture();
  });

  afterAll(async () => {
    await closeAllConnections();
  });
}
