import type { Json } from '@roar-dashboard/api-contract';

/**
 * StartRunInput is a discriminated union type that enforces strict validation
 * of the relationship between isAnonymous and administrationId.
 *
 * This type ensures type-safe handling of two distinct run modes:
 * 1. Anonymous runs (isAnonymous: true): administrationId is not allowed
 * 2. Authenticated runs (isAnonymous: false): administrationId is required
 *
 * Using a discriminated union prevents invalid state combinations at compile time,
 * ensuring that administrationId can only be provided when isAnonymous is false.
 *
 * @property variantId - Unique identifier for the assessment variant
 * @property taskVersion - Version of the task being run
 * @property metadata - Optional custom metadata for the run
 * @property isAnonymous - Whether the run is anonymous (true) or authenticated (false)
 * @property administrationId - Required when isAnonymous is false; not allowed when isAnonymous is true
 *
 * @example
 * ```ts
 * // Anonymous run - administrationId not allowed
 * const anonInput: StartRunInput = {
 *   variantId: 'variant-123',
 *   taskVersion: '1.0.0',
 *   isAnonymous: true,
 *   metadata: { sessionId: 'session-456' }
 * };
 *
 * // Authenticated run - administrationId required
 * const authInput: StartRunInput = {
 *   variantId: 'variant-123',
 *   taskVersion: '1.0.0',
 *   administrationId: 'admin-789',
 *   isAnonymous: false
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
      isAnonymous: false;
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
