import type { OpenFgaClient, TupleKey, TupleKeyWithoutCondition } from '@openfga/sdk';
import { FgaClient } from '../../clients/fga.client';
import { logger } from '../../logger';
import { FgaType } from './fga-constants';

/**
 * AuthorizationService
 *
 * Central service for all FGA operations: tuple writes/deletes and permission checks.
 *
 * Tuple writes (`writeTuples`, `deleteTuples`) are fire-and-forget — failures are
 * logged but not thrown, because the Postgres write has already succeeded and the
 * backfill endpoint (#06) will reconcile stale tuples.
 *
 * Permission checks (`hasPermission`, `listAccessibleObjects`) propagate errors to
 * callers — they are used in request-time authorization and must fail visibly.
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

  /**
   * Check whether a user has a specific relation on an object.
   *
   * Passes `current_time` context so the `active_membership` condition evaluates
   * correctly for time-bound tuples.
   *
   * Unlike tuple writes, errors propagate to callers — this is used in
   * request-time authorization and must fail visibly.
   *
   * @param userId - The user ID (without the `user:` prefix)
   * @param relation - The FGA relation to check (e.g., `can_read`)
   * @param object - The fully-qualified FGA object (e.g., `administration:abc-123`)
   * @returns true if the user has the relation on the object, false otherwise
   */
  async function hasPermission(userId: string, relation: string, object: string): Promise<boolean> {
    const client = getClient();
    const result = await client.check({
      user: `${FgaType.USER}:${userId}`,
      relation,
      object,
      context: { current_time: new Date().toISOString() },
    });
    return result.allowed === true;
  }

  /**
   * List all objects of a given type that a user has a specific relation on.
   *
   * Passes `current_time` context so the `active_membership` condition evaluates
   * correctly for time-bound tuples.
   *
   * Unlike tuple writes, errors propagate to callers — this is used in
   * request-time authorization and must fail visibly.
   *
   * @param userId - The user ID (without the `user:` prefix)
   * @param relation - The FGA relation to check (e.g., `can_read`)
   * @param type - The FGA object type (e.g., `administration`)
   * @returns Array of fully-qualified FGA object strings (e.g., `['administration:abc']`)
   */
  async function listAccessibleObjects(userId: string, relation: string, type: string): Promise<string[]> {
    const client = getClient();
    const result = await client.listObjects({
      user: `${FgaType.USER}:${userId}`,
      relation,
      type,
      context: { current_time: new Date().toISOString() },
    });
    return result.objects;
  }

  return { writeTuples, deleteTuples, hasPermission, listAccessibleObjects };
}
