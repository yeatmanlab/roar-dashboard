/**
 * Integration Test Setup
 *
 * Handles database setup and teardown for integration tests:
 * - beforeAll: Run migrations to ensure schema is up to date
 * - afterAll: Truncate all tables (cleanup) and close database connections
 *
 * Note: This file does NOT use the base vitest.setup.ts because its
 * vi.resetModules() call would break DB client persistence between
 * setup hooks and tests.
 *
 * Note: .env.test is loaded by globalSetup before this file runs,
 * ensuring DB clients connect to test databases.
 *
 * IMPORTANT: Tests share fixture data within a file. Use seedBaseFixture()
 * in beforeAll to seed data once, then reference fixture properties in tests.
 * For tests that need to mutate data, create separate entities with factories.
 */
import { beforeAll, afterAll } from 'vitest';
import { runMigrations, truncateAllTables, closeAllConnections } from './src/test-support/db';

// Shared Firebase Admin mocks
import './src/test-support/mocks/firebase-admin.mock';

beforeAll(async () => {
  // Run migrations for both databases (creates tables if needed)
  await runMigrations();
});

// NOTE: No beforeEach truncation - tests share fixture data within a file.
// This is safe for read-only authorization tests. For tests that need
// mutations, create separate entities using factories.

afterAll(async () => {
  // Truncate all tables in both databases (cleanup after all tests in file)
  await truncateAllTables();
  // Close all database connections
  await closeAllConnections();
});
