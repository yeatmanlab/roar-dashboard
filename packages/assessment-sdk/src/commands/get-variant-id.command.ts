import type { Command } from '../command/command';
import type { RoarApi } from '../receiver/roar-api';

export interface GetVariantIDInput {
  task_id: string;
  variant_id: string;
}

export interface GetVariantIDOutput {
  variant_id: string;
  task_id: string;
  task_version: string;
  /** The exact params shape used by the task runtime (JSON-serializable). */
  variant_params: Record<string, unknown>;
}

/**
 * GetVariantIDCommand retrieves variant information by variant ID.
 *
 * This command supports the new parameter-passing approach where the launcher
 * passes only the variant_id, and the assessment app looks up the variant's
 * parameters using this command.
 *
 * Responsibilities:
 * - Call the RoarApi to fetch variant details by ID
 * - Extract and return variant parameters and metadata
 * - Throw SDKError on failure
 */
export class GetVariantIDCommand implements Command<GetVariantIDInput, GetVariantIDOutput> {
  readonly name = 'GetVariantID';
  readonly idempotent = true; // safe read

  constructor(private api: RoarApi) {}

  async execute(input: GetVariantIDInput): Promise<GetVariantIDOutput> {
    return this.api.getVariantById(input.task_id, input.variant_id);
  }
}
