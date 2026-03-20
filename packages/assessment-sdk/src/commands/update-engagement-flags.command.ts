import { StatusCodes } from 'http-status-codes';
import type { Command } from '../command/command';
import type { RoarApi } from '../receiver/roar-api';
import type {
  UpdateRunEngagementFlagsCommandInput,
  UpdateRunEngagementFlagsCommandOutput,
} from '../types/update-engagement-flags';
import { SDKError } from '../errors/sdk-error';
import { SdkErrorCode } from '../enums';

/**
 * Command to update engagement flags for a run.
 *
 * This command sends engagement flags to the backend to mark runs with quality issues
 * such as incomplete responses, response times that are too fast, accuracy that is too low,
 * or insufficient number of responses. It also allows marking a run as reliable.
 *
 * **Idempotency:**
 * This command is non-idempotent; the Invoker will execute it exactly once.
 * 409 Conflict is treated as success since the run is already in a terminal state.
 *
 * **Behavior:**
 * - Sends a POST request to `/runs/:runId/event` with type `engagement`
 * - Returns an empty object on success (HTTP 200 or 409 Conflict)
 * - Throws `SDKError` with code `UPDATE_RUN_ENGAGEMENT_FLAGS_FAILED` on failure
 *
 * @example
 * ```typescript
 * const cmd = new UpdateRunEngagementFlagsCommand(api);
 * await invoker.run(cmd, {
 *   runId: 'run-123',
 *   type: 'engagement',
 *   engagementFlags: {
 *     incomplete: true,
 *     responseTimeTooFast: false,
 *   },
 *   reliableRun: true,
 * });
 * ```
 */
export class UpdateRunEngagementFlagsCommand
  implements Command<UpdateRunEngagementFlagsCommandInput, UpdateRunEngagementFlagsCommandOutput>
{
  readonly name = 'UpdateRunEngagementFlags';
  readonly idempotent = false;

  /**
   * Creates a new UpdateRunEngagementFlagsCommand.
   *
   * @param api - The ROAR API client instance
   */
  constructor(private api: RoarApi) {}

  /**
   * Executes the command to update engagement flags for a run.
   *
   * Transforms the input engagement flags from boolean values to their string equivalents
   * and sends them to the backend via the runs event endpoint. Only flags set to true
   * are included in the request. Defaults reliableRun to false if not provided.
   *
   * The transformation maps:
   * - incomplete → "incomplete"
   * - responseTimeTooFast → "response_time_too_fast"
   * - accuracyTooLow → "accuracy_too_low"
   * - notEnoughResponses → "not_enough_responses"
   *
   * @param input - The command input containing run ID, event type, engagement flags, and reliability status
   * @returns An empty object on successful execution
   * @throws {SDKError} If the backend request fails or returns a non-OK status.
   *         The error includes the code UPDATE_RUN_ENGAGEMENT_FLAGS_FAILED.
   */
  async execute(input: UpdateRunEngagementFlagsCommandInput): Promise<UpdateRunEngagementFlagsCommandOutput> {
    const engagementFlags: Record<
      string,
      'incomplete' | 'response_time_too_fast' | 'accuracy_too_low' | 'not_enough_responses'
    > = {};

    if (input.engagementFlags.incomplete) {
      engagementFlags.incomplete = 'incomplete';
    }
    if (input.engagementFlags.responseTimeTooFast) {
      engagementFlags.responseTimeTooFast = 'response_time_too_fast';
    }
    if (input.engagementFlags.accuracyTooLow) {
      engagementFlags.accuracyTooLow = 'accuracy_too_low';
    }
    if (input.engagementFlags.notEnoughResponses) {
      engagementFlags.notEnoughResponses = 'not_enough_responses';
    }

    const result = await this.api.client.runs.event({
      params: { runId: input.runId },
      body: {
        type: input.type,
        engagementFlags,
        reliableRun: input.reliableRun ?? false,
      },
    });

    if (result.status === StatusCodes.OK || result.status === StatusCodes.CONFLICT) {
      return {};
    }

    const errorBody = result.body as { error?: { message?: string } };

    throw new SDKError(
      errorBody?.error?.message ?? `Failed to update run engagement flags with status ${result.status}`,
      {
        code: SdkErrorCode.UPDATE_RUN_ENGAGEMENT_FLAGS_FAILED,
      },
    );
  }
}
