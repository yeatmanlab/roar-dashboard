import { initClient } from '@ts-rest/core';
import { ApiContractV1 } from '@roar-dashboard/api-contract';
import type { CommandContext } from '../command/command';
import type { StartRunInput, StartRunOutput } from '../types/start-run';

/**
 * Creates a ts-rest client configured with ROAR API contract and authentication.
 *
 * The client automatically injects:
 * - Authorization header with Bearer token (when available)
 * - x-request-id header for request tracing (when requestId is defined)
 * - Custom fetch implementation (if provided in context)
 *
 * @param ctx - CommandContext with baseUrl, auth callbacks, and optional fetch implementation
 * @returns Initialized ts-rest client for ApiContractV1
 */
function createClient(ctx: CommandContext) {
  return initClient(ApiContractV1, {
    baseUrl: ctx.baseUrl,
    baseHeaders: {},
    api: async (args) => {
      const token = await ctx.auth.getToken();
      const requestId = ctx.requestId?.();

      const headers = {
        ...args.headers,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(requestId ? { 'x-request-id': requestId } : {}),
      };

      const fetchImpl = ctx.fetchImpl ?? fetch;

      const response = await fetchImpl(args.path, {
        method: args.method,
        headers,
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
   * Creates a new assessment run in the ROAR backend.
   *
   * This method sends a POST request to the backend API to initiate a new assessment run.
   * It handles both anonymous and authenticated run modes by conditionally including
   * the administrationId in the request body.
   *
   * Request body structure:
   * - taskVariantId: The variant of the task being assessed
   * - taskVersion: The version of the task
   * - administrationId: (optional) The administration ID for non-anonymous runs
   * - metadata: (optional) Custom metadata for run customization
   *
   * Response validation:
   * - Validates HTTP status is 2xx (res.ok)
   * - Validates response JSON contains a string 'id' field
   * - Maps backend 'id' field to SDK 'runId' field
   *
   * @param input - StartRunInput containing run configuration
   *                - variantId: Task variant identifier
   *                - taskVersion: Task version string
   *                - isAnonymous: Whether the run is anonymous
   *                - administrationId: (required if not anonymous) Administration ID
   *                - metadata: (optional) Custom metadata object
   *
   * @returns Promise<StartRunOutput> containing the newly created runId
   *
   * @throws Error if:
   *   - HTTP request fails (non-2xx status)
   *   - Response JSON is missing or invalid
   *   - Response JSON is missing a string 'id' field
   *
   * @example
   * ```ts
   * const api = new RoarApi(context);
   * const result = await api.createRun({
   *   type: 'start',
   *   variantId: 'variant-123',
   *   taskVersion: '1.0.0',
   *   isAnonymous: false,
   *   administrationId: 'admin-456',
   *   metadata: { sessionId: 'session-789' }
   * });
   * console.log(result.runId); // 'run-xyz'
   * ```
   */
  async createRun(input: StartRunInput): Promise<StartRunOutput> {
    const body: Record<string, unknown> = {
      taskVariantId: input.variantId,
      taskVersion: input.taskVersion,
      ...(input.metadata ? { metadata: input.metadata } : {}),
    };

    if (!input.isAnonymous) {
      body.administrationId = input.administrationId;
    }

    const res = await this.request('/v1/runs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`createRun failed (${res.status}): ${text}`);
    }

    const data: unknown = await res.json();

    // Backend contract is: { id: string }
    if (!data || typeof data !== 'object' || typeof (data as { id?: unknown }).id !== 'string') {
      throw new Error(`createRun failed: response JSON missing 'id' (got ${JSON.stringify(data)})`);
    }

    return { runId: (data as { id: string }).id };
  }

  /**
   * Posts an event to an active assessment run.
   *
   * This method sends a POST request to the backend API to record an event for a specific run.
   * Events can include abort signals, trial data, engagement flags, and other run-related updates.
   *
   * Request body structure:
   * - type: The event type (e.g., 'abort', 'trial', 'engagement')
   * - Additional fields depend on the event type
   *
   * Response validation:
   * - Validates HTTP status is 2xx (res.ok)
   * - No response body parsing required
   *
   * @param runId - The unique identifier of the run to post the event to
   * @param body - The event payload object (Record<string, unknown>) containing type and event-specific data
   *
   * @returns Promise<void> - Resolves when the event is successfully posted
   *
   * @throws Error if:
   *   - HTTP request fails (non-2xx status)
   *   - Network error occurs during the request
   *
   * @example
   * ```ts
   * const api = new RoarApi(context);
   * await api.postRunEvent('run-123', { type: 'abort' });
   * ```
   */
  async postRunEvent(runId: string, body: Record<string, unknown>): Promise<void> {
    const res = await this.request(`/v1/runs/${runId}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`postRunEvent failed (${res.status}): ${text}`);
    }
  }
}
