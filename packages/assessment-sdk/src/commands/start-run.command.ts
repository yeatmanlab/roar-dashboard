import { StatusCodes } from 'http-status-codes';
import type { Command } from '../command/command';
import type { RoarApi } from '../receiver/roar-api';
import type { StartRunInput, StartRunOutput } from '../types/start-run';
import type { CreateRunRequestBody } from '@roar-dashboard/api-contract';
import { SDKError } from '../errors/sdk-error';
import { SdkErrorCode } from '../enums';

/**
 * StartRunCommand creates a new assessment run.
 *
 * This command enforces type-safe handling of anonymous and authenticated runs
 * through a discriminated union input type that prevents invalid state combinations.
 *
 * Normalizes `isAnonymous` to `false` when omitted (authenticated run mode).
 *
 * **Behavior:**
 * - Validate the discriminated union input (anonymous vs authenticated)
 * - Normalize isAnonymous flag for request body
 * - Build the request body for the create-run endpoint
 * - Call the typed ts-rest client
 * - Interpret the HTTP response
 * - Throw SDKError on failure
 *
 * **Error handling:**
 * - HTTP 200 OK → Success
 * - HTTP 400 Bad Request → Extracts error message from response body (type-narrowed by status check)
 * - Other status codes → Generic error message with HTTP status code
 *
 * The API contract's `strictStatusCodes: true` configuration enables TypeScript to
 * automatically narrow the response body type based on the status code, eliminating
 * the need for explicit type casts.
 */
export class StartRunCommand implements Command<StartRunInput, StartRunOutput> {
  readonly name = 'StartRun';
  readonly idempotent = false;

  constructor(private api: RoarApi) {}

  /**
   * Creates a new assessment run.
   *
   * @param input - The start run input containing variant ID, task version, and run mode
   * @param input.variantId - The ID of the task variant to run
   * @param input.taskVersion - The version of the task
   * @param input.isAnonymous - Whether the run is anonymous (optional, defaults to false for authenticated runs)
   * @param input.administrationId - Required for authenticated runs (when isAnonymous is false or omitted)
   * @param input.metadata - Optional metadata to attach to the run
   * @returns The run output containing the created runId
   * @throws {SDKError} If the run creation fails, with code `START_RUN_FAILED`
   */
  async execute(input: StartRunInput): Promise<StartRunOutput> {
    const isAnonymous = input.isAnonymous ?? false;
    const body: CreateRunRequestBody = {
      taskVariantId: input.variantId,
      taskVersion: input.taskVersion,
      isAnonymous,
      ...(input.isAnonymous !== true ? { administrationId: input.administrationId } : {}),
      ...(input.metadata ? { metadata: input.metadata } : {}),
    };

    const result = await this.api.client.runs.create({ body });

    if (result.status === StatusCodes.CREATED) {
      return { runId: result.body.data.id };
    }

    const errorBody = result.body as { error?: { message?: string } };
    throw new SDKError(errorBody?.error?.message ?? `Failed to start run with status ${result.status}`, {
      code: SdkErrorCode.START_RUN_FAILED,
    });
  }
}
