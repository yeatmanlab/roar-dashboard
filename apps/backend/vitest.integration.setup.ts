/**
 * Integration Test Setup
 *
 * Handles database setup and teardown for integration tests:
 * - beforeAll: Run migrations to ensure schema is up to date
 * - beforeEach: Truncate all tables for test isolation
 * - afterAll: Close database connections
 *
 * Note: This file does NOT use the base vitest.setup.ts because its
 * vi.resetModules() call would break DB client persistence between
 * setup hooks and tests.
 *
 * Note: .env.test is loaded by globalSetup before this file runs,
 * ensuring DB clients connect to test databases.
 */
import { beforeAll, afterAll, beforeEach } from 'vitest';
import { runMigrations, truncateAllTables, closeAllConnections } from './src/test-support/db';

// Shared Firebase Admin mocks
import './src/test-support/mocks/firebase-admin.mock';

beforeAll(async () => {
  // Run migrations for both databases (creates tables if needed)
  await runMigrations();
});

beforeEach(async () => {
  // Truncate all tables in both databases for test isolation
  await truncateAllTables();
});

afterAll(async () => {
  // Close all database connections
  await closeAllConnections();
});
