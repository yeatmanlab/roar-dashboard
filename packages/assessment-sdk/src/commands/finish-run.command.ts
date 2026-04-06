import { StatusCodes } from 'http-status-codes';
import type { Command } from '../command/command';
import type { RoarApi } from '../receiver/roar-api';
import type { FinishRunInput, FinishRunOutput } from '../types/finish-run';
import { SDKError } from '../errors/sdk-error';
import { SdkErrorCode } from '../enums';
import { RUN_EVENT_STATUS_OK } from '../types/run-event-status';

/**
 * Command to mark an assessment run as complete in the ROAR backend.
 *
 * This command sends a completion event to the backend for a specific run,
 * optionally including metadata about the run's completion state.
 *
 * **Idempotency:**
 * This command is non-idempotent; the Invoker will execute it exactly once.
 * 409 Conflict is treated as success since the run is already in a terminal state.
 *
 * **Behavior:**
 * - Validates that participantId is present in the SDK context
 * - Sends a POST request to `/runs/:runId/event` with type `complete`
 * - Includes any provided metadata in the request body
 * - Returns a status object on success (HTTP 200 or 409 Conflict)
 * - Throws `SDKError` with code `FINISH_RUN_FAILED` on failure
 *
 * **Error handling:**
 * - HTTP 200 OK or 409 Conflict → Success
 * - HTTP 400 Bad Request → Extracts error message from response body (type-narrowed by status check)
 * - Other status codes → Generic error message with HTTP status code
 *
 * The API contract's `strictStatusCodes: true` configuration enables TypeScript to
 * automatically narrow the response body type based on the status code, eliminating
 * the need for explicit type casts.
 *
 * @implements {Command<FinishRunInput, FinishRunOutput>}
 *
 * @example
 * ```ts
 * const api = new RoarApi(context);
 * const cmd = new FinishRunCommand(api, context);
 * const invoker = new Invoker(context);
 *
 * await invoker.run(cmd, {
 *   runId: 'run-123',
 *   type: 'complete',
 *   metadata: { totalScore: 85, timeSpent: 300 }
 * });
 * ```
 */
export class FinishRunCommand implements Command<FinishRunInput, FinishRunOutput> {
  readonly name = 'FinishRun';
  readonly idempotent = false;

  constructor(private api: RoarApi) {}

  /**
   * Executes the finish run command.
   *
   * @param input - The finish run input containing runId, event type, and optional metadata
   * @returns Promise<FinishRunOutput> - Status object on success
   * @throws {SDKError} If the backend request fails, with code `FINISH_RUN_FAILED`
   */
  async execute(input: FinishRunInput): Promise<FinishRunOutput> {
    const result = await this.api.client.runs.event({
      params: { runId: input.runId },
      body: {
        type: input.type,
        ...(input.metadata ? { metadata: input.metadata } : {}),
      },
    });

    if (result.status === StatusCodes.OK || result.status === StatusCodes.CONFLICT) {
      return { status: RUN_EVENT_STATUS_OK };
    }

    if (result.status === StatusCodes.BAD_REQUEST) {
      throw new SDKError(result.body.error?.message ?? `Failed to finish run with status ${result.status}`, {
        code: SdkErrorCode.FINISH_RUN_FAILED,
      });
    }

    throw new SDKError(`Failed to finish run with status ${result.status}`, {
      code: SdkErrorCode.FINISH_RUN_FAILED,
    });
  }
}
