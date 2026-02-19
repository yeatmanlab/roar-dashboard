/**
 * Test Database Support
 *
 * Exports all database utilities for integration tests.
 * Uses production database clients with test database connections (via .env.test).
 */
export {
  getCoreDbClient,
  getAssessmentDbClient,
  initializeDatabasePools,
  closeDatabasePools as closeAllConnections,
} from '../../db/clients';
export { runMigrations } from './migrate';
export { truncateAllTables } from './cleanup';
