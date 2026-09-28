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
  /** Accepted for backwards compatibility but NOT honored — the underlying ts-rest fetcher
   *  always uses the global fetch. Stub the global in tests instead. */
  fetchImpl?: typeof fetch;
  /** Used for token-refresh observability: a refresh attempt logs at debug, a failed refresh at warn. */
  logger?: Logger;
}

/**
 * Backend auth error codes that a single forced token refresh can repair.
 * The backend's ApiErrorCode enum is not published, so the literals are
 * pinned here — the same way the dashboard client pins them in
 * `utils/api-errors.js`.
 */
const REFRESHABLE_AUTH_ERROR_CODES = new Set(['auth/token-expired', 'auth/token-invalid']);

/**
 * Extracts the error code from a parsed ts-rest 401 body.
 *
 * `tsRestFetchApi` resolves to `{ status, body, headers }` with the body
 * already parsed — JSON bodies become objects, non-JSON bodies become a
 * string or blob. Any non-envelope shape yields undefined rather than
 * throwing, so an HTML error page from an intermediary falls through to the
 * original 401.
 *
 * @param body - The parsed response body
 * @returns The error code string, or undefined when the body carries none
 */
function getAuthErrorCode(body: unknown): string | undefined {
  if (typeof body !== 'object' || body === null) return undefined;
  const error = (body as { error?: unknown }).error;
  if (typeof error !== 'object' || error === null) return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}

/**
 * Creates a ts-rest client configured with the ROAR API contract and authentication.
 *
 * The client automatically injects:
 * - Authorization header with Bearer token (when available)
 * - x-request-id header for request tracing (when requestId is defined)
 *
 * When `auth.refreshToken` is provided, a 401 response carrying the
 * `auth/token-expired` or `auth/token-invalid` error code triggers one token
 * refresh and one retry with the fresh token — mirroring the dashboard
 * client's semantics. Concurrent 401s share a single in-flight refresh, so a
 * burst of trial writes cannot stampede the auth provider. Any other 401,
 * a failed refresh, or a refresh resolving no token surfaces the original
 * 401 unchanged for the caller to treat as terminal.
 *
 * Unlike the {@link RoarApi} constructor, this does not require a participantId, so it can
 * be used for unauthenticated/pre-provisioning calls such as anonymous-session bootstrap.
 *
 * @param config - baseUrl, auth callbacks, optional requestId, optional logger
 * @returns Initialized ts-rest client for ApiContractV1
 */
export function createApiClient(config: ApiClientConfig) {
  // One in-flight refresh per client instance: trial writes are bursty, and a
  // batch of near-simultaneous 401s must trigger a single refreshToken call.
  let inflightRefresh: Promise<string | undefined> | null = null;

  const refreshOnce = (refreshToken: () => Promise<string | undefined>): Promise<string | undefined> => {
    if (!inflightRefresh) {
      inflightRefresh = Promise.resolve()
        .then(() => refreshToken())
        // A failed refresh (revoked session, offline) resolves to undefined so
        // the caller surfaces the original 401, not a thrown refresh internal.
        .catch((error: unknown) => {
          config.logger?.warn('[assessment-sdk] Token refresh failed', error);
          return undefined;
        })
        .finally(() => {
          inflightRefresh = null;
        });
    }
    return inflightRefresh;
  };

  return initClient(ApiContractV1, {
    baseUrl: config.baseUrl,
    baseHeaders: {},
    api: async (args) => {
      const token = await config.auth.getToken();
      const requestId = config.requestId?.();

      const headers = {
        ...args.headers,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(requestId ? { 'x-request-id': requestId } : {}),
      };

      const response = await tsRestFetchApi({ ...args, headers });

      const { refreshToken } = config.auth;
      if (response.status !== 401 || !refreshToken) {
        return response;
      }

      const errorCode = getAuthErrorCode(response.body);
      if (errorCode === undefined || !REFRESHABLE_AUTH_ERROR_CODES.has(errorCode)) {
        return response;
      }

      config.logger?.debug('[assessment-sdk] 401 with refreshable auth error code, refreshing token', { errorCode });

      const freshToken = await refreshOnce(refreshToken);
      // No fresh token (signed out mid-request, refresh failed): a retry
      // without a valid Authorization header is a guaranteed 401 — skip the
      // round-trip and surface the original response as the terminal error.
      if (!freshToken) {
        return response;
      }

      // Retry once with the fresh token. A failure here propagates as a
      // network error instead of masquerading as a terminal auth 401. The
      // x-request-id is reused so the retry correlates with the original
      // request in backend traces.
      return tsRestFetchApi({
        ...args,
        headers: { ...headers, Authorization: `Bearer ${freshToken}` },
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
