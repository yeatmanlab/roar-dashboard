import { initClient, tsRestFetchApi } from '@ts-rest/core';
import { ApiContractV1 } from '@roar-dashboard/api-contract';
import type { CommandContext } from '../command/command';

/**
 * Creates a ts-rest client configured with ROAR API contract and authentication.
 *
 * The client automatically injects:
 * - Authorization header with Bearer token (when available)
 * - x-request-id header for request tracing (when requestId is defined)
 * - participantId into the baseUrl path (e.g., /v1/users/{participantId}/runs)
 * - Custom fetch implementation (if provided in context)
 *
 * @param ctx - CommandContext with baseUrl, auth callbacks, participant context, optional logger, and optional custom fetch
 * @returns Initialized ts-rest client for ApiContractV1
 */
function createClient(ctx: CommandContext) {
  // Inject participantId into the baseUrl to scope all API requests to the participant
  // This transforms the baseUrl from /v1 to /v1/users/{participantId}
  const participantId = ctx.participant?.participantId;
  if (!participantId) {
    throw new Error('participantId is required in CommandContext to create API client');
  }

  const baseUrlWithParticipant = `${ctx.baseUrl}/users/${participantId}`;

  return initClient(ApiContractV1, {
    baseUrl: baseUrlWithParticipant,
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
}
