/**
 * Create the test databases if they don't already exist.
 *
 * The Drizzle migrator (`runMigrations` in `test-support/db/migrate.ts`)
 * assumes the target databases already exist — it can `CREATE TABLE` but
 * not `CREATE DATABASE`. The integration test job in CI handles this with
 * a couple of `psql` commands, but the Cypress e2e job runs inside a
 * `cypress/browsers` container that doesn't have `psql` available, so we
 * bootstrap the databases from Node instead.
 *
 * Usage (CI and local dev alike):
 *
 *   POSTGRES_ADMIN_URL=postgresql://postgres:postgres@127.0.0.1:5432/postgres \
 *     npx tsx apps/backend/scripts/create-test-databases.ts
 *
 * The script is idempotent — pre-existing databases are left in place.
 */
import { Client } from 'pg';

const ADMIN_URL = process.env.POSTGRES_ADMIN_URL ?? 'postgresql://postgres:postgres@127.0.0.1:5432/postgres';

const DEFAULT_DATABASE_NAMES = ['roar_core_test', 'roar_assessment_test'] as const;

/**
 * `CREATE DATABASE` cannot be parameterized in Postgres, so identifiers go
 * through this whitelist regex instead. The allowed shape (letters, digits,
 * and underscores) covers everything we'll ever pass — and rejecting anything
 * else closes the door on accidental SQL injection from an env var.
 */
const VALID_DB_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

async function createDatabaseIfMissing(client: Client, dbName: string): Promise<void> {
  if (!VALID_DB_NAME.test(dbName)) {
    throw new Error(`[create-test-databases] Invalid database name: ${dbName}`);
  }

  const existing = await client.query<{ datname: string }>('SELECT datname FROM pg_database WHERE datname = $1', [
    dbName,
  ]);
  if ((existing.rowCount ?? 0) > 0) {
    console.log(`[create-test-databases] Database already exists: ${dbName}`);
    return;
  }

  await client.query(`CREATE DATABASE ${dbName}`);
  console.log(`[create-test-databases] Created database: ${dbName}`);
}

async function main(): Promise<void> {
  const dbNames = (process.env.TEST_DATABASE_NAMES?.split(',')
    .map((s) => s.trim())
    .filter(Boolean) ?? DEFAULT_DATABASE_NAMES) as string[];

  const client = new Client({ connectionString: ADMIN_URL });
  await client.connect();
  try {
    for (const dbName of dbNames) {
      await createDatabaseIfMissing(client, dbName);
    }
  } finally {
    await client.end();
  }
}

main().catch((err: unknown) => {
  console.error('[create-test-databases] Failed:', err);
  process.exit(1);
});
