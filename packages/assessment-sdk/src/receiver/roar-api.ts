import { initClient, tsRestFetchApi } from '@ts-rest/core';
import { ApiContractV1 } from '@roar-dashboard/api-contract';
import type { CommandContext } from '../command/command';

/**
 * Creates a ts-rest client configured with ROAR API contract and authentication.
 *
 * The client automatically injects:
 * - Authorization header with Bearer token (when available)
 * - x-request-id header for request tracing (when requestId is defined)
 *
 * @param ctx - CommandContext with baseUrl, auth callbacks, and optional logger
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

      // Use custom fetch implementation if provided, otherwise use ts-rest's default
      if (ctx.fetchImpl) {
        const response = await ctx.fetchImpl(args.path, {
          method: args.method,
          headers: args.headers,
          ...(args.body !== undefined && { body: args.body }),
        });

        const contentType = response.headers.get('content-type') ?? '';
        const body = contentType.includes('application/json')
          ? await response.json().catch(() => undefined)
          : await response.text().catch(() => undefined);

        return {
          status: response.status,
          body,
          headers: response.headers,
        };
      }

      return tsRestFetchApi(args);
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
}
