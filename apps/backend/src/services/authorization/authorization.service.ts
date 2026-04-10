import { StatusCodes } from 'http-status-codes';
import type { OpenFgaClient, TupleKey, TupleKeyWithoutCondition } from '@openfga/sdk';
import { FgaClient } from '../../clients/fga.client';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { ApiErrorMessage } from '../../enums/api-error-message.enum';
import { ApiError } from '../../errors/api-error';
import { logger } from '../../logger';
import type { FgaRelation } from './fga-constants';
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
 * @param client - The OpenFGA client instance
 */
export function AuthorizationService({
  client = FgaClient.getClient(),
}: {
  client?: OpenFgaClient;
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
  async function hasPermission(userId: string, relation: FgaRelation, object: string): Promise<boolean> {
    try {
      const result = await client.check({
        user: `${FgaType.USER}:${userId}`,
        relation,
        object,
        context: { current_time: new Date().toISOString() },
      });
      return result.allowed === true;
    } catch (error) {
      logger.error({ err: error, context: { userId, relation, object } }, 'FGA permission check failed');
      throw new ApiError(ApiErrorMessage.INTERNAL_SERVER_ERROR, {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.EXTERNAL_SERVICE_FAILED,
        context: { userId, relation, object },
        cause: error,
      });
    }
  }

  /**
   * Check an FGA permission and throw FORBIDDEN if denied.
   *
   * Convenience wrapper around `hasPermission` for the common check-and-throw pattern.
   * Use `hasPermission` directly when branching on the result instead of throwing.
   *
   * @param userId - The user ID (without the `user:` prefix)
   * @param relation - The FGA relation to check (e.g., `can_read`)
   * @param object - The fully-qualified FGA object (e.g., `administration:abc-123`)
   * @throws {ApiError} FORBIDDEN if the user does not have the relation on the object
   */
  async function requirePermission(userId: string, relation: FgaRelation, object: string): Promise<void> {
    const allowed = await hasPermission(userId, relation, object);

    if (!allowed) {
      logger.warn({ userId, relation, object }, 'FGA permission check denied');
      throw new ApiError(ApiErrorMessage.FORBIDDEN, {
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
        context: { userId, relation, object },
      });
    }
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
  async function listAccessibleObjects(userId: string, relation: FgaRelation, type: FgaType): Promise<string[]> {
    try {
      const result = await client.listObjects({
        user: `${FgaType.USER}:${userId}`,
        relation,
        type,
        context: { current_time: new Date().toISOString() },
      });
      return result.objects;
    } catch (error) {
      logger.error({ err: error, context: { userId, relation, type } }, 'FGA list accessible objects failed');
      throw new ApiError(ApiErrorMessage.INTERNAL_SERVER_ERROR, {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.EXTERNAL_SERVICE_FAILED,
        context: { userId, relation, type },
        cause: error,
      });
    }
  }

  return { writeTuples, deleteTuples, hasPermission, requirePermission, listAccessibleObjects };
}
