/**
 * StartRunInput is a discriminated union type that enforces strict validation
 * of the relationship between isAnonymous and administrationId.
 *
 * This type ensures type-safe handling of two distinct run modes:
 * 1. Anonymous runs: No administrationId is allowed or required
 * 2. Authenticated runs: administrationId is required
 *
 * Using a discriminated union prevents invalid state combinations at compile time,
 * ensuring that administrationId can only be provided when isAnonymous is false.
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
 *   isAnonymous: false,
 *   administrationId: 'admin-789'
 * };
 * ```
 */
export type StartRunInput =
  | {
      variantId: string;
      taskVersion: string;
      metadata?: Record<string, unknown>;
      isAnonymous: true;
      administrationId?: never; // not allowed when anonymous
    }
  | {
      variantId: string;
      taskVersion: string;
      metadata?: Record<string, unknown>;
      isAnonymous?: false; // default false
      administrationId: string; // required when isAnonymous is false
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
