import type { Command } from '../command/command';
import type { RoarApi } from '../receiver/roar-api';
import type { AbortRunInput, AbortRunOutput } from '../types/abort-run';
import { RUN_EVENT_ABORT } from '../types/abort-run';

/**
 * AbortRunCommand implements the Command pattern to abort an active assessment run.
 *
 * This command sends an abort event to the ROAR backend API, signaling that the
 * assessment run should be terminated. The command is idempotent, meaning multiple
 * abort requests for the same run are safe and will not cause errors.
 *
 * @implements {Command<AbortRunInput, AbortRunOutput>}
 *
 * @example
 * ```ts
 * const api = new RoarApi(context);
 * const cmd = new AbortRunCommand(api);
 * await invoker.run(cmd, { runId: 'run-123', type: 'abort' });
 * ```
 */
export class AbortRunCommand implements Command<AbortRunInput, AbortRunOutput> {
  readonly name = 'AbortRun';
  readonly idempotent = true;

  /**
   * Creates a new AbortRunCommand instance.
   *
   * @param api - RoarApi instance for making backend API calls
   */
  constructor(private api: RoarApi) {}

  /**
   * Executes the abort run operation by posting an event to the backend.
   *
   * Sends a POST request to the `/v1/runs/{runId}/events` endpoint with the event type
   * specified in the input. The operation is idempotent and safe to retry.
   *
   * @param input - AbortRunInput containing the runId and event type
   * @returns Promise<AbortRunOutput> - Resolves when the event is successfully posted
   *
   * @throws Error if the backend API request fails (non-2xx status or network error)
   *
   * @example
   * ```ts
   * const input: AbortRunInput = { runId: 'run-123', type: 'abort' };
   * await command.execute(input);
   * ```
   */
  async execute(input: AbortRunInput): Promise<AbortRunOutput> {
    await this.api.postRunEvent(input.runId, {
      type: RUN_EVENT_ABORT,
    });
  }
}
