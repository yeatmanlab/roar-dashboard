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
 * Returns an empty object as the abort operation has no return value.
 */
export type AbortRunOutput = Record<string, never>;
