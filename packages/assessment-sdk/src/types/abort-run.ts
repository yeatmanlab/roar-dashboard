import { RUN_EVENT_STATUS_OK, RUN_EVENT_ABORT } from './run-event-status';
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
