import { sql } from 'drizzle-orm';
import { getCoreDbClient } from '../db/clients';
import { FgaClient } from '../clients/fga.client';
import { logger } from '../logger';

const HEALTH_CHECK_TIMEOUT_MS = 2000;

// Cache TTL should stay below the readiness probe interval configured in Cloud Run.
// At the default 10-second interval, a 3-second TTL ensures each probe gets a
// reasonably fresh result without hammering dependencies on every call.
const HEALTH_CHECK_CACHE_TTL_MS = 3000;

export type DependencyStatus = 'ok' | 'error' | 'timeout';

export interface ReadinessCheckResult {
  status: 'ok' | 'error';
  checks: {
    postgres: DependencyStatus;
    openfga: DependencyStatus;
  };
}

class HealthCheckTimeoutError extends Error {
  constructor(label: string) {
    super(`${label} health check timed out`);
    this.name = 'HealthCheckTimeoutError';
  }
}

/**
 * Race a promise against a timeout. Clears the timer on completion
 * to avoid leaking dangling timers when the operation resolves first.
 *
 * @param promise - The async operation to race
 * @param ms - Timeout in milliseconds
 * @param label - Label for the timeout error message
 * @returns The result of the promise
 * @throws {HealthCheckTimeoutError} If the timeout fires first
 */
async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timerId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timerId = setTimeout(() => reject(new HealthCheckTimeoutError(label)), ms);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timerId);
  }
}

let cachedResult: ReadinessCheckResult | null = null;
let cachedAt = 0;

/**
 * Check Postgres connectivity by running a simple query with a timeout.
 *
 * @returns 'ok' if the query succeeds, 'timeout' or 'error' otherwise
 */
export async function checkPostgres(): Promise<DependencyStatus> {
  try {
    const db = getCoreDbClient();
    await withTimeout(db.execute(sql`SELECT 1`), HEALTH_CHECK_TIMEOUT_MS, 'Postgres');
    return 'ok';
  } catch (err) {
    if (err instanceof HealthCheckTimeoutError) {
      logger.warn({ err }, 'Postgres health check timed out');
      return 'timeout';
    }
    logger.warn({ err }, 'Postgres health check failed');
    return 'error';
  }
}

/**
 * Check OpenFGA connectivity by reading the authorization model.
 * Validates connectivity, store ID, and model ID in one call.
 *
 * Note: FgaClient.getClient() throws ApiError (extends Error) if env vars
 * are missing. That case falls through to the generic 'error' return.
 *
 * @returns 'ok' if the call succeeds, 'timeout' or 'error' otherwise
 */
export async function checkOpenFga(): Promise<DependencyStatus> {
  try {
    await withTimeout(FgaClient.getClient().readAuthorizationModel(), HEALTH_CHECK_TIMEOUT_MS, 'OpenFGA');
    return 'ok';
  } catch (err) {
    if (err instanceof HealthCheckTimeoutError) {
      logger.warn({ err }, 'OpenFGA health check timed out');
      return 'timeout';
    }
    logger.warn({ err }, 'OpenFGA health check failed');
    return 'error';
  }
}

/**
 * Run all dependency checks and return an aggregate result.
 * Used exclusively by the readiness probe — startup and liveness
 * probes return unconditional 200s and do not check dependencies.
 *
 * Only successful results are cached to avoid masking recovery —
 * a stale error cache would cause probes to report failure even
 * after the dependency recovers.
 *
 * @returns Aggregate readiness check result with per-dependency status
 */
export async function runReadinessChecks(): Promise<ReadinessCheckResult> {
  const now = Date.now();
  if (cachedResult && now - cachedAt < HEALTH_CHECK_CACHE_TTL_MS) {
    return cachedResult;
  }

  // checkPostgres and checkOpenFga catch all errors internally and never reject.
  // Promise.allSettled is a defensive guard in case that contract changes.
  const [postgresResult, openfgaResult] = await Promise.allSettled([checkPostgres(), checkOpenFga()]);

  /* c8 ignore next -- defensive: checkPostgres catches internally and never rejects */
  const postgres = postgresResult.status === 'fulfilled' ? postgresResult.value : 'error';
  /* c8 ignore next -- defensive: checkOpenFga catches internally and never rejects */
  const openfga = openfgaResult.status === 'fulfilled' ? openfgaResult.value : 'error';

  const result: ReadinessCheckResult = {
    status: postgres === 'ok' && openfga === 'ok' ? 'ok' : 'error',
    checks: { postgres, openfga },
  };

  // Only cache successful results so failed probes re-check immediately
  if (result.status === 'ok') {
    cachedResult = result;
    cachedAt = now;
  } else {
    cachedResult = null;
    cachedAt = 0;
  }

  return result;
}

/**
 * Clear the cached health check result.
 *
 * @internal Exposed for testing only. Do not call in production code.
 */
export function clearHealthCheckCache(): void {
  cachedResult = null;
  cachedAt = 0;
}
