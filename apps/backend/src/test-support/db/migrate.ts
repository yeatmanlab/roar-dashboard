/**
 * Test Migration Runner
 *
 * Programmatically runs Drizzle migrations for test databases.
 * Should be called in beforeAll to ensure test databases have the latest schema.
 */
import path from 'node:path';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { CoreDbClient, AssessmentDbClient } from '../../db/clients';
import { BACKEND_ROOT } from '../paths';

/**
 * Run migrations for both core and assessment test databases.
 * Migrations are applied in order, and already-applied migrations are skipped.
 *
 * Paths are anchored to `BACKEND_ROOT` rather than the current working
 * directory so this works under both vitest (cwd is `apps/backend/`) and
 * the bundled `dist/server-test.js` (which CI invokes from the repo root).
 */
export async function runMigrations(): Promise<void> {
  // Run core database migrations
  await migrate(CoreDbClient, {
    migrationsFolder: path.join(BACKEND_ROOT, 'migrations', 'core'),
  });

  // Run assessment database migrations
  await migrate(AssessmentDbClient, {
    migrationsFolder: path.join(BACKEND_ROOT, 'migrations', 'assessment'),
  });
}
