/**
 * Test Database Cleanup Utilities
 *
 * Provides functions to clean up test databases between tests.
 * Uses dynamic table discovery to avoid hardcoding table names.
 */
import { sql } from 'drizzle-orm';
import { getTestCoreDb, getTestAssessmentDb, type TestDbClient } from './test-db-client';

/**
 * Truncate all tables in a specific schema.
 * Queries pg_tables dynamically to get table names, then truncates with CASCADE.
 *
 * @param db - Drizzle database client
 * @param schema - Schema name (e.g., 'app')
 */
async function truncateSchema(db: TestDbClient, schema: string): Promise<void> {
  // Query all tables in the schema
  const result = await db.execute<{ tablename: string }>(sql`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = ${schema}
  `);

  const tables = result.rows;
  if (tables.length === 0) return;

  // Build comma-separated list of fully-qualified table names
  const tableNames = tables.map((t) => `"${schema}"."${t.tablename}"`).join(', ');

  // TRUNCATE with CASCADE handles FK dependencies automatically
  await db.execute(sql.raw(`TRUNCATE TABLE ${tableNames} CASCADE`));
}

/**
 * Truncate all tables in both core and assessment test databases.
 * Should be called in beforeEach to ensure test isolation.
 */
export async function truncateAllTables(): Promise<void> {
  await Promise.all([
    truncateSchema(getTestCoreDb() as TestDbClient, 'app'),
    truncateSchema(getTestAssessmentDb() as TestDbClient, 'app'),
  ]);
}
