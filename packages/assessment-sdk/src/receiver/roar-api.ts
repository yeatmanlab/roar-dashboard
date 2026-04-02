import { initClient, tsRestFetchApi } from '@ts-rest/core';
import { ApiContractV1 } from '@roar-dashboard/api-contract';
import type { CommandContext } from '../command/command';

/**
 * Creates a ts-rest client configured with ROAR API contract and authentication.
 *
 * The client automatically injects:
 * - Authorization header with Bearer token (when available)
 * - x-request-id header for request tracing (when requestId is defined)
 * - Custom fetch implementation (if provided in context)
 *
 * @param ctx - CommandContext with baseUrl, auth callbacks, optional logger, and optional custom fetch
 * @returns Initialized ts-rest client for ApiContractV1
 */
function createClient(ctx: CommandContext) {
  return initClient(ApiContractV1, {
    baseUrl: ctx.baseUrl,
    baseHeaders: {},
    api: async (args) => {
      const token = await ctx.auth.getToken();
      const requestId = ctx.requestId?.();

      args.headers = {
        ...args.headers,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(requestId ? { 'x-request-id': requestId } : {}),
      };

      return tsRestFetchApi({
        ...args,
        ...(ctx.fetchImpl ? { fetchApi: ctx.fetchImpl } : {}),
      });
    },
  });
}

type RoarApiClient = ReturnType<typeof createClient>;

/**
 * RoarApi is the Receiver in the GoF Command pattern.
 * It owns the ts-rest HTTP client and provides typed API access to the ROAR backend.
 *
 * Responsibilities:
 * - Manage the ts-rest client instance
 * - Provide type-safe API methods through the client
 * - Handle authentication header injection
 * - Support request tracing via x-request-id headers
 */
export class RoarApi {
  public readonly client: RoarApiClient;

  constructor(ctx: CommandContext) {
    this.client = createClient(ctx);
  }

  /**
   * Retrieves variant information by variant ID and task ID.
   * Calls the GET /v1/tasks/:taskId/variants/:variantId endpoint to fetch variant details
   * including task information and variant parameters.
   *
   * @param taskId - The UUID of the parent task
   * @param variantId - The UUID of the variant to retrieve
   * @returns Variant information including variant_id, task_id, task_version, and variant_params
   * @throws Error if the variant is not found or the request fails
   */
  async getVariantById(
    taskId: string,
    variantId: string,
  ): Promise<{
    variant_id: string;
    task_id: string;
    task_version: string;
    variant_params: Record<string, unknown>;
  }> {
    const result = await this.client.tasks.getTaskVariant({ params: { taskId, variantId } });

    if (result.status === 200) {
      const variant = result.body.data;
      // Transform the variant response to the expected output format
      return {
        variant_id: variant.id,
        task_id: variant.taskId,
        task_version: '1.0.0', // TODO: Add task_version to variant response once available in backend
        variant_params: Object.fromEntries(
          variant.parameters.map((param: { name: string; value: unknown }) => [param.name, param.value]),
        ),
      };
    }

    const errorBody = result.body as { error?: { message?: string } };
    throw new Error(errorBody?.error?.message ?? `Failed to get variant with status ${result.status}`);
  }
}
