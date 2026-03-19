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
   * Sends the engagement flags and reliability status to the backend via the runs event endpoint.
   * Defaults reliableRun to false if not provided.
   *
   * @param input - The command input containing run ID, event type, engagement flags, and reliability status
   * @returns An empty object on successful execution
   * @throws {SDKError} If the backend request fails or returns a non-OK status
   */
  async execute(input: UpdateRunEngagementFlagsCommandInput): Promise<UpdateRunEngagementFlagsCommandOutput> {
    const result = await this.api.client.runs.event({
      params: { runId: input.runId },
      body: {
        type: input.type,
        engagementFlags: input.engagementFlags,
        reliableRun: input.reliableRun ?? false,
      },
    });

    if (result.status === StatusCodes.OK) {
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
