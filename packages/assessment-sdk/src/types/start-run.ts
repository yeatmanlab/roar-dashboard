import type { Json } from '@roar-dashboard/api-contract';

/**
 * StartRunInput is a discriminated union type that enforces the relationship
 * between isAnonymous and administrationId.
 *
 * Supported modes:
 * 1. Anonymous runs (`isAnonymous: true`) — `administrationId` must not be provided
 * 2. Authenticated runs (`isAnonymous` omitted or `false`) — `administrationId` is required
 *
 * @property variantId - Unique identifier for the assessment variant
 * @property taskVersion - Version of the task being run
 * @property metadata - Optional custom metadata for the run
 * @property isAnonymous - Whether the run is anonymous
 * @property administrationId - Required when `isAnonymous` is false or omitted
 *
 * @example
 * ```ts
 * const anonInput: StartRunInput = {
 *   variantId: 'variant-123',
 *   taskVersion: '1.0.0',
 *   isAnonymous: true,
 *   metadata: { sessionId: 'session-456' }
 * };
 *
 * const authInput: StartRunInput = {
 *   variantId: 'variant-123',
 *   taskVersion: '1.0.0',
 *   administrationId: 'admin-789'
 * };
 * ```
 */
export type StartRunInput =
  | {
      variantId: string;
      taskVersion: string;
      metadata?: Json;
      isAnonymous: true;
    }
  | {
      variantId: string;
      taskVersion: string;
      metadata?: Json;
      isAnonymous?: false;
      administrationId: string;
    };

/**
 * StartRunOutput contains the response from a successful run creation.
 *
 * @property runId - Unique identifier for the newly created run, used for
 *                   subsequent operations like writeTrial() and finishRun()
 *
 * @example
 * ```ts
 * const output: StartRunOutput = { runId: 'run-xyz-123' };
 * ```
 */
export interface StartRunOutput {
  runId: string;
}
