import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { sql } from 'drizzle-orm';
import * as CoreDbSchema from '../db/schema/core';

// Test database connection
let testPool: Pool | null = null;
let testDb: ReturnType<typeof drizzle<typeof CoreDbSchema>> | null = null;

/**
 * Get or create a test database client.
 * Uses TEST_CORE_DATABASE_URL or falls back to CORE_DATABASE_URL.
 */
export function getTestDbClient() {
  if (!testDb) {
    const connectionString = process.env.TEST_CORE_DATABASE_URL || process.env.CORE_DATABASE_URL;
    if (!connectionString) {
      throw new Error('TEST_CORE_DATABASE_URL or CORE_DATABASE_URL environment variable is required');
    }

    testPool = new Pool({ connectionString });
    testDb = drizzle({ client: testPool, casing: 'snake_case', schema: CoreDbSchema, logger: false });
  }
  return testDb;
}

/**
 * Get the underlying test pool.
 */
export function getTestPool() {
  if (!testPool) {
    getTestDbClient(); // Initialize pool
  }
  return testPool!;
}

/**
 * Run database migrations for the core database.
 */
export async function runMigrations() {
  const db = getTestDbClient();
  await migrate(db, { migrationsFolder: './migrations/core' });
}

/**
 * Table names in dependency order (children first, parents last).
 * This ensures truncation respects foreign key constraints.
 */
const TRUNCATE_ORDER = [
  // Junction tables first (depend on everything)
  'app.administration_orgs',
  'app.administration_classes',
  'app.administration_groups',
  'app.administration_agreements',
  'app.administration_task_variants',
  'app.user_orgs',
  'app.user_classes',
  'app.user_groups',
  'app.user_families',
  'app.user_agreements',
  'app.rostering_run_entities',
  'app.rostering_provider_ids',
  'app.task_bundle_variants',
  'app.task_variant_parameters',
  // Entity tables (children before parents)
  'app.administrations',
  'app.classes',
  'app.courses',
  'app.task_variants',
  'app.task_bundles',
  'app.tasks',
  'app.agreement_versions',
  'app.agreements',
  'app.rostering_runs',
  'app.invitation_codes',
  'app.run_demographics',
  'app.groups',
  'app.families',
  'app.orgs',
  'app.users',
] as const;

/**
 * Truncate all tables in the test database.
 * Uses CASCADE to handle foreign key constraints.
 */
export async function truncateAllTables() {
  const db = getTestDbClient();

  // Use TRUNCATE CASCADE for efficiency
  const tableList = TRUNCATE_ORDER.join(', ');
  await db.execute(sql.raw(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`));
}

/**
 * Close all database connections.
 */
export async function closeAllConnections() {
  if (testPool) {
    await testPool.end();
    testPool = null;
    testDb = null;
  }
}
