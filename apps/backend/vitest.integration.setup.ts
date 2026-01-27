import { beforeAll, afterAll } from 'vitest';
import { runMigrations, truncateAllTables, closeAllConnections } from './src/test-support/db';

/**
 * Integration Test Setup
 *
 * This setup file is used for integration tests that need a real database.
 * It runs migrations once before all tests and cleans up after.
 *
 * Test Strategy:
 * - beforeAll: Run migrations once per test file
 * - Tests: Seed data using fixtures in beforeAll of each test file
 * - afterAll: Truncate tables and close connections
 *
 * This approach assumes tests are READ-ONLY queries against shared fixture data.
 * If a test needs to mutate data, use factories directly within that test.
 */

beforeAll(async () => {
  await runMigrations();
});

afterAll(async () => {
  await truncateAllTables();
  await closeAllConnections();
});
