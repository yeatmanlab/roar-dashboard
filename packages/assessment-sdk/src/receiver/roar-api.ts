import { initClient, tsRestFetchApi } from '@ts-rest/core';
import { ApiContractV1 } from '@roar-platform/api-contract';
import type { CommandContext, Logger } from '../command/command';
import { SDKError } from '../errors/sdk-error';
import { SdkErrorCode } from '../enums/sdk-error-code.enum';

/**
 * Configuration required to build a ts-rest client.
 *
 * This is the participant-free subset of {@link CommandContext}. It deliberately omits
 * `participant` so the client can be created before a participantId (ROAR UUID) exists —
 * for example during anonymous-session bootstrap, where the very call that provisions the
 * participantId must be made without one.
 */
export interface ApiClientConfig {
  baseUrl: string;
  auth: {
    getToken(): Promise<string | undefined>;
    refreshToken?(): Promise<string | undefined>;
  };
  requestId?: () => string;
  fetchImpl?: typeof fetch;
  /** Accepted for structural compatibility with CommandContext but not yet used by createApiClient.
   *  Forward-compatibility field — will be wired into token injection debug logging in a follow-up. */
  logger?: Logger;
}

/**
 * Creates a ts-rest client configured with the ROAR API contract and authentication.
 *
 * The client automatically injects:
 * - Authorization header with Bearer token (when available)
 * - x-request-id header for request tracing (when requestId is defined)
 * - Custom fetch implementation (if provided in config)
 *
 * Unlike the {@link RoarApi} constructor, this does not require a participantId, so it can
 * be used for unauthenticated/pre-provisioning calls such as anonymous-session bootstrap.
 *
 * @param config - baseUrl, auth callbacks, optional requestId, optional custom fetch, optional logger
 * @returns Initialized ts-rest client for ApiContractV1
 */
export function createApiClient(config: ApiClientConfig) {
  return initClient(ApiContractV1, {
    baseUrl: config.baseUrl,
    baseHeaders: {},
    api: async (args) => {
      const token = await config.auth.getToken();
      const requestId = config.requestId?.();

      args.headers = {
        ...args.headers,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(requestId ? { 'x-request-id': requestId } : {}),
      };

      return tsRestFetchApi({
        ...args,
        ...(config.fetchImpl ? { fetchApi: config.fetchImpl } : {}),
      });
    },
  });
}

export type RoarApiClient = ReturnType<typeof createApiClient>;

/**
 * Creates a ts-rest client for command execution, enforcing that a participantId is present.
 *
 * @param ctx - CommandContext with baseUrl, auth callbacks, participant context, optional logger, and optional custom fetch
 * @returns Initialized ts-rest client for ApiContractV1
 */
function createClient(ctx: CommandContext): RoarApiClient {
  // Validate participantId is present at client creation time
  // This is the single enforcement point for the requirement
  if (!ctx.participant.participantId) {
    throw new SDKError('participantId is required in CommandContext to create API client', {
      code: SdkErrorCode.INVALID_CONTEXT,
    });
  }

  return createApiClient(ctx);
}

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
