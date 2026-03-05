import type { Command } from '../command/command';
import type { RoarApi } from '../receiver/roar-api';
import type { StartRunInput, StartRunOutput } from '../types/start-run';

/**
 * StartRunCommand implements the Command pattern for initiating a new assessment run.
 *
 * This command is responsible for creating a new run in the ROAR backend system.
 * It encapsulates the logic for starting an assessment session, either anonymously
 * or with an associated administration ID.
 *
 * Key characteristics:
 * - Non-idempotent: Each execution creates a new run (no retries on failure)
 * - Delegates API communication to RoarApi.createRun()
 * - Supports both anonymous and authenticated run modes
 * - Includes optional metadata for run customization
 *
 * @example
 * ```ts
 * const api = new RoarApi(context);
 * const command = new StartRunCommand(api);
 * const result = await invoker.run(command, {
 *   type: 'start',
 *   variantId: 'variant-123',
 *   taskVersion: '1.0.0',
 *   isAnonymous: true
 * });
 * console.log(result.runId); // 'run-xyz'
 * ```
 */
export class StartRunCommand implements Command<StartRunInput, StartRunOutput> {
  readonly name = 'StartRun';
  readonly idempotent = false;

  /**
   * Creates a new StartRunCommand instance.
   *
   * @param api - RoarApi instance for making backend API calls
   */
  constructor(private api: RoarApi) {}

  /**
   * Executes the StartRun command by calling the backend API to create a new run.
   *
   * @param input - StartRunInput containing variant ID, task version, and optional metadata
   * @returns Promise<StartRunOutput> containing the newly created run ID
   * @throws Error if the API request fails
   */
  async execute(input: StartRunInput): Promise<StartRunOutput> {
    return this.api.createRun(input);
  }
}
