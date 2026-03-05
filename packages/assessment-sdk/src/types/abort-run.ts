/**
 * Input for the AbortRun command.
 *
 * @property runId - The unique identifier of the run to abort
 * @property type - The event type, must be 'abort'
 */
export interface AbortRunInput {
  runId: string;
  type: 'abort';
}

/**
 * Output from the AbortRun command.
 * Returns void as the abort operation has no return value.
 */
export type AbortRunOutput = void;
