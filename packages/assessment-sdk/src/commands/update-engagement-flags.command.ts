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
 *
 * **Behavior:**
 * - Sends a POST request to `/runs/:runId/event` with type `engagement`
 * - Returns an empty object on success (HTTP 200 OK)
 * - Throws `SDKError` with code `UPDATE_RUN_ENGAGEMENT_FLAGS_FAILED` on failure
 *
 * **Error handling:**
 * - HTTP 200 OK → Success
 * - HTTP 400 Bad Request → Extracts error message from response body (type-narrowed by status check)
 * - HTTP 409 Conflict → Throws error (run is in a terminal state, engagement flags cannot be updated)
 * - Other status codes → Generic error message with HTTP status code
 *
 * The API contract's `strictStatusCodes: true` configuration enables TypeScript to
 * automatically narrow the response body type based on the status code, eliminating
 * the need for explicit type casts.
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
   * Sends the engagement flags to the backend via the runs event endpoint.
   * Defaults reliableRun to false if not provided.
   *
   * @param input - The command input containing run ID, event type, engagement flags, and reliability status
   * @returns Promise<UpdateRunEngagementFlagsCommandOutput> - Empty object on successful execution
   * @throws {SDKError} If the backend request fails or returns a non-OK status.
   *         - HTTP 400 Bad Request: Extracts error message from response body
   *         - Other status codes: Generic error message with HTTP status code
   *         The error includes the code UPDATE_RUN_ENGAGEMENT_FLAGS_FAILED.
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

    if (result.status === StatusCodes.BAD_REQUEST) {
      throw new SDKError(
        result.body.error?.message ?? `Failed to update run engagement flags with status ${result.status}`,
        {
          code: SdkErrorCode.UPDATE_ENGAGEMENT_FLAGS_FAILED,
        },
      );
    }

    throw new SDKError(`Failed to update run engagement flags with status ${result.status}`, {
      code: SdkErrorCode.UPDATE_ENGAGEMENT_FLAGS_FAILED,
    });
  }
}
