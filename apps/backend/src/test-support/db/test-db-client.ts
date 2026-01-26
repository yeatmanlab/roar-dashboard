/**
 * Test Database Clients
 *
 * Provides lazy-initialized database clients for integration tests.
 * Uses the same Drizzle configuration as production but connects to test databases.
 *
 * Usage:
 *   - getTestCoreDb() - Get Drizzle client for core_test database
 *   - getTestAssessmentDb() - Get Drizzle client for assessment_test database
 *   - closeAllConnections() - Close all pools (call in afterAll)
 */
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as CoreDbSchema from '../../db/schema/core';
import * as AssessmentDbSchema from '../../db/schema/assessment';

let corePool: Pool | null = null;
let assessmentPool: Pool | null = null;

/** Shared Drizzle configuration for test clients */
const DRIZZLE_CONFIG = {
  casing: 'snake_case' as const,
  logger: false,
};

/**
 * Get or create the core test database client.
 * Lazy-initializes the connection pool on first call.
 */
export function getTestCoreDb() {
  if (!corePool) {
    corePool = new Pool({
      connectionString: process.env.CORE_DATABASE_URL,
    });
  }
  return drizzle({ ...DRIZZLE_CONFIG, client: corePool, schema: CoreDbSchema });
}

/**
 * Get or create the assessment test database client.
 * Lazy-initializes the connection pool on first call.
 */
export function getTestAssessmentDb() {
  if (!assessmentPool) {
    assessmentPool = new Pool({
      connectionString: process.env.ASSESSMENT_DATABASE_URL,
    });
  }
  return drizzle({ ...DRIZZLE_CONFIG, client: assessmentPool, schema: AssessmentDbSchema });
}

/** Generic database client type for functions that work with either database */
export type TestDbClient = NodePgDatabase<Record<string, unknown>>;

/**
 * Close all database connection pools.
 * Should be called in afterAll to clean up connections.
 */
export async function closeAllConnections(): Promise<void> {
  const closePromises: Promise<void>[] = [];

  if (corePool) {
    closePromises.push(corePool.end());
    corePool = null;
  }

  if (assessmentPool) {
    closePromises.push(assessmentPool.end());
    assessmentPool = null;
  }

  await Promise.all(closePromises);
}
