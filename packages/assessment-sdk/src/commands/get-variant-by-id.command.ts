import { StatusCodes } from 'http-status-codes';
import type { Command } from '../command/command';
import type { RoarApi } from '../receiver/roar-api';
import { SDKError } from '../errors/sdk-error';
import { SdkErrorCode } from '../enums/sdk-error-code.enum';

export interface GetVariantByIdInput {
  variantId: string;
}

export interface GetVariantByIdOutput {
  variantId: string;
  taskId: string;
  variantParams: Record<string, unknown>;
}

/**
 * GetVariantByIdCommand retrieves a task variant by its ID alone.
 *
 * Unlike GetTaskVariantCommand (which requires both taskId and variantId),
 * this command calls GET /task-variants/:variantId so the caller only needs
 * the variant UUID. The response includes the resolved taskId and all stored
 * variant parameters.
 */
export class GetVariantByIdCommand implements Command<GetVariantByIdInput, GetVariantByIdOutput> {
  readonly name = 'GetVariantById';
  readonly idempotent = true;

  constructor(private api: RoarApi) {}

  /**
   * @param input - The input containing variantId
   * @returns The variant output containing variantId, taskId, and variantParams
   * @throws {SDKError} If the variant is not found or the request fails
   */
  async execute(input: GetVariantByIdInput): Promise<GetVariantByIdOutput> {
    const { variantId } = input;
    const { status, body } = await this.api.client.taskVariants.getByIdWithTaskDetails({
      params: { variantId },
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
