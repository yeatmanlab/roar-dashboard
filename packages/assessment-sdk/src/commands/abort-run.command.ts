import { StatusCodes } from 'http-status-codes';
import type { Command } from '../command/command';
import type { RoarApi } from '../receiver/roar-api';
import type { AbortRunInput, AbortRunOutput } from '../types/abort-run';
import { SDKError } from '../errors/sdk-error';
import { SdkErrorCode } from '../enums';

/**
 * AbortRunCommand aborts an active assessment run.
 *
 * This command is idempotent, allowing the Invoker to retry on transient failures.
 *
 * Responsibilities:
 * - Call the ts-rest client to post a run abort event
 * - Interpret the HTTP response (200 OK = success)
 * - Throw SDKError with appropriate error code on failure
 *
 * @implements {Command<AbortRunInput, AbortRunOutput>}
 */
export class AbortRunCommand implements Command<AbortRunInput, AbortRunOutput> {
  readonly name = 'AbortRun';
  readonly idempotent = true;

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

    if (result.status === StatusCodes.OK) {
      return {};
    }

    const errorBody = result.body as { error?: { message?: string } };

    throw new SDKError(errorBody?.error?.message ?? `Failed to abort run with status ${result.status}`, {
      code: SdkErrorCode.ABORT_RUN_FAILED,
    });
  }
}
