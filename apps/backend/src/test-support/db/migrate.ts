/**
 * Test Migration Runner
 *
 * Programmatically runs Drizzle migrations for test databases.
 * Should be called in beforeAll to ensure test databases have the latest schema.
 */
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { getCoreDbClient, getAssessmentDbClient } from '../../db/clients';

/**
 * Run migrations for both core and assessment test databases.
 * Migrations are applied in order, and already-applied migrations are skipped.
 */
export async function runMigrations(): Promise<void> {
  // Run core database migrations
  await migrate(getCoreDbClient(), {
    migrationsFolder: './migrations/core',
  });

  // Run assessment database migrations
  await migrate(getAssessmentDbClient(), {
    migrationsFolder: './migrations/assessment',
  });
}
