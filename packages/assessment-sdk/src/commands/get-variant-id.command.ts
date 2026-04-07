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
 * **Behavior:**
 * - Call the ts-rest client to fetch variant details
 * - Transform and return variant parameters and metadata
 * - Throw SDKError on failure
 *
 * **Error handling:**
 * - HTTP 200 OK → Success
 * - Other status codes → Throws SDKError with code GET_VARIANT_ID_FAILED
 */
export class GetTaskVariantCommand implements Command<GetTaskVariantInput, GetTaskVariantOutput> {
  readonly name = 'GetTaskVariant';
  readonly idempotent = true; // safe read

  constructor(private api: RoarApi) {}

  /**
   * Retrieves task variant information by variant ID.
   *
   * @param input - The input containing taskId and variantId
   * @param input.taskId - The ID of the task
   * @param input.variantId - The ID of the variant
   * @returns The variant output containing variantId, taskId, and variantParams
   * @throws {SDKError} If the variant is not found or the request fails
   */
  async execute(input: GetTaskVariantInput): Promise<GetTaskVariantOutput> {
    const { taskId, variantId } = input;
    const { status, body } = await this.api.client.tasks.getTaskVariant({
      params: { taskId, variantId },
    });

    if (status === StatusCodes.OK) {
      const variant = body.data;
      return {
        variantId: variant.id,
        taskId: variant.taskId,
        variantParams: Object.fromEntries(variant.parameters.map(({ name, value }) => [name, value])),
      };
    }

    throw new SDKError(body.error?.message ?? `Failed to get variant with status ${status}`, {
      code: SdkErrorCode.GET_VARIANT_ID_FAILED,
    });
  }
}
