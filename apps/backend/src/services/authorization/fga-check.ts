import type { OpenFgaClient } from '@openfga/sdk';
import { FgaClient } from '../../clients/fga.client';
import { FgaType } from './fga-constants';

/**
 * Check whether a user has a specific relation on an object.
 *
 * Passes `current_time` context so the `active_membership` condition evaluates
 * correctly for time-bound tuples.
 *
 * @param userId - The user ID (without the `user:` prefix)
 * @param relation - The FGA relation to check (e.g., `can_read`, `can_delete`)
 * @param object - The fully qualified FGA object (e.g., `administration:uuid`)
 * @param getClient - Optional callback for DI in tests
 * @returns Object with `allowed` boolean
 */
export async function fgaCheck(
  userId: string,
  relation: string,
  object: string,
  getClient: () => OpenFgaClient = () => FgaClient.getClient(),
): Promise<{ allowed: boolean }> {
  const result = await getClient().check({
    user: `${FgaType.USER}:${userId}`,
    relation,
    object,
    context: { current_time: new Date().toISOString() },
  });

  return { allowed: result.allowed ?? false };
}

/**
 * List all objects of a given type that the user has a specific relation to.
 *
 * Passes `current_time` context so the `active_membership` condition evaluates
 * correctly for time-bound tuples.
 *
 * @param userId - The user ID (without the `user:` prefix)
 * @param relation - The FGA relation to check (e.g., `can_list`)
 * @param type - The FGA object type (e.g., `administration`)
 * @param getClient - Optional callback for DI in tests
 * @returns Object with `objects` array of fully qualified object strings (e.g., `['administration:uuid1', ...]`)
 */
export async function fgaListObjects(
  userId: string,
  relation: string,
  type: string,
  getClient: () => OpenFgaClient = () => FgaClient.getClient(),
): Promise<{ objects: string[] }> {
  const result = await getClient().listObjects({
    user: `${FgaType.USER}:${userId}`,
    relation,
    type,
    context: { current_time: new Date().toISOString() },
  });

  return { objects: result.objects ?? [] };
}

/**
 * Extract the raw ID from a fully qualified FGA object string.
 *
 * @param fgaObject - Fully qualified FGA object (e.g., `administration:uuid`)
 * @returns The ID portion after the colon
 *
 * @example
 * ```ts
 * extractId('administration:abc-123') // 'abc-123'
 * ```
 */
export function extractFgaObjectId(fgaObject: string): string {
  return fgaObject.split(':')[1] ?? '';
}
