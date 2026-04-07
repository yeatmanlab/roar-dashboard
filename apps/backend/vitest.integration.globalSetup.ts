/**
 * Global Setup for Integration Tests
 *
 * Runs once before any test files are loaded.
 * - Provisions FDW prerequisites via the shared shell script
 * - Runs migrations once (schema setup)
 *
 * Env vars are loaded in vitest.config.ts and merged into process.env.
 */

import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default async function globalSetup() {
  // Fail fast if required env vars are missing.
  const required = ['CORE_DATABASE_URL', 'ASSESSMENT_DATABASE_URL'] as const;
  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`[globalSetup] Missing required env var: ${key}`);
    }
  }

  // Provision FDW prerequisites before migrations (superuser-only operations).
  // Reuses the same shell script used for local dev setup.
  const coreUrl = new URL(process.env.CORE_DATABASE_URL!);
  const assessmentUrl = new URL(process.env.ASSESSMENT_DATABASE_URL!);

  // The setup script uses a single PG_HOST/PG_PORT for both psql connections and
  // the FDW server definition. Fail fast if the databases are on different hosts.
  const coreHost = coreUrl.hostname;
  const corePort = coreUrl.port || '5432';
  const assessHost = assessmentUrl.hostname;
  const assessPort = assessmentUrl.port || '5432';
  if (coreHost !== assessHost || corePort !== assessPort) {
    throw new Error(
      `[globalSetup] CORE_DATABASE_URL and ASSESSMENT_DATABASE_URL must share the same host:port. ` +
        `Got core=${coreHost}:${corePort}, assessment=${assessHost}:${assessPort}`,
    );
  }

  const password = coreUrl.password || '';

  execFileSync(path.resolve(__dirname, '../../scripts/setup-fdw-local.sh'), {
    env: {
      ...process.env,
      CORE_DB: coreUrl.pathname.slice(1),
      ASSESSMENT_DB: assessmentUrl.pathname.slice(1),
      PG_HOST: coreUrl.hostname,
      PG_PORT: coreUrl.port || '5432',
      PG_USER: coreUrl.username,
      ...(password ? { PGPASSWORD: password } : {}),
    },
    stdio: 'inherit',
  });

  // Initialize database pools before running migrations
  const { initializeDatabasePools, closeDatabasePools } = await import('./src/db/clients');
  await initializeDatabasePools();

  // Run migrations once before any tests
  const { runMigrations } = await import('./src/test-support/db');
  await runMigrations();

  // Initialize FGA test store (creates store + deploys authorization model)
  const { initializeFgaTestStore } = await import('./src/test-support/fga');
  await initializeFgaTestStore();

  // Close this process's connections (tests use their own)
  await closeDatabasePools();
}
