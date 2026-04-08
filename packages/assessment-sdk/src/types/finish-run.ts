import type { Json } from '@roar-dashboard/api-contract';
import { RUN_EVENT_STATUS_OK, RUN_EVENT_COMPLETE } from './run-event-status';

/**
 * FinishRunInput contains the parameters required to mark an assessment run as complete.
 *
 * This interface defines the contract for finishing a run in the ROAR backend system.
 * The run must already exist (created via startRun) and the event type must be 'complete'.
 *
 * @interface FinishRunInput
 *
 * @property runId - Unique identifier for the run to finish. Must correspond to an
 *                   active run created by startRun()
 * @property type - Event type, must be 'complete' to mark the run as finished
 * @property metadata - Optional custom metadata to include with the completion event.
 *                      Can contain any key-value pairs for run customization (e.g.,
 *                      final scores, completion time, custom flags)
 *
 * @example
 * ```ts
 * const input: FinishRunInput = {
 *   runId: 'run-xyz-123',
 *   type: RUN_EVENT_COMPLETE,
 *   metadata: { totalScore: 85, timeSpent: 300 }
 * };
 * ```
 */
export interface FinishRunInput {
  runId: string;
  type: typeof RUN_EVENT_COMPLETE;
  metadata?: Json;
}

/**
 * FinishRunOutput contains the response from a successful run completion.
 *
 * The finish run operation returns a status object on success, indicating that
 * the run has been marked as complete in the backend.
 *
 * @property status - Always 'ok' to indicate successful completion
 *
 * @example
 * ```ts
 * const output: FinishRunOutput = { status: RUN_EVENT_STATUS_OK };
 * ```
 */
export type FinishRunOutput = { status: typeof RUN_EVENT_STATUS_OK };
