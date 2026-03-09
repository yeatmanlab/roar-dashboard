import { StatusCodes } from 'http-status-codes';
import type { Command } from '../command/command';
import type { RoarApi } from '../receiver/roar-api';
import type { StartRunInput, StartRunOutput } from '../types/start-run';
import type { CreateRunRequestBody } from '@roar-dashboard/api-contract';
import { SDKError } from '../errors/sdk-error';

/**
 * StartRunCommand creates a new assessment run.
 *
 * This command enforces type-safe handling of anonymous and authenticated runs
 * through a discriminated union input type that prevents invalid state combinations.
 *
 * Responsibilities:
 * - Validate the discriminated union input (anonymous vs authenticated)
 * - Build the request body for the create-run endpoint
 * - Call the typed ts-rest client
 * - Interpret the HTTP response
 * - Throw SDKError on failure
 */
export class StartRunCommand implements Command<StartRunInput, StartRunOutput> {
  readonly name = 'StartRun';
  readonly idempotent = false;

  constructor(private api: RoarApi) {}

  async execute(input: StartRunInput): Promise<StartRunOutput> {
    const body: CreateRunRequestBody = {
      taskVariantId: input.variantId,
      taskVersion: input.taskVersion,
      isAnonymous: input.isAnonymous,
      ...(input.isAnonymous ? {} : { administrationId: input.administrationId }),
      ...(input.metadata ? { metadata: input.metadata } : {}),
    };

    const result = await this.api.client.runs.create({ body });

    if (result.status === StatusCodes.CREATED) {
      return { runId: result.body.data.id };
    }

    throw new SDKError(`Failed to start run with status ${result.status}`, {
      code: 'CREATE_RUN_FAILED',
    });
  }
}
