import { StatusCodes } from 'http-status-codes';
import type { Command } from '../command/command';
import type { RoarApi } from '../receiver/roar-api';
import { SDKError } from '../errors/sdk-error';
import { SdkErrorCode } from '../enums/sdk-error-code.enum';

export interface GetTaskVariantInput {
  taskId: string;
  variantId: string;
}

export interface GetTaskVariantOutput {
  variantId: string;
  taskId: string;
  variantParams: Record<string, unknown>;
}

/**
 * GetTaskVariantCommand retrieves task variant information by variant ID.
 *
 * Fetches variant metadata and parameters from the backend using both task and variant IDs.
 *
 * Responsibilities:
 * - Call the ts-rest client to fetch variant details
 * - Transform and return variant parameters and metadata
 * - Throw SDKError on failure
 */
export class GetTaskVariantCommand implements Command<GetTaskVariantInput, GetTaskVariantOutput> {
  readonly name = 'GetTaskVariant';
  readonly idempotent = true; // safe read

  constructor(private api: RoarApi) {}

  async execute(input: GetTaskVariantInput): Promise<GetTaskVariantOutput> {
    const result = await this.api.client.tasks.getTaskVariant({
      params: { taskId: input.taskId, variantId: input.variantId },
    });

    if (result.status === StatusCodes.OK) {
      const variant = result.body.data;
      return {
        variantId: variant.id,
        taskId: variant.taskId,
        variantParams: Object.fromEntries(variant.parameters.map(({ name, value }) => [name, value])),
      };
    }

    // Handle error responses (404, 500) - body is narrowed by strictStatusCodes
    const errorMessage = (result.body as { error?: { message?: string } }).error?.message;
    throw new SDKError(errorMessage ?? `Failed to get variant with status ${result.status}`, {
      code: SdkErrorCode.GET_VARIANT_ID_FAILED,
    });
  }
}
