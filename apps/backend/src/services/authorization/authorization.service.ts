import type { OpenFgaClient, TupleKey, TupleKeyWithoutCondition } from '@openfga/sdk';
import { FgaClient } from '../../clients/fga.client';
import { logger } from '../../logger';

/**
 * AuthorizationService
 *
 * Service for syncing FGA tuples. Wraps `OpenFgaClient.writeTuples` and
 * `OpenFgaClient.deleteTuples` with fire-and-forget error handling — failures
 * are logged but not thrown, because the Postgres write has already succeeded
 * and the backfill endpoint (#06) will reconcile stale tuples.
 *
 * Uses a `getClient` callback (not a direct client reference) because the FGA
 * client is lazy-initialized from env vars. Calling `FgaClient.getClient()` at
 * service construction time would fail if env vars aren't set yet.
 *
 * @param getClient - Callback returning the initialized OpenFgaClient
 */
export function AuthorizationService({
  getClient = () => FgaClient.getClient(),
}: {
  getClient?: () => OpenFgaClient;
} = {}) {
  /**
   * Write tuples to the FGA store.
   *
   * Fire-and-forget: logs errors but does not throw. The Postgres write
   * is the source of truth; the backfill endpoint reconciles stale tuples.
   *
   * @param tuples - Array of TupleKey objects to write
   */
  async function writeTuples(tuples: TupleKey[]): Promise<void> {
    if (tuples.length === 0) return;
    try {
      const client = getClient();
      await client.writeTuples(tuples);
      logger.debug({ tupleCount: tuples.length }, 'FGA tuples written successfully');
    } catch (error) {
      logger.error({ err: error, tupleCount: tuples.length }, 'Failed to write FGA tuples');
    }
  }

  /**
   * Delete tuples from the FGA store.
   *
   * Fire-and-forget: logs errors but does not throw. The Postgres write
   * is the source of truth; the backfill endpoint reconciles stale tuples.
   *
   * @param tuples - Array of TupleKeyWithoutCondition objects to delete
   */
  async function deleteTuples(tuples: TupleKeyWithoutCondition[]): Promise<void> {
    if (tuples.length === 0) return;
    try {
      const client = getClient();
      await client.deleteTuples(tuples);
      logger.debug({ tupleCount: tuples.length }, 'FGA tuples deleted successfully');
    } catch (error) {
      logger.error({ err: error, tupleCount: tuples.length }, 'Failed to delete FGA tuples');
    }
  }

  return { writeTuples, deleteTuples };
}
