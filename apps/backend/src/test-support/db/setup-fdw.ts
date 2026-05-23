/**
 * FDW Provisioning for Tests
 *
 * Provisions postgres_fdw prerequisites (extension, foreign server,
 * user mappings) on the core test database before Drizzle migrations
 * run. Drizzle can't perform these operations because they require
 * superuser privileges.
 *
 * This is a TypeScript port of `scripts/setup-fdw-local.sh` that uses
 * the `pg` client directly so it works in any Node environment without
 * requiring `psql` on the PATH — notably the `cypress/browsers` container
 * used by the e2e CI job, which doesn't ship with postgresql-client.
 *
 * Called from:
 *  - `vitest.integration.globalSetup.ts` before `runMigrations()`
 *  - `server-test.ts` before `runMigrations()`
 *
 * The bash script under `scripts/` is kept for local developer use
 * (manual one-time setup), but the test runtime no longer depends on it.
 */
import { Client } from 'pg';

/**
 * Provision postgres_fdw prerequisites on the core test database.
 *
 * Reads connection settings from `CORE_DATABASE_URL` and `ASSESSMENT_DATABASE_URL`.
 * Both URLs must share the same host:port — postgres_fdw only supports
 * connecting to the assessment server at the URL the bootstrap encodes.
 */
export async function setupFdwForTests(): Promise<void> {
  for (const key of ['CORE_DATABASE_URL', 'ASSESSMENT_DATABASE_URL'] as const) {
    if (!process.env[key]) {
      throw new Error(`[setup-fdw] Missing required env var: ${key}`);
    }
  }

  const core = parseConnectionUrl(process.env.CORE_DATABASE_URL!);
  const assessment = parseConnectionUrl(process.env.ASSESSMENT_DATABASE_URL!);

  assertSameHostPort(core, assessment);

  const coreHost = core.host;
  const corePort = core.port;
  // Mirror the bash script's `${PG_USER:-postgres}` default — local-dev URLs that
  // rely on peer/trust auth often omit the username, but the FDW user mapping
  // needs a non-empty role name. CI URLs always include `postgres` explicitly.
  const pgUser = core.user;
  const pgPassword = core.password;
  const coreDb = core.database;
  const assessmentDb = assessment.database;

  const client = new Client({
    host: coreHost,
    port: parseInt(corePort, 10),
    user: pgUser,
    password: pgPassword || undefined,
    database: coreDb,
  });

  await client.connect();

  try {
    // 1. Enable the postgres_fdw extension (superuser-only).
    await client.query('CREATE EXTENSION IF NOT EXISTS postgres_fdw');

    // 2. Create or update the assessment_server foreign server pointing at the
    //    assessment DB. plpgsql DO blocks don't accept query parameters, so values
    //    are interpolated via JS template literals and then quoted defensively
    //    inside the dynamic DDL via `format(..., %L)` — same pattern as the bash
    //    script's heredoc.
    await client.query(`
      DO $$
      DECLARE
        _host constant text := ${literal(coreHost)};
        _port constant text := ${literal(corePort)};
        _dbname constant text := ${literal(assessmentDb)};
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_foreign_server WHERE srvname = 'assessment_server') THEN
          EXECUTE format(
            'CREATE SERVER assessment_server FOREIGN DATA WRAPPER postgres_fdw OPTIONS (host %L, port %L, dbname %L)',
            _host, _port, _dbname
          );
        ELSE
          EXECUTE format(
            'ALTER SERVER assessment_server OPTIONS (SET host %L, SET port %L, SET dbname %L)',
            _host, _port, _dbname
          );
        END IF;
      END
      $$;
    `);

    // 3. Upsert helper for user mappings. Lives in pg_temp so it's session-scoped
    //    and disappears when the client disconnects.
    await client.query(`
      CREATE OR REPLACE FUNCTION pg_temp.upsert_user_mapping(_role text, _options text)
      RETURNS void LANGUAGE plpgsql AS $func$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_user_mappings
          WHERE srvname = 'assessment_server' AND usename = _role
        ) THEN
          EXECUTE format('DROP USER MAPPING FOR %I SERVER assessment_server', _role);
        END IF;
        EXECUTE format('CREATE USER MAPPING FOR %I SERVER assessment_server OPTIONS (%s)', _role, _options);
      END
      $func$;
    `);

    // 4. Create user mappings: always one for the connection user; additionally
    //    one for current_user if it differs (local-dev with peer/trust auth, where
    //    the OS user connects but PG_USER defaults to `postgres`). In CI both
    //    typically match and the second mapping is a no-op.
    await client.query(`
      DO $$
      DECLARE
        _pg_user constant text := ${literal(pgUser)};
        _password constant text := ${literal(pgPassword)};
        _options text;
      BEGIN
        _options := format('user %L', _pg_user);
        IF _password <> '' THEN
          _options := _options || format(', password %L', _password);
        END IF;
        PERFORM pg_temp.upsert_user_mapping(_pg_user, _options);
        IF current_user <> _pg_user THEN
          PERFORM pg_temp.upsert_user_mapping(current_user, _options);
        END IF;
      END
      $$;
    `);
  } finally {
    await client.end();
  }
}

/**
 * Quote a value as a PostgreSQL string literal for safe inclusion in SQL via
 * JS template-literal substitution. Equivalent to the bash heredoc step that
 * wraps `$PG_HOST` etc. in single quotes — the values flow into plpgsql
 * `DECLARE`d constants and are then re-quoted via `format(..., %L)` when
 * building the dynamic DDL.
 *
 * Exported for unit testing. The single-quote doubling is the only escape
 * PostgreSQL string literals need (no backslash interpretation in the default
 * `standard_conforming_strings = on` mode).
 */
export function literal(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

/**
 * Parse a PostgreSQL connection URL into the connection settings the setup
 * routine consumes. Exported for unit testing of the URL-handling branches
 * (missing username falls back to `postgres`, empty password becomes `''`,
 * the database name is the leading `/` stripped off the pathname).
 */
export function parseConnectionUrl(rawUrl: string): {
  host: string;
  port: string;
  user: string;
  password: string;
  database: string;
} {
  const url = new URL(rawUrl);
  return {
    host: url.hostname,
    port: url.port || '5432',
    user: url.username ? decodeURIComponent(url.username) : 'postgres',
    password: url.password ? decodeURIComponent(url.password) : '',
    database: url.pathname.slice(1),
  };
}

/**
 * Throw if the core and assessment connection URLs do not share the same
 * `host:port`. postgres_fdw only knows how to talk to the assessment server
 * at the address encoded in the foreign-server bootstrap; configurations
 * where the two URLs disagree would silently produce a broken FDW.
 *
 * Exported for unit testing.
 */
export function assertSameHostPort(
  core: { host: string; port: string },
  assessment: { host: string; port: string },
): void {
  if (core.host !== assessment.host || core.port !== assessment.port) {
    throw new Error(
      `[setup-fdw] CORE_DATABASE_URL and ASSESSMENT_DATABASE_URL must share the same host:port. ` +
        `Got core=${core.host}:${core.port}, assessment=${assessment.host}:${assessment.port}`,
    );
  }
}
