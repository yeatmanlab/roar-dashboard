import { StatusCodes } from 'http-status-codes';
import type { Command } from '../command/command';
import type { RoarApi } from '../receiver/roar-api';
import type { AbortRunInput, AbortRunOutput } from '../types/abort-run';
import { RUN_EVENT_STATUS_OK } from '../types/run-event-status';
import { SDKError } from '../errors/sdk-error';
import { SdkErrorCode } from '../enums';

/**
 * AbortRunCommand aborts an active assessment run.
 *
 * This command is non-idempotent; the Invoker will execute it exactly once.
 * 409 Conflict is treated as success since the run is already in a terminal state.
 *
 * Responsibilities:
 * - Validate that participantId is present in the SDK context
 * - Call the ts-rest client to post a run abort event
 * - Interpret the HTTP response (200 OK or 409 Conflict = success)
 * - Extract error messages from BAD_REQUEST responses when available
 * - Throw SDKError with appropriate error code on failure
 *
 * **Error handling:**
 * - 200 OK or 409 Conflict → Success
 * - 400 Bad Request → Extract error message from response body (narrowed by status check)
 * - Other status codes → Generic error message with status code
 *
 * The API contract's `strictStatusCodes: true` configuration enables TypeScript to
 * automatically narrow the response body type based on the status code, eliminating
 * the need for explicit type casts.
 *
 * @implements {Command<AbortRunInput, AbortRunOutput>}
 */
export class AbortRunCommand implements Command<AbortRunInput, AbortRunOutput> {
  readonly name = 'AbortRun';
  readonly idempotent = false;

  constructor(private api: RoarApi) {}

  /**
   * Executes the abort run command.
   *
   * @param input - AbortRunInput containing the runId and event type
   * @returns Promise<AbortRunOutput> - Empty object on success
   * @throws {SDKError} If the abort request fails with error code ABORT_RUN_FAILED
   */
  async execute(input: AbortRunInput): Promise<AbortRunOutput> {
    const result = await this.api.client.runs.event({
      params: { runId: input.runId },
      body: { type: input.type },
    });

    if (result.status === StatusCodes.OK || result.status === StatusCodes.CONFLICT) {
      return { status: RUN_EVENT_STATUS_OK };
    }

    if (result.status === StatusCodes.BAD_REQUEST) {
      throw new SDKError(result.body.error?.message ?? `Failed to abort run with status ${result.status}`, {
        code: SdkErrorCode.ABORT_RUN_FAILED,
      });
    }

    throw new SDKError(`Failed to abort run with status ${result.status}`, {
      code: SdkErrorCode.ABORT_RUN_FAILED,
    });
  }
}
