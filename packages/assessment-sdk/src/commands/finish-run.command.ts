import { StatusCodes } from 'http-status-codes';
import type { Command } from '../command/command';
import type { RoarApi } from '../receiver/roar-api';
import type { FinishRunInput, FinishRunOutput } from '../types/finish-run';
import { SDKError } from '../errors/sdk-error';
import { SdkErrorCode } from '../enums';

export class FinishRunCommand implements Command<FinishRunInput, FinishRunOutput> {
  readonly name = 'FinishRun';
  readonly idempotent = false;

  constructor(private api: RoarApi) {}

  async execute(input: FinishRunInput): Promise<FinishRunOutput> {
    const result = await this.api.client.runs.event({
      params: { runId: input.runId },
      body: {
        type: input.type,
        ...(input.metadata ? { metadata: input.metadata } : {}),
      },
    });

    if (result.status === StatusCodes.OK) {
      return {};
    }

    const errorBody = result.body as { error?: { message?: string } };

    throw new SDKError(errorBody?.error?.message ?? `Failed to finish run with status ${result.status}`, {
      code: SdkErrorCode.FINISH_RUN_FAILED,
    });
  }
}
