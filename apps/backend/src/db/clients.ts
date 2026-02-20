import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { Connector, AuthTypes } from '@google-cloud/cloud-sql-connector';
import * as CoreDbSchema from './schema/core';
import * as AssessmentDbSchema from './schema/assessment';
import { logger } from '../logger';

const CORE_POOL_NAME = 'core';
const ASSESSMENT_POOL_NAME = 'assessment';

/** Shared Cloud SQL Connector instance for IAM authentication. */
let connector: Connector | null = null;

/**
 * Configuration for creating a database connection pool.
 */
interface PoolConfig {
  /** Identifier for logging purposes. */
  name: string;
  /** PostgreSQL connection string for local/password authentication. */
  connectionString?: string | undefined;
  /** CloudSQL instance connection name (e.g., "project:region:instance"). */
  instanceConnectionName?: string | undefined;
  /** Database name to connect to. */
  database?: string | undefined;
  /** Database user (service account email for IAM auth). */
  user?: string | undefined;
}

/** Drizzle ORM client type for the core database with full schema. */
type CoreDbClientType = NodePgDatabase<typeof CoreDbSchema> & { $client: Pool };

/** Drizzle ORM client type for the assessment database with full schema. */
type AssessmentDbClientType = NodePgDatabase<typeof AssessmentDbSchema> & { $client: Pool };

let corePool: Pool | null = null;
let assessmentPool: Pool | null = null;
let initialized = false;

/** Drizzle ORM client for the core database. Initialized by {@link initializeDatabasePools}. */
export let CoreDbClient: CoreDbClientType;

/** Drizzle ORM client for the assessment database. Initialized by {@link initializeDatabasePools}. */
export let AssessmentDbClient: AssessmentDbClientType;

/**
 * Returns the core database client, throwing if not initialized.
 *
 * Use this getter for defense-in-depth to get a clear error message
 * if the database is accessed before initialization.
 *
 * @returns The initialized core database client.
 * @throws {Error} If {@link initializeDatabasePools} has not been called.
 */
export function getCoreDbClient(): CoreDbClientType {
  if (!CoreDbClient) {
    throw new Error('Database not initialized. Call initializeDatabasePools() first.');
  }
  return CoreDbClient;
}

/**
 * Returns the assessment database client, throwing if not initialized.
 *
 * Use this getter for defense-in-depth to get a clear error message
 * if the database is accessed before initialization.
 *
 * @returns The initialized assessment database client.
 * @throws {Error} If {@link initializeDatabasePools} has not been called.
 */
export function getAssessmentDbClient(): AssessmentDbClientType {
  if (!AssessmentDbClient) {
    throw new Error('Database not initialized. Call initializeDatabasePools() first.');
  }
  return AssessmentDbClient;
}

/**
 * Creates a PostgreSQL connection pool.
 *
 * Supports two authentication modes:
 * - **Cloud SQL Connector**: Uses the Cloud SQL Connector for secure, passwordless authentication
 *   via Google Cloud IAM. Requires `USE_CLOUDSQL_CONNECTOR=true`.
 * - **Password auth**: Uses a standard connection string for local development.
 *
 * @param config - Pool configuration options.
 * @returns A configured PostgreSQL connection pool.
 */
async function createPool(config: PoolConfig): Promise<Pool> {
  const useCloudSqlConnector = process.env.USE_CLOUDSQL_CONNECTOR === 'true';

  let pool: Pool;

  if (useCloudSqlConnector && config.instanceConnectionName) {
    if (!connector) {
      connector = new Connector();
    }

    const clientOpts = await connector.getOptions({
      instanceConnectionName: config.instanceConnectionName,
      authType: AuthTypes.IAM,
    });

    pool = new Pool({
      ...clientOpts,
      user: config.user,
      database: config.database,
    });

    logger.info({ pool: config.name }, 'Created CloudSQL pool with IAM auth');
  } else {
    pool = new Pool({
      connectionString: config.connectionString,
    });

    logger.info({ pool: config.name }, 'Created local pool with password auth');
  }

  pool.on('error', (err) => {
    logger.error({ err, context: { pool: config.name } }, 'Unexpected database pool error');
  });

  return pool;
}

