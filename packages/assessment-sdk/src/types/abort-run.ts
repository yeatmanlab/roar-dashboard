import { RUN_EVENT_STATUS_OK } from './run-event-status';

export const RUN_EVENT_ABORT = 'abort' as const;
/**
 * Input for the AbortRun command.
 *
 * @property runId - The unique identifier of the run to abort
 * @property type - The event type, must be 'abort'
 */
export interface AbortRunInput {
  runId: string;
  type: typeof RUN_EVENT_ABORT;
}

/**
 * Output from the AbortRun command.
 * Returns the response body from the server.
 */
export interface AbortRunOutput {
  status: typeof RUN_EVENT_STATUS_OK;
}