/**
 * Initializes database connection pools for both core and assessment databases.
 *
 * Must be called once at application startup before any database operations.
 * Subsequent calls are no-ops.
 *
 * **Environment Variables:**
 *
 * For Cloud SQL Connector (`USE_CLOUDSQL_CONNECTOR=true`):
 * - `CLOUDSQL_INSTANCE_CONNECTION_NAME` - Instance connection name (required)
 * - `CORE_DATABASE_NAME` - Core database name (defaults to "core")
 * - `CORE_DATABASE_USER` - Core database IAM user
 * - `ASSESSMENT_DATABASE_NAME` - Assessment database name (defaults to "assessment")
 * - `ASSESSMENT_DATABASE_USER` - Assessment database IAM user
 *
 * For local password auth:
 * - `CORE_DATABASE_URL` - Core database connection string (required)
 * - `ASSESSMENT_DATABASE_URL` - Assessment database connection string (required)
 *
 * @throws {Error} If required environment variables are missing.
 */
export async function initializeDatabasePools(): Promise<void> {
  if (initialized) return;

  const useCloudSqlConnector = process.env.USE_CLOUDSQL_CONNECTOR === 'true';

  if (useCloudSqlConnector) {
    const {
      CLOUDSQL_INSTANCE_CONNECTION_NAME,
      CORE_DATABASE_NAME,
      CORE_DATABASE_USER,
      ASSESSMENT_DATABASE_NAME,
      ASSESSMENT_DATABASE_USER,
    } = process.env;

    if (!CLOUDSQL_INSTANCE_CONNECTION_NAME) {
      throw new Error('CLOUDSQL_INSTANCE_CONNECTION_NAME is required when USE_CLOUDSQL_CONNECTOR is enabled');
    }

    if (!CORE_DATABASE_USER) {
      throw new Error('CORE_DATABASE_USER is required when USE_CLOUDSQL_CONNECTOR is enabled');
    }

    if (!ASSESSMENT_DATABASE_USER) {
      throw new Error('ASSESSMENT_DATABASE_USER is required when USE_CLOUDSQL_CONNECTOR is enabled');
    }

    const coreDatabase = CORE_DATABASE_NAME || 'core';
    const assessmentDatabase = ASSESSMENT_DATABASE_NAME || 'assessment';

    [corePool, assessmentPool] = await Promise.all([
      createPool({
        name: CORE_POOL_NAME,
        instanceConnectionName: CLOUDSQL_INSTANCE_CONNECTION_NAME,
        database: coreDatabase,
        user: CORE_DATABASE_USER,
      }),
      createPool({
        name: ASSESSMENT_POOL_NAME,
        instanceConnectionName: CLOUDSQL_INSTANCE_CONNECTION_NAME,
        database: assessmentDatabase,
        user: ASSESSMENT_DATABASE_USER,
      }),
    ]);
  } else {
    const { CORE_DATABASE_URL, ASSESSMENT_DATABASE_URL } = process.env;

    if (!CORE_DATABASE_URL) {
      throw new Error('CORE_DATABASE_URL is required');
    }
    if (!ASSESSMENT_DATABASE_URL) {
      throw new Error('ASSESSMENT_DATABASE_URL is required');
    }

    [corePool, assessmentPool] = await Promise.all([
      createPool({ name: CORE_POOL_NAME, connectionString: CORE_DATABASE_URL }),
      createPool({ name: ASSESSMENT_POOL_NAME, connectionString: ASSESSMENT_DATABASE_URL }),
    ]);
  }

  CoreDbClient = drizzle({ client: corePool, casing: 'snake_case', schema: CoreDbSchema, logger: false });
  AssessmentDbClient = drizzle({
    client: assessmentPool,
    casing: 'snake_case',
    schema: AssessmentDbSchema,
    logger: false,
  });

  initialized = true;
}

/**
 * Closes all database connection pools and releases resources.
 *
 * Should be called during graceful shutdown (e.g., on SIGTERM/SIGINT).
 * After calling this function, {@link initializeDatabasePools} must be called again
 * before any database operations.
 */
export async function closeDatabasePools(): Promise<void> {
  await Promise.all([corePool?.end(), assessmentPool?.end()]);
  connector?.close();
  corePool = null;
  assessmentPool = null;
  connector = null;
  initialized = false;
}
